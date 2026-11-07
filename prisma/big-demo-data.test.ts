import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadResolvedMenu } from "@/lib/menu/load";
import { summarizeTemplates, type ResolvedMenu } from "@/lib/menu/resolve";
import { db } from "@/test/db";
import { BIG_DEMO, BIG_DEMO_STORE_ID, seedBigDemo } from "./big-demo-data";

let menu: ResolvedMenu;
const items = () => menu.categories.flatMap((c) => c.items);
const group = (item: string, groupName: string) => {
  const i = items().find((x) => x.name === item)!;
  return i.groups.find((g) => g.groupId === groupIdByName.get(groupName))!;
};
const groupIdByName = new Map<string, string>();

beforeAll(async () => {
  await seedBigDemo(db, { quiet: true });
  await seedBigDemo(db, { quiet: true }); // idempotent
  menu = (await loadResolvedMenu(db, BIG_DEMO_STORE_ID))!;
  for (const g of await db.modifierGroup.findMany({ where: { storeId: BIG_DEMO_STORE_ID } })) groupIdByName.set(g.name, g.id);
});

afterAll(async () => {
  await db.store.deleteMany({ where: { id: BIG_DEMO_STORE_ID } });
  await db.$disconnect();
});

describe("Big Demo Diner seed", () => {
  it("is a large menu with heavily shared group modifiers", async () => {
    expect(menu.categories.length).toBeGreaterThanOrEqual(10);
    expect(items().length).toBeGreaterThanOrEqual(60);
    expect(groupIdByName.size).toBe(BIG_DEMO.groups.length);
    const groups = await db.modifierGroup.findMany({ where: { storeId: BIG_DEMO_STORE_ID }, include: { modifiers: true } });
    const summary = summarizeTemplates(menu, groups);
    const busiest = Math.max(...summary.map((t) => t.usedBy));
    expect(busiest).toBeGreaterThanOrEqual(15);
    expect(summary.filter((t) => t.usedBy >= 10).length).toBeGreaterThanOrEqual(4);
    expect(summary.every((t) => t.usedBy > 0)).toBe(true);
  });

  it("every group resolves without validation warnings", () => {
    const warnings = items().flatMap((i) => i.groups.flatMap((g) => g.warnings.map((w) => `${i.name} / ${g.name}: ${w}`)));
    expect(warnings).toEqual([]);
  });

  it("item-only customizations stay on their item", () => {
    expect(group("Steak & Eggs", "Choice of Meat").modifiers.find((m) => m.name === "Bacon")?.priceCents).toBe(150);
    expect(group("Two Eggs w/ Meat", "Choice of Meat").modifiers.find((m) => m.name === "Bacon")?.priceCents).toBe(0);
    expect(group("Breakfast Burrito", "Choice of Meat").modifiers.map((m) => m.name)).toContain("Chorizo");
    expect(group("Meat Omelette", "Choice of Meat").modifiers.map((m) => m.name)).not.toContain("Chorizo");
    expect(group("Biscuits & Gravy", "Choice of Meat")).toMatchObject({ name: "Add a Side of Meat", minSelect: 0, isCustomized: true });
    expect(group("Waffle & Meat", "Choice of Meat")).toMatchObject({ name: "Choice of Meat", minSelect: 1, isCustomized: false });
    expect(group("Wings (12 pc)", "Wing Sauce").maxSelect).toBe(3);
    expect(group("Wings (6 pc)", "Wing Sauce").maxSelect).toBe(2);
  });

  it("stock is global: Real Maple Syrup is out of stock on every item", () => {
    for (const i of items())
      for (const g of i.groups)
        for (const m of g.modifiers.filter((x) => x.name === "Real Maple Syrup")) expect(m.inStock).toBe(false);
  });
});
