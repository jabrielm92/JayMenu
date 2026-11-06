/**
 * Change engine — ALL menu writes go through this module (JAYMENU_PLAN.md Section 6).
 *
 * Every public function:
 *  - runs in one transaction,
 *  - records every touched row (before/after) and writes one ChangeLog row,
 *  - returns { ok, changeId, summary, conflicts? } or { ok: false, error }.
 *
 * Undo replays a ChangeLog's `before` snapshot and deletes rows the change created.
 */
import { getPrisma, type DB } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { formatCents } from "@/lib/money";
import { loadRawSnapshot, loadStoreInput } from "./load";
import { resolveGroup, resolveMenu, toPublicMenu, type GroupField, type ModifierField } from "./resolve";

type Tx = Prisma.TransactionClient;

// ---------- Public types ----------

export type Scope =
  | { type: "item"; itemId: string }
  | { type: "items"; itemIds: string[] }
  | { type: "all" };

export type Conflict = {
  linkId: string;
  itemId: string;
  itemName: string;
  /** The item's own (overridden) value. */
  value: string | number | null;
};

export type ChangeOk = {
  ok: true;
  /** null when the request changed nothing (no ChangeLog row written). */
  changeId: string | null;
  summary: string;
  conflicts?: Conflict[];
};
export type ChangeFail = { ok: false; error: string };
export type ChangeResult = ChangeOk | ChangeFail;

export type PublishResult =
  | { ok: true; versionId: string; versionNumber: number; changeCount: number; summary: string }
  | ChangeFail;

export type ResetTarget =
  | { kind: "group"; field: GroupField }
  | { kind: "modifier"; modifierId: string; field?: ModifierField | "hidden" }
  | { kind: "extras" };

export type SetOptions = {
  /** With scope "all": also clear items' own values for this field (same transaction). */
  resetConflicts?: boolean;
};

export class ChangeError extends Error {}

// ---------- Row recorder (before/after snapshots for undo) ----------

const MODELS = [
  "category",
  "item",
  "modifierGroup",
  "modifier",
  "itemGroupLink",
  "modifierOverride",
  "linkExtraModifier",
] as const; // parent-first order
type Model = (typeof MODELS)[number];
type Row = { id: string } & Record<string, unknown>;
type Data = Record<string, unknown>;
export type Snapshot = Partial<Record<Model, Row[]>>;

type Delegate = {
  findUnique(a: { where: { id: string } }): Promise<Row | null>;
  findMany(a: { where: Data }): Promise<Row[]>;
  create(a: { data: Data }): Promise<Row>;
  update(a: { where: { id: string }; data: Data }): Promise<Row>;
  delete(a: { where: { id: string } }): Promise<Row>;
  deleteMany(a: { where: Data }): Promise<unknown>;
  upsert(a: { where: { id: string }; create: Data; update: Data }): Promise<Row>;
};
const delegate = (tx: Tx, m: Model) => (tx as unknown as Record<Model, Delegate>)[m];

/** Children removed by ON DELETE CASCADE — captured so undo can restore them. */
const CHILDREN: Partial<Record<Model, { model: Model; fk: string }[]>> = {
  category: [{ model: "item", fk: "categoryId" }],
  item: [{ model: "itemGroupLink", fk: "itemId" }],
  modifierGroup: [
    { model: "modifier", fk: "groupId" },
    { model: "itemGroupLink", fk: "groupId" },
  ],
  modifier: [{ model: "modifierOverride", fk: "modifierId" }],
  itemGroupLink: [
    { model: "modifierOverride", fk: "linkId" },
    { model: "linkExtraModifier", fk: "linkId" },
  ],
};

const key = (m: Model, id: string) => `${m}:${id}`;

class Recorder {
  private before = new Map<string, { model: Model; id: string; row: Row | null }>();
  constructor(private tx: Tx) {}

  private async touch(model: Model, id: string) {
    const k = key(model, id);
    if (!this.before.has(k)) {
      const row = await delegate(this.tx, model).findUnique({ where: { id } });
      this.before.set(k, { model, id, row });
    }
  }

  private async captureTree(model: Model, id: string) {
    await this.touch(model, id);
    for (const child of CHILDREN[model] ?? []) {
      const rows = await delegate(this.tx, child.model).findMany({ where: { [child.fk]: id } });
      for (const r of rows) {
        const k = key(child.model, r.id);
        if (!this.before.has(k)) this.before.set(k, { model: child.model, id: r.id, row: r });
        await this.captureTree(child.model, r.id);
      }
    }
  }

  async create<T = Row>(model: Model, data: Data): Promise<T> {
    const row = await delegate(this.tx, model).create({ data });
    const k = key(model, row.id);
    if (!this.before.has(k)) this.before.set(k, { model, id: row.id, row: null });
    return row as unknown as T;
  }

  async update<T = Row>(model: Model, id: string, data: Data): Promise<T> {
    await this.touch(model, id);
    return (await delegate(this.tx, model).update({ where: { id }, data })) as unknown as T;
  }

  async delete(model: Model, id: string) {
    await this.captureTree(model, id);
    await delegate(this.tx, model).delete({ where: { id } });
  }

  async finish(): Promise<{ before: Snapshot; after: Snapshot; changed: boolean }> {
    const before: Snapshot = {};
    const after: Snapshot = {};
    let changed = false;
    for (const { model, id, row } of this.before.values()) {
      const now = await delegate(this.tx, model).findUnique({ where: { id } });
      if (row) (before[model] ??= []).push(row);
      if (now) (after[model] ??= []).push(now);
      if (JSON.stringify(row) !== JSON.stringify(now)) changed = true;
    }
    return { before, after, changed };
  }
}

// ---------- Helpers ----------

type LinkWithItem = Prisma.ItemGroupLinkGetPayload<{ include: { item: { select: { id: true; name: true } } } }>;

function fmtValue(field: GroupField | ModifierField, v: string | number | null): string {
  if (field === "price") return formatCents(v as number);
  if (field === "max" && v === null) return "no limit";
  if (field === "name") return `"${v}"`;
  return String(v);
}

const FIELD_LABEL: Record<GroupField | ModifierField, string> = {
  name: "name",
  min: "min",
  max: "max",
  price: "price",
  sortOrder: "position",
};

function scopeText(all: boolean, links: LinkWithItem[]): string {
  if (all) return "on all linked items";
  if (links.length === 1) return `on ${links[0].item.name} only`;
  return `on ${links.length} items (${links.map((l) => l.item.name).join(", ")})`;
}

function scopeKind(all: boolean, links: LinkWithItem[]): "item" | "items" | "all" {
  return all ? "all" : links.length === 1 ? "item" : "items";
}

/** Work out which links a scope targets. `items` covering every link is treated as `all`. */
async function linksForScope(tx: Tx, groupId: string, scope: Scope) {
  const allLinks = await tx.itemGroupLink.findMany({
    where: { groupId },
    include: { item: { select: { id: true, name: true } } },
    orderBy: { item: { name: "asc" } },
  });
  if (scope.type === "all") return { all: true, links: allLinks, allLinks };
  const ids = scope.type === "item" ? [scope.itemId] : [...new Set(scope.itemIds)];
  if (ids.length === 0) throw new ChangeError("No items selected.");
  const links = allLinks.filter((l) => ids.includes(l.itemId));
  if (links.length !== ids.length) throw new ChangeError("Some selected items are not linked to this group.");
  if (scope.type === "items" && links.length === allLinks.length) return { all: true, links: allLinks, allLinks };
  return { all: false, links, allLinks };
}

type GroupTemplate = { name: string; minSelect: number; maxSelect: number | null };

/** Group-level override data for a link after setting `field` to `value` (equal-to-template → cleared). */
function groupOverrideData(t: GroupTemplate, field: GroupField, value: string | number | null): Data {
  if (field === "name") return { nameOverride: value === t.name ? null : value };
  if (field === "min") return { minOverride: value === t.minSelect ? null : value };
  return value === t.maxSelect
    ? { maxOverride: null, maxOverrideSet: false }
    : { maxOverride: value, maxOverrideSet: true };
}

function linkGroupOverride(l: { nameOverride: string | null; minOverride: number | null; maxOverride: number | null; maxOverrideSet: boolean }, field: GroupField) {
  if (field === "name") return { has: l.nameOverride !== null, value: l.nameOverride as string | number | null };
  if (field === "min") return { has: l.minOverride !== null, value: l.minOverride as string | number | null };
  return { has: l.maxOverrideSet, value: l.maxOverride as string | number | null };
}

const CLEAR_GROUP_FIELD: Record<GroupField, Data> = {
  name: { nameOverride: null },
  min: { minOverride: null },
  max: { maxOverride: null, maxOverrideSet: false },
};

type TemplateMod = { id: string; name: string; priceCents: number; sortOrder: number };
type OverridePatch = Partial<{
  nameOverride: string | null;
  priceCentsOverride: number | null;
  hidden: boolean;
  sortOrderOverride: number | null;
}>;

const MOD_FIELD_COLUMN: Record<ModifierField, "nameOverride" | "priceCentsOverride" | "sortOrderOverride"> = {
  name: "nameOverride",
  price: "priceCentsOverride",
  sortOrder: "sortOrderOverride",
};
const MOD_TEMPLATE_COLUMN: Record<ModifierField, "name" | "priceCents" | "sortOrder"> = {
  name: "name",
  price: "priceCents",
  sortOrder: "sortOrder",
};

/** Upsert / clean a ModifierOverride. Values equal to the template are dropped; empty rows deleted. */
async function writeModOverride(tx: Tx, rec: Recorder, linkId: string, mod: TemplateMod, patch: OverridePatch) {
  const existing = await tx.modifierOverride.findUnique({
    where: { linkId_modifierId: { linkId, modifierId: mod.id } },
  });
  const next = {
    nameOverride: existing?.nameOverride ?? null,
    priceCentsOverride: existing?.priceCentsOverride ?? null,
    hidden: existing?.hidden ?? false,
    sortOrderOverride: existing?.sortOrderOverride ?? null,
    ...patch,
  };
  if (next.nameOverride === mod.name) next.nameOverride = null;
  if (next.priceCentsOverride === mod.priceCents) next.priceCentsOverride = null;
  if (next.sortOrderOverride === mod.sortOrder) next.sortOrderOverride = null;
  const empty =
    next.nameOverride === null && next.priceCentsOverride === null && next.sortOrderOverride === null && !next.hidden;

  if (existing) {
    if (empty) await rec.delete("modifierOverride", existing.id);
    else await rec.update("modifierOverride", existing.id, next);
  } else if (!empty) {
    await rec.create("modifierOverride", { linkId, modifierId: mod.id, ...next });
  }
}

async function storeIdForGroup(tx: Tx, groupId: string) {
  const g = await tx.modifierGroup.findUnique({ where: { id: groupId }, include: { modifiers: true } });
  if (!g) throw new ChangeError("Group not found.");
  return g;
}

async function getModifier(tx: Tx, modifierId: string) {
  const m = await tx.modifier.findUnique({ where: { id: modifierId }, include: { group: true } });
  if (!m) throw new ChangeError("Option not found.");
  return m;
}

async function getLink(tx: Tx, linkId: string) {
  const l = await tx.itemGroupLink.findUnique({
    where: { id: linkId },
    include: {
      item: { include: { category: true } },
      group: { include: { modifiers: true } },
      modOverrides: true,
      extras: true,
    },
  });
  if (!l) throw new ChangeError("Link not found.");
  return l;
}

async function nextSortOrder(rows: { sortOrder: number }[]) {
  return rows.length ? Math.max(...rows.map((r) => r.sortOrder)) + 1 : 0;
}

// ---------- Engine ----------

type Body = (tx: Tx, rec: Recorder) => Promise<{
  storeId: string;
  summary: string;
  scope: "item" | "items" | "all" | "none";
  conflicts?: Conflict[];
}>;

export function createChangeEngine(db: DB) {
  async function run(body: Body): Promise<ChangeResult> {
    try {
      return await db.$transaction(async (tx) => {
        const rec = new Recorder(tx);
        const r = await body(tx, rec);
        const { before, after, changed } = await rec.finish();
        let changeId: string | null = null;
        if (changed) {
          const log = await tx.changeLog.create({
            data: {
              storeId: r.storeId,
              summary: r.summary,
              scope: r.scope,
              before: before as Prisma.InputJsonValue,
              after: after as Prisma.InputJsonValue,
            },
          });
          changeId = log.id;
        }
        const res: ChangeOk = { ok: true, changeId, summary: changed ? r.summary : "No changes" };
        if (r.conflicts?.length) res.conflicts = r.conflicts;
        return res;
      });
    } catch (e) {
      if (e instanceof ChangeError) return { ok: false, error: e.message };
      throw e;
    }
  }

  // ----- Read-only helpers for the Scope Prompt -----

  /** Links that have their own value for a group field which differs from `newValue`. */
  async function getGroupFieldConflicts(groupId: string, field: GroupField, newValue: string | number | null): Promise<Conflict[]> {
    const links = await db.itemGroupLink.findMany({ where: { groupId }, include: { item: { select: { id: true, name: true } } } });
    return links
      .map((l) => ({ l, o: linkGroupOverride(l, field) }))
      .filter(({ o }) => o.has && o.value !== newValue)
      .map(({ l, o }) => ({ linkId: l.id, itemId: l.itemId, itemName: l.item.name, value: o.value }));
  }

  /** Links that have their own value for a modifier field which differs from `newValue`. */
  async function getModifierFieldConflicts(modifierId: string, field: ModifierField, newValue: string | number): Promise<Conflict[]> {
    const col = MOD_FIELD_COLUMN[field];
    const ovs = await db.modifierOverride.findMany({
      where: { modifierId, NOT: { [col]: null } },
      include: { link: { include: { item: { select: { id: true, name: true } } } } },
    });
    return ovs
      .filter((o) => o[col] !== newValue)
      .map((o) => ({ linkId: o.linkId, itemId: o.link.itemId, itemName: o.link.item.name, value: o[col] }));
  }

  // ----- Group fields -----

  function setGroupField(
    groupId: string,
    field: GroupField,
    value: string | number | null,
    scope: Scope,
    opts: SetOptions = {},
  ) {
    return run(async (tx, rec) => {
      if (field === "name" && (typeof value !== "string" || !value.trim())) throw new ChangeError("Name is required.");
      if (field === "min" && (typeof value !== "number" || value < 0)) throw new ChangeError("Min must be 0 or more.");
      if (field === "max" && value !== null && (typeof value !== "number" || value < 1)) throw new ChangeError("Max must be at least 1 (or no limit).");
      const g = await storeIdForGroup(tx, groupId);
      const { all, links, allLinks } = await linksForScope(tx, groupId, scope);
      const conflicts: Conflict[] = [];
      let reset = 0;

      if (all) {
        const col = { name: "name", min: "minSelect", max: "maxSelect" }[field];
        await rec.update("modifierGroup", groupId, { [col]: value });
        for (const l of allLinks) {
          const o = linkGroupOverride(l, field);
          if (!o.has) continue;
          if (o.value === value || opts.resetConflicts) {
            await rec.update("itemGroupLink", l.id, CLEAR_GROUP_FIELD[field]);
            if (o.value !== value) reset++;
          } else {
            conflicts.push({ linkId: l.id, itemId: l.itemId, itemName: l.item.name, value: o.value });
          }
        }
      } else {
        for (const l of links) await rec.update("itemGroupLink", l.id, groupOverrideData(g, field, value));
      }

      const what = field === "name" ? `${g.name} renamed to ${fmtValue(field, value)}` : `${g.name} ${FIELD_LABEL[field]} → ${fmtValue(field, value)}`;
      const extra = reset ? ` (reset ${reset} item${reset === 1 ? "" : "s"})` : "";
      return { storeId: g.storeId, summary: `${what} ${scopeText(all, links)}${extra}`, scope: scopeKind(all, links), conflicts };
    });
  }

  // ----- Modifier fields -----

  function setModifierField(modifierId: string, field: ModifierField, value: string | number, scope: Scope, opts: SetOptions = {}) {
    return run(async (tx, rec) => {
      if (field === "name" && (typeof value !== "string" || !value.trim())) throw new ChangeError("Name is required.");
      if (field !== "name" && (typeof value !== "number" || !Number.isInteger(value))) throw new ChangeError("Value must be a whole number.");
      const m = await getModifier(tx, modifierId);
      const { all, links } = await linksForScope(tx, m.groupId, scope);
      const conflicts: Conflict[] = [];
      let reset = 0;
      const col = MOD_FIELD_COLUMN[field];

      if (all) {
        await rec.update("modifier", modifierId, { [MOD_TEMPLATE_COLUMN[field]]: value });
        const updated = { ...m, [MOD_TEMPLATE_COLUMN[field]]: value };
        const ovs = await tx.modifierOverride.findMany({
          where: { modifierId, NOT: { [col]: null } },
          include: { link: { include: { item: { select: { name: true } } } } },
        });
        for (const o of ovs) {
          if (o[col] === value || opts.resetConflicts) {
            await writeModOverride(tx, rec, o.linkId, updated, { [col]: null });
            if (o[col] !== value) reset++;
          } else {
            conflicts.push({ linkId: o.linkId, itemId: o.link.itemId, itemName: o.link.item.name, value: o[col] });
          }
        }
      } else {
        for (const l of links) await writeModOverride(tx, rec, l.id, m, { [col]: value });
      }

      const what =
        field === "name"
          ? `"${m.name}" renamed to "${value}"`
          : field === "price"
            ? `${m.name} price → ${formatCents(value as number)}`
            : `${m.name} position → ${value}`;
      const extra = reset ? ` (reset ${reset} item${reset === 1 ? "" : "s"})` : "";
      return { storeId: m.group.storeId, summary: `${what} ${scopeText(all, links)}${extra}`, scope: scopeKind(all, links), conflicts };
    });
  }

  /** item/items scope: hide on those items. all scope: DELETE the template option (UI must confirm). */
  function hideModifier(modifierId: string, scope: Scope) {
    return run(async (tx, rec) => {
      const m = await getModifier(tx, modifierId);
      const { all, links } = await linksForScope(tx, m.groupId, scope);
      if (all) {
        await rec.delete("modifier", modifierId);
        return { storeId: m.group.storeId, summary: `Deleted option "${m.name}" from ${m.group.name} (all linked items)`, scope: "all" };
      }
      for (const l of links) await writeModOverride(tx, rec, l.id, m, { hidden: true });
      return { storeId: m.group.storeId, summary: `Hid "${m.name}" ${scopeText(false, links)}`, scope: scopeKind(false, links) };
    });
  }

  /** Un-hide an option on the scoped items (all = everywhere it is hidden). */
  function showModifier(modifierId: string, scope: Scope) {
    return run(async (tx, rec) => {
      const m = await getModifier(tx, modifierId);
      const { all, links } = await linksForScope(tx, m.groupId, scope);
      for (const l of links) await writeModOverride(tx, rec, l.id, m, { hidden: false });
      return { storeId: m.group.storeId, summary: `Showed "${m.name}" ${scopeText(all, links)}`, scope: scopeKind(all, links) };
    });
  }

  function addModifier(groupId: string, data: { name: string; priceCents: number }, scope: Scope) {
    return run(async (tx, rec) => {
      if (!data.name.trim()) throw new ChangeError("Name is required.");
      const g = await storeIdForGroup(tx, groupId);
      const { all, links } = await linksForScope(tx, groupId, scope);
      const label = `"${data.name}"${data.priceCents ? ` ${formatCents(data.priceCents)}` : ""}`;
      if (all) {
        await rec.create("modifier", { groupId, name: data.name.trim(), priceCents: data.priceCents, sortOrder: await nextSortOrder(g.modifiers) });
        return { storeId: g.storeId, summary: `Added option ${label} to ${g.name} (all linked items)`, scope: "all" };
      }
      for (const l of links) {
        const extras = await tx.linkExtraModifier.findMany({ where: { linkId: l.id } });
        const sortOrder = Math.max(await nextSortOrder(g.modifiers), await nextSortOrder(extras));
        await rec.create("linkExtraModifier", { linkId: l.id, name: data.name.trim(), priceCents: data.priceCents, sortOrder });
      }
      return { storeId: g.storeId, summary: `Added option ${label} to ${g.name} ${scopeText(false, links)}`, scope: scopeKind(false, links) };
    });
  }

  /** Stock is always global. */
  function setModifierStock(modifierId: string, inStock: boolean) {
    return run(async (tx, rec) => {
      const m = await getModifier(tx, modifierId);
      await rec.update("modifier", modifierId, { inStock });
      return { storeId: m.group.storeId, summary: `${m.name} (${m.group.name}) marked ${inStock ? "in stock" : "out of stock"} everywhere`, scope: "all" };
    });
  }

  // ----- Item-only extras -----

  function updateExtra(extraId: string, patch: Partial<{ name: string; priceCents: number; sortOrder: number; inStock: boolean }>) {
    return run(async (tx, rec) => {
      const e = await tx.linkExtraModifier.findUnique({ where: { id: extraId }, include: { link: { include: { item: true, group: true } } } });
      if (!e) throw new ChangeError("Option not found.");
      if (patch.name !== undefined && !patch.name.trim()) throw new ChangeError("Name is required.");
      await rec.update("linkExtraModifier", extraId, patch);
      const parts = [
        patch.name !== undefined && patch.name !== e.name ? `renamed to "${patch.name}"` : null,
        patch.priceCents !== undefined ? `price → ${formatCents(patch.priceCents)}` : null,
        patch.inStock !== undefined ? (patch.inStock ? "in stock" : "out of stock") : null,
        patch.sortOrder !== undefined ? `position → ${patch.sortOrder}` : null,
      ].filter(Boolean);
      return { storeId: e.link.group.storeId, summary: `"${e.name}" ${parts.join(", ")} on ${e.link.item.name} only`, scope: "item" };
    });
  }

  function deleteExtra(extraId: string) {
    return run(async (tx, rec) => {
      const e = await tx.linkExtraModifier.findUnique({ where: { id: extraId }, include: { link: { include: { item: true, group: true } } } });
      if (!e) throw new ChangeError("Option not found.");
      await rec.delete("linkExtraModifier", extraId);
      return { storeId: e.link.group.storeId, summary: `Removed option "${e.name}" from ${e.link.group.name} on ${e.link.item.name}`, scope: "item" };
    });
  }

  // ----- Reset / detach / link -----

  function resetOverrides(linkId: string, targets?: ResetTarget[]) {
    return run(async (tx, rec) => {
      const l = await getLink(tx, linkId);
      const storeId = l.group.storeId;
      if (!targets) {
        await rec.update("itemGroupLink", linkId, { nameOverride: null, minOverride: null, maxOverride: null, maxOverrideSet: false });
        for (const o of l.modOverrides) await rec.delete("modifierOverride", o.id);
        for (const e of l.extras) await rec.delete("linkExtraModifier", e.id);
        return { storeId, summary: `Reset ${l.group.name} on ${l.item.name} to shared`, scope: "item" };
      }
      const labels: string[] = [];
      for (const t of targets) {
        if (t.kind === "group") {
          await rec.update("itemGroupLink", linkId, CLEAR_GROUP_FIELD[t.field]);
          labels.push(`${l.group.name} ${FIELD_LABEL[t.field]}`);
        } else if (t.kind === "extras") {
          for (const e of l.extras) await rec.delete("linkExtraModifier", e.id);
          labels.push("item-only options");
        } else {
          const mod = l.group.modifiers.find((m) => m.id === t.modifierId);
          if (!mod) throw new ChangeError("Option not found.");
          const o = l.modOverrides.find((x) => x.modifierId === t.modifierId);
          if (!o) continue;
          if (!t.field) {
            await rec.delete("modifierOverride", o.id);
            labels.push(mod.name);
          } else if (t.field === "hidden") {
            await writeModOverride(tx, rec, linkId, mod, { hidden: false });
            labels.push(`${mod.name} visibility`);
          } else {
            await writeModOverride(tx, rec, linkId, mod, { [MOD_FIELD_COLUMN[t.field]]: null });
            labels.push(`${mod.name} ${FIELD_LABEL[t.field]}`);
          }
        }
      }
      return { storeId, summary: `Reset ${labels.join(", ")} on ${l.item.name} to shared`, scope: "item" };
    });
  }

  /** Turn an item's resolved group into a new independent group used only by that item. */
  function detachGroup(linkId: string) {
    return run(async (tx, rec) => {
      const l = await getLink(tx, linkId);
      const resolved = resolveGroup(l, l.group, l.modOverrides, l.extras, 0);
      const newName = `${resolved.name} (${l.item.name})`;
      const group = await rec.create<{ id: string }>("modifierGroup", {
        storeId: l.group.storeId,
        name: newName,
        minSelect: resolved.minSelect,
        maxSelect: resolved.maxSelect,
      });
      for (const [i, m] of resolved.modifiers.entries()) {
        await rec.create("modifier", { groupId: group.id, name: m.name, priceCents: m.priceCents, inStock: m.inStock, sortOrder: i });
      }
      for (const o of l.modOverrides) await rec.delete("modifierOverride", o.id);
      for (const e of l.extras) await rec.delete("linkExtraModifier", e.id);
      await rec.update("itemGroupLink", linkId, {
        groupId: group.id,
        nameOverride: null,
        minOverride: null,
        maxOverride: null,
        maxOverrideSet: false,
      });
      return { storeId: l.group.storeId, summary: `Detached ${l.group.name} on ${l.item.name} → new group "${newName}"`, scope: "item" };
    });
  }

  function linkGroup(itemIds: string[], groupId: string) {
    return run(async (tx, rec) => {
      const g = await storeIdForGroup(tx, groupId);
      const items = await tx.item.findMany({ where: { id: { in: itemIds } }, include: { groupLinks: true, category: true } });
      if (items.length !== new Set(itemIds).size) throw new ChangeError("Item not found.");
      const linked: string[] = [];
      for (const item of items) {
        if (item.category.storeId !== g.storeId) throw new ChangeError("Item and group belong to different stores.");
        if (item.groupLinks.some((l) => l.groupId === groupId)) continue;
        await rec.create("itemGroupLink", { itemId: item.id, groupId, sortOrder: await nextSortOrder(item.groupLinks) });
        linked.push(item.name);
      }
      return { storeId: g.storeId, summary: `Linked ${g.name} to ${linked.join(", ") || "no new items"}`, scope: linked.length > 1 ? "items" : "item" };
    });
  }

  function unlinkGroup(linkId: string) {
    return run(async (tx, rec) => {
      const l = await getLink(tx, linkId);
      await rec.delete("itemGroupLink", linkId);
      return { storeId: l.group.storeId, summary: `Unlinked ${l.group.name} from ${l.item.name}`, scope: "item" };
    });
  }

  // ----- Group templates -----

  function createGroup(
    storeId: string,
    data: { name: string; minSelect: number; maxSelect: number | null; modifiers?: { name: string; priceCents: number }[] },
    linkToItemId?: string,
  ) {
    return run(async (tx, rec) => {
      if (!data.name.trim()) throw new ChangeError("Name is required.");
      const g = await rec.create<{ id: string }>("modifierGroup", { storeId, name: data.name.trim(), minSelect: data.minSelect, maxSelect: data.maxSelect });
      for (const [i, m] of (data.modifiers ?? []).entries()) {
        await rec.create("modifier", { groupId: g.id, name: m.name, priceCents: m.priceCents, sortOrder: i });
      }
      let where = "";
      if (linkToItemId) {
        const item = await tx.item.findUnique({ where: { id: linkToItemId }, include: { groupLinks: true } });
        if (!item) throw new ChangeError("Item not found.");
        await rec.create("itemGroupLink", { itemId: item.id, groupId: g.id, sortOrder: await nextSortOrder(item.groupLinks) });
        where = ` and linked it to ${item.name}`;
      }
      return { storeId, summary: `Created group "${data.name.trim()}"${where}`, scope: "none" };
    });
  }

  function deleteGroup(groupId: string) {
    return run(async (tx, rec) => {
      const g = await storeIdForGroup(tx, groupId);
      await rec.delete("modifierGroup", groupId);
      return { storeId: g.storeId, summary: `Deleted group "${g.name}"`, scope: "all" };
    });
  }

  // ----- Items & categories (never shared) -----

  type ItemData = {
    name: string;
    description: string | null;
    priceCents: number;
    taxable: boolean;
    isAvailable: boolean;
    imageUrl: string | null;
    sortOrder: number;
    categoryId: string;
  };

  function createItem(categoryId: string, data: Pick<ItemData, "name" | "priceCents"> & Partial<ItemData>) {
    return run(async (tx, rec) => {
      const cat = await tx.category.findUnique({ where: { id: categoryId }, include: { items: true } });
      if (!cat) throw new ChangeError("Category not found.");
      if (!data.name.trim()) throw new ChangeError("Name is required.");
      await rec.create("item", { sortOrder: await nextSortOrder(cat.items), ...data, name: data.name.trim(), categoryId });
      return { storeId: cat.storeId, summary: `Added item "${data.name.trim()}" to ${cat.name}`, scope: "none" };
    });
  }

  function updateItem(itemId: string, patch: Partial<ItemData>) {
    return run(async (tx, rec) => {
      const item = await tx.item.findUnique({ where: { id: itemId }, include: { category: true } });
      if (!item) throw new ChangeError("Item not found.");
      if (patch.name !== undefined && !patch.name.trim()) throw new ChangeError("Name is required.");
      await rec.update("item", itemId, patch);
      const parts: string[] = [];
      if (patch.name !== undefined && patch.name !== item.name) parts.push(`renamed to "${patch.name}"`);
      if (patch.priceCents !== undefined && patch.priceCents !== item.priceCents) parts.push(`price → ${formatCents(patch.priceCents)}`);
      if (patch.isAvailable !== undefined && patch.isAvailable !== item.isAvailable) parts.push(patch.isAvailable ? "available" : "unavailable");
      if (patch.taxable !== undefined && patch.taxable !== item.taxable) parts.push(patch.taxable ? "taxable" : "not taxable");
      if (patch.description !== undefined && patch.description !== item.description) parts.push("description updated");
      if (patch.imageUrl !== undefined && patch.imageUrl !== item.imageUrl) parts.push("image updated");
      if (patch.sortOrder !== undefined && patch.sortOrder !== item.sortOrder) parts.push(`position → ${patch.sortOrder}`);
      if (patch.categoryId !== undefined && patch.categoryId !== item.categoryId) parts.push("moved category");
      return { storeId: item.category.storeId, summary: `${item.name}: ${parts.join(", ") || "updated"}`, scope: "none" };
    });
  }

  function deleteItem(itemId: string) {
    return run(async (tx, rec) => {
      const item = await tx.item.findUnique({ where: { id: itemId }, include: { category: true } });
      if (!item) throw new ChangeError("Item not found.");
      await rec.delete("item", itemId);
      return { storeId: item.category.storeId, summary: `Deleted item "${item.name}"`, scope: "none" };
    });
  }

  function createCategory(storeId: string, data: { name: string; description?: string | null }) {
    return run(async (tx, rec) => {
      if (!data.name.trim()) throw new ChangeError("Name is required.");
      const cats = await tx.category.findMany({ where: { storeId } });
      await rec.create("category", { storeId, name: data.name.trim(), description: data.description ?? null, sortOrder: await nextSortOrder(cats) });
      return { storeId, summary: `Added category "${data.name.trim()}"`, scope: "none" };
    });
  }

  function updateCategory(categoryId: string, patch: Partial<{ name: string; description: string | null; sortOrder: number; isActive: boolean }>) {
    return run(async (tx, rec) => {
      const cat = await tx.category.findUnique({ where: { id: categoryId } });
      if (!cat) throw new ChangeError("Category not found.");
      if (patch.name !== undefined && !patch.name.trim()) throw new ChangeError("Name is required.");
      await rec.update("category", categoryId, patch);
      return { storeId: cat.storeId, summary: `Category "${cat.name}" updated`, scope: "none" };
    });
  }

  function deleteCategory(categoryId: string) {
    return run(async (tx, rec) => {
      const cat = await tx.category.findUnique({ where: { id: categoryId } });
      if (!cat) throw new ChangeError("Category not found.");
      await rec.delete("category", categoryId);
      return { storeId: cat.storeId, summary: `Deleted category "${cat.name}"`, scope: "none" };
    });
  }

  // ----- Undo -----

  /** Undo a change. Only the most recent unpublished, non-undone change can be undone (stack order). */
  async function undo(changeId: string): Promise<ChangeResult> {
    try {
      return await db.$transaction(async (tx) => {
        const log = await tx.changeLog.findUnique({ where: { id: changeId } });
        if (!log) throw new ChangeError("Change not found.");
        if (log.undone) throw new ChangeError("That change was already undone.");
        if (log.versionId) throw new ChangeError("Published changes can't be undone.");
        const latest = await tx.changeLog.findFirst({
          where: { storeId: log.storeId, undone: false, versionId: null },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        });
        if (latest?.id !== log.id) throw new ChangeError("Undo the newer changes first.");

        const before = log.before as Snapshot;
        const after = log.after as Snapshot;
        // 1. Delete rows this change created (children first).
        for (const m of [...MODELS].reverse()) {
          const beforeIds = new Set((before[m] ?? []).map((r) => r.id));
          const created = (after[m] ?? []).map((r) => r.id).filter((id) => !beforeIds.has(id));
          if (created.length) await delegate(tx, m).deleteMany({ where: { id: { in: created } } });
        }
        // 2. Restore every pre-change row (parents first).
        for (const m of MODELS) {
          for (const row of before[m] ?? []) {
            await delegate(tx, m).upsert({ where: { id: row.id }, create: row, update: row });
          }
        }
        await tx.changeLog.update({ where: { id: log.id }, data: { undone: true } });
        return { ok: true as const, changeId: log.id, summary: `Undid: ${log.summary}` };
      });
    } catch (e) {
      if (e instanceof ChangeError) return { ok: false, error: e.message };
      throw e;
    }
  }

  // ----- Publish -----

  /**
   * Snapshot the current draft as a new MenuVersion and mark every pending change as published.
   * Refused when nothing changed since the last version (the first publish is always allowed).
   */
  async function publish(storeId: string, note?: string | null): Promise<PublishResult> {
    try {
      return await db.$transaction(async (tx) => {
        const store = await tx.store.findUnique({ where: { id: storeId } });
        if (!store) throw new ChangeError("Store not found.");
        const pending = await tx.changeLog.count({ where: { storeId, versionId: null, undone: false } });
        const last = await tx.menuVersion.findFirst({ where: { storeId }, orderBy: { versionNumber: "desc" } });
        if (last && pending === 0) throw new ChangeError("Nothing to publish — there are no unpublished changes.");

        const storeInput = await loadStoreInput(tx, storeId);
        const resolved = toPublicMenu(resolveMenu(storeInput!));
        const raw = await loadRawSnapshot(tx, storeId);
        const versionNumber = (last?.versionNumber ?? 0) + 1;
        const version = await tx.menuVersion.create({
          data: {
            storeId,
            versionNumber,
            note: note?.trim() || null,
            rawSnapshot: raw as Prisma.InputJsonValue,
            resolvedSnapshot: resolved as unknown as Prisma.InputJsonValue,
          },
        });
        // Undone changes are swept into the version too, so they leave the pending list.
        await tx.changeLog.updateMany({ where: { storeId, versionId: null }, data: { versionId: version.id } });
        return { ok: true as const, versionId: version.id, versionNumber, changeCount: pending, summary: `Published version ${versionNumber} (${pending} change${pending === 1 ? "" : "s"})` };
      });
    } catch (e) {
      if (e instanceof ChangeError) return { ok: false, error: e.message };
      throw e;
    }
  }

  /** Most recent change that `undo` would accept, if any. */
  async function latestUndoable(storeId: string) {
    return db.changeLog.findFirst({
      where: { storeId, undone: false, versionId: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  return {
    getGroupFieldConflicts,
    getModifierFieldConflicts,
    setGroupField,
    setModifierField,
    hideModifier,
    showModifier,
    addModifier,
    setModifierStock,
    updateExtra,
    deleteExtra,
    resetOverrides,
    detachGroup,
    linkGroup,
    unlinkGroup,
    createGroup,
    deleteGroup,
    createItem,
    updateItem,
    deleteItem,
    createCategory,
    updateCategory,
    deleteCategory,
    undo,
    latestUndoable,
    publish,
  };
}

export type ChangeEngine = ReturnType<typeof createChangeEngine>;

let defaultEngine: ChangeEngine | undefined;
/** The engine bound to the app's shared Prisma client. */
export function changes(): ChangeEngine {
  return (defaultEngine ??= createChangeEngine(getPrisma()));
}
