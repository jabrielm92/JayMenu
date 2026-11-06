"use server";
/**
 * Server actions for the editor. Every write goes through lib/menu/changes.ts;
 * every input is validated with Zod.
 */
import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guard";
import { changes, type ChangeResult, type Conflict, type PublishResult } from "@/lib/menu/changes";

const id = z.string().min(1).max(64);
const cents = z.number().int().min(-1_000_000).max(10_000_000);
const name = z.string().trim().min(1, "Name is required").max(120);
const groupField = z.enum(["name", "min", "max"]);
const modField = z.enum(["name", "price", "sortOrder"]);
const scope = z.discriminatedUnion("type", [
  z.object({ type: z.literal("item"), itemId: id }),
  z.object({ type: z.literal("items"), itemIds: z.array(id).min(1) }),
  z.object({ type: z.literal("all") }),
]);
const setOpts = z.object({ resetConflicts: z.boolean().optional() }).optional();

type Fail = { ok: false; error: string };

async function act<S extends z.ZodType>(
  schema: S,
  input: unknown,
  fn: (data: z.infer<S>) => Promise<ChangeResult>,
): Promise<ChangeResult> {
  await requireAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" } satisfies Fail;
  const result = await fn(parsed.data);
  if (result.ok) refresh();
  return result;
}

// ----- Conflict previews (read-only) -----

export async function getGroupConflictsAction(input: { groupId: string; field: "name" | "min" | "max"; value: string | number | null }): Promise<Conflict[]> {
  await requireAdmin();
  const d = z.object({ groupId: id, field: groupField, value: z.union([z.string(), z.number(), z.null()]) }).parse(input);
  return changes().getGroupFieldConflicts(d.groupId, d.field, d.value);
}

export async function getModifierConflictsAction(input: { modifierId: string; field: "name" | "price" | "sortOrder"; value: string | number }): Promise<Conflict[]> {
  await requireAdmin();
  const d = z.object({ modifierId: id, field: modField, value: z.union([z.string(), z.number()]) }).parse(input);
  return changes().getModifierFieldConflicts(d.modifierId, d.field, d.value);
}

// ----- Group & modifier edits -----

const groupValue = z.object({ field: groupField, value: z.union([z.string(), z.number(), z.null()]) }).superRefine((v, ctx) => {
  if (v.field === "name" && (typeof v.value !== "string" || !v.value.trim())) ctx.addIssue({ code: "custom", message: "Name is required" });
  if (v.field === "min" && !(typeof v.value === "number" && Number.isInteger(v.value) && v.value >= 0 && v.value <= 99)) ctx.addIssue({ code: "custom", message: "Min must be a whole number 0–99" });
  if (v.field === "max" && v.value !== null && !(typeof v.value === "number" && Number.isInteger(v.value) && v.value >= 1 && v.value <= 99)) ctx.addIssue({ code: "custom", message: "Max must be 1–99 or no limit" });
});

export async function setGroupFieldAction(input: unknown) {
  return act(z.object({ groupId: id, scope, opts: setOpts }).and(groupValue), input, (d) =>
    changes().setGroupField(d.groupId, d.field, typeof d.value === "string" ? d.value.trim() : d.value, d.scope, d.opts),
  );
}

const modValue = z.discriminatedUnion("field", [
  z.object({ field: z.literal("name"), value: name }),
  z.object({ field: z.literal("price"), value: cents }),
  z.object({ field: z.literal("sortOrder"), value: z.number().int().min(-1000).max(100000) }),
]);

export async function setModifierFieldAction(input: unknown) {
  return act(z.object({ modifierId: id, scope, opts: setOpts }).and(modValue), input, (d) =>
    changes().setModifierField(d.modifierId, d.field, d.value, d.scope, d.opts),
  );
}

export async function hideModifierAction(input: unknown) {
  return act(z.object({ modifierId: id, scope }), input, (d) => changes().hideModifier(d.modifierId, d.scope));
}

export async function showModifierAction(input: unknown) {
  return act(z.object({ modifierId: id, scope }), input, (d) => changes().showModifier(d.modifierId, d.scope));
}

export async function addModifierAction(input: unknown) {
  return act(z.object({ groupId: id, name, priceCents: cents, scope }), input, (d) =>
    changes().addModifier(d.groupId, { name: d.name, priceCents: d.priceCents }, d.scope),
  );
}

export async function setModifierStockAction(input: unknown) {
  return act(z.object({ modifierId: id, inStock: z.boolean() }), input, (d) => changes().setModifierStock(d.modifierId, d.inStock));
}

export async function updateExtraAction(input: unknown) {
  return act(
    z.object({
      extraId: id,
      patch: z.object({ name: name.optional(), priceCents: cents.optional(), inStock: z.boolean().optional(), sortOrder: z.number().int().optional() }),
    }),
    input,
    (d) => changes().updateExtra(d.extraId, d.patch),
  );
}

export async function deleteExtraAction(input: unknown) {
  return act(z.object({ extraId: id }), input, (d) => changes().deleteExtra(d.extraId));
}

// ----- Reset / detach / link -----

const resetTarget = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("group"), field: groupField }),
  z.object({ kind: z.literal("modifier"), modifierId: id, field: z.enum(["name", "price", "sortOrder", "hidden"]).optional() }),
  z.object({ kind: z.literal("extras") }),
]);

export async function resetOverridesAction(input: unknown) {
  return act(z.object({ linkId: id, targets: z.array(resetTarget).optional() }), input, (d) => changes().resetOverrides(d.linkId, d.targets));
}

export async function detachGroupAction(input: unknown) {
  return act(z.object({ linkId: id }), input, (d) => changes().detachGroup(d.linkId));
}

export async function linkGroupAction(input: unknown) {
  return act(z.object({ itemIds: z.array(id).min(1), groupId: id }), input, (d) => changes().linkGroup(d.itemIds, d.groupId));
}

export async function unlinkGroupAction(input: unknown) {
  return act(z.object({ linkId: id }), input, (d) => changes().unlinkGroup(d.linkId));
}

export async function createGroupAction(input: unknown) {
  return act(
    z.object({
      storeId: id,
      name,
      minSelect: z.number().int().min(0).max(99),
      maxSelect: z.number().int().min(1).max(99).nullable(),
      modifiers: z.array(z.object({ name, priceCents: cents })).max(100).optional(),
      linkToItemId: id.optional(),
    }),
    input,
    (d) => changes().createGroup(d.storeId, d, d.linkToItemId),
  );
}

export async function deleteGroupAction(input: unknown) {
  return act(z.object({ groupId: id }), input, (d) => changes().deleteGroup(d.groupId));
}

// ----- Items & categories -----

const itemPatch = z.object({
  name: name.optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  priceCents: z.number().int().min(0).max(10_000_000).optional(),
  taxable: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  imageUrl: z.union([z.url().max(2000), z.null()]).optional(),
  sortOrder: z.number().int().optional(),
  categoryId: id.optional(),
});

export async function createItemAction(input: unknown) {
  return act(z.object({ categoryId: id, name, priceCents: z.number().int().min(0).max(10_000_000) }), input, (d) =>
    changes().createItem(d.categoryId, { name: d.name, priceCents: d.priceCents }),
  );
}

export async function updateItemAction(input: unknown) {
  return act(z.object({ itemId: id, patch: itemPatch }), input, (d) => changes().updateItem(d.itemId, d.patch));
}

export async function deleteItemAction(input: unknown) {
  return act(z.object({ itemId: id }), input, (d) => changes().deleteItem(d.itemId));
}

export async function createCategoryAction(input: unknown) {
  return act(z.object({ storeId: id, name }), input, (d) => changes().createCategory(d.storeId, { name: d.name }));
}

export async function updateCategoryAction(input: unknown) {
  return act(
    z.object({
      categoryId: id,
      patch: z.object({ name: name.optional(), description: z.string().trim().max(1000).nullable().optional(), isActive: z.boolean().optional(), sortOrder: z.number().int().optional() }),
    }),
    input,
    (d) => changes().updateCategory(d.categoryId, d.patch),
  );
}

export async function deleteCategoryAction(input: unknown) {
  return act(z.object({ categoryId: id }), input, (d) => changes().deleteCategory(d.categoryId));
}

// ----- Undo -----

export async function undoAction(input: unknown) {
  return act(z.object({ changeId: id }), input, (d) => changes().undo(d.changeId));
}

// ----- Publish -----

export async function publishAction(input: unknown): Promise<PublishResult> {
  await requireAdmin();
  const parsed = z.object({ storeId: id, note: z.string().trim().max(500).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const result = await changes().publish(parsed.data.storeId, parsed.data.note);
  if (result.ok) refresh();
  return result;
}
