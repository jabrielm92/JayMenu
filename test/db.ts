// Helpers for tests that run against the test database (see test/global-setup.ts).
import { createPrismaClient } from "@/lib/db";
import { loadResolvedMenu } from "@/lib/menu/load";
import type { ResolvedGroup, ResolvedItem } from "@/lib/menu/resolve";
import { DEMO_STORE_ID, seedDemo } from "@/prisma/demo-data";
import { TEST_DATABASE_URL } from "./global-setup";

export const db = createPrismaClient(TEST_DATABASE_URL);
export { DEMO_STORE_ID };

export async function reseed() {
  await seedDemo(db, { quiet: true });
}

export async function menu() {
  const m = await loadResolvedMenu(db, DEMO_STORE_ID);
  if (!m) throw new Error("Demo store missing");
  return m;
}

export async function item(name: string): Promise<ResolvedItem> {
  const m = await menu();
  const found = m.categories.flatMap((c) => c.items).find((i) => i.name === name);
  if (!found) throw new Error(`Item ${name} not found`);
  return found;
}

export async function group(itemName: string, groupName: string): Promise<ResolvedGroup> {
  const i = await item(itemName);
  const g = i.groups.find((x) => x.name === groupName || x.name.startsWith(groupName));
  if (!g) throw new Error(`Group ${groupName} not on ${itemName}`);
  return g;
}

export const price = (g: ResolvedGroup, name: string) => g.modifiers.find((m) => m.name === name)?.priceCents;
export const names = (g: ResolvedGroup) => g.modifiers.map((m) => m.name);

export async function ids() {
  const items = await db.item.findMany({ where: { category: { storeId: DEMO_STORE_ID } } });
  const groups = await db.modifierGroup.findMany({ where: { storeId: DEMO_STORE_ID }, include: { modifiers: true } });
  const itemId = (n: string) => items.find((i) => i.name === n)!.id;
  const g = (n: string) => groups.find((x) => x.name === n)!;
  const mod = (gn: string, mn: string) => g(gn).modifiers.find((m) => m.name === mn)!.id;
  const link = async (itemName: string, groupName: string) =>
    (await db.itemGroupLink.findUniqueOrThrow({ where: { itemId_groupId: { itemId: itemId(itemName), groupId: g(groupName).id } } })).id;
  return { itemId, groupId: (n: string) => g(n).id, mod, link };
}

/** Full raw dump of the demo store's menu rows (for exact-state comparisons). */
export async function dump() {
  const groups = await db.modifierGroup.findMany({ where: { storeId: DEMO_STORE_ID }, orderBy: { id: "asc" } });
  const groupIds = groups.map((g) => g.id);
  const cats = await db.category.findMany({ where: { storeId: DEMO_STORE_ID }, orderBy: { id: "asc" } });
  const items = await db.item.findMany({ where: { categoryId: { in: cats.map((c) => c.id) } }, orderBy: { id: "asc" } });
  const links = await db.itemGroupLink.findMany({ where: { groupId: { in: groupIds } }, orderBy: { id: "asc" } });
  const linkIds = links.map((l) => l.id);
  return {
    cats,
    items,
    groups,
    modifiers: await db.modifier.findMany({ where: { groupId: { in: groupIds } }, orderBy: { id: "asc" } }),
    links,
    overrides: await db.modifierOverride.findMany({ where: { linkId: { in: linkIds } }, orderBy: { id: "asc" } }),
    extras: await db.linkExtraModifier.findMany({ where: { linkId: { in: linkIds } }, orderBy: { id: "asc" } }),
  };
}
