// Declarative store seeder: describe a store as plain data, get it created (wipe-and-recreate).
// Throws on any unknown item / group / modifier name so specs can't silently drift.
import type { PrismaClient } from "../lib/generated/prisma/client";

/** [name, priceCents] or [name, priceCents, { inStock: false }] */
export type OptionSpec = [string, number] | [string, number, { inStock?: boolean }];

export type GroupSpec = { name: string; min: number; max: number | null; options: OptionSpec[] };

export type ItemSpec = {
  name: string;
  price: number;
  description?: string;
  /** Group names, in display order. */
  groups: string[];
  available?: boolean;
};

export type CategorySpec = { name: string; description?: string; items: ItemSpec[] };

/** Per-item customizations, applied on the item ↔ group link (never on the shared group). */
export type OverrideSpec =
  | { kind: "modifier"; item: string; group: string; modifier: string; price?: number; name?: string; hidden?: boolean }
  | { kind: "extra"; item: string; group: string; name: string; price: number }
  | { kind: "group"; item: string; group: string; name?: string; min?: number; max?: number | null };

export type StoreSpec = {
  id: string;
  name: string;
  taxRatePct: string;
  groups: GroupSpec[];
  categories: CategorySpec[];
  overrides: OverrideSpec[];
};

export async function seedStore(prisma: PrismaClient, spec: StoreSpec) {
  // Validate before touching the database.
  const groupNames = new Set(spec.groups.map((g) => g.name));
  const itemNames = new Set<string>();
  for (const c of spec.categories)
    for (const i of c.items) {
      if (itemNames.has(i.name)) throw new Error(`Duplicate item name "${i.name}"`);
      itemNames.add(i.name);
      for (const g of i.groups) if (!groupNames.has(g)) throw new Error(`Item "${i.name}" uses unknown group "${g}"`);
    }

  await prisma.store.deleteMany({ where: { id: spec.id } });
  const store = await prisma.store.create({ data: { id: spec.id, name: spec.name, taxRatePct: spec.taxRatePct } });

  const groupIds = new Map<string, string>();
  const modIds = new Map<string, Map<string, { id: string; sortOrder: number }>>();
  for (const g of spec.groups) {
    const created = await prisma.modifierGroup.create({
      data: {
        storeId: store.id,
        name: g.name,
        minSelect: g.min,
        maxSelect: g.max,
        modifiers: {
          create: g.options.map(([name, priceCents, opts], i) => ({ name, priceCents, sortOrder: i, inStock: opts?.inStock ?? true })),
        },
      },
      include: { modifiers: true },
    });
    groupIds.set(g.name, created.id);
    modIds.set(g.name, new Map(created.modifiers.map((m) => [m.name, { id: m.id, sortOrder: m.sortOrder }])));
  }

  const linkIds = new Map<string, string>(); // `${item}|${group}` → linkId
  for (const [ci, c] of spec.categories.entries()) {
    const category = await prisma.category.create({
      data: { storeId: store.id, name: c.name, description: c.description, sortOrder: ci },
    });
    for (const [ii, i] of c.items.entries()) {
      const item = await prisma.item.create({
        data: {
          categoryId: category.id,
          name: i.name,
          description: i.description,
          priceCents: i.price,
          isAvailable: i.available ?? true,
          sortOrder: ii,
          groupLinks: { create: i.groups.map((g, gi) => ({ groupId: groupIds.get(g)!, sortOrder: gi })) },
        },
        include: { groupLinks: true },
      });
      for (const l of item.groupLinks) linkIds.set(`${i.name}|${i.groups[l.sortOrder]}`, l.id);
    }
  }

  const extraCount = new Map<string, number>();
  for (const o of spec.overrides) {
    const linkId = linkIds.get(`${o.item}|${o.group}`);
    if (!linkId) throw new Error(`Override: "${o.item}" is not linked to "${o.group}"`);
    if (o.kind === "group") {
      await prisma.itemGroupLink.update({
        where: { id: linkId },
        data: {
          nameOverride: o.name ?? null,
          minOverride: o.min ?? null,
          ...(o.max !== undefined ? { maxOverride: o.max, maxOverrideSet: true } : {}),
        },
      });
    } else if (o.kind === "extra") {
      const n = extraCount.get(linkId) ?? 0;
      extraCount.set(linkId, n + 1);
      await prisma.linkExtraModifier.create({ data: { linkId, name: o.name, priceCents: o.price, sortOrder: 100 + n } });
    } else {
      const mod = modIds.get(o.group)?.get(o.modifier);
      if (!mod) throw new Error(`Override: "${o.group}" has no option "${o.modifier}"`);
      await prisma.modifierOverride.upsert({
        where: { linkId_modifierId: { linkId, modifierId: mod.id } },
        create: { linkId, modifierId: mod.id, priceCentsOverride: o.price ?? null, nameOverride: o.name ?? null, hidden: o.hidden ?? false },
        update: {
          ...(o.price !== undefined ? { priceCentsOverride: o.price } : {}),
          ...(o.name !== undefined ? { nameOverride: o.name } : {}),
          ...(o.hidden !== undefined ? { hidden: o.hidden } : {}),
        },
      });
    }
  }
  return store;
}
