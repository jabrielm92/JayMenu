import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createChangeEngine } from "./changes";
import { DEMO_STORE_ID, db, dump, group, ids, item, names, price, reseed } from "@/test/db";

const engine = createChangeEngine(db);
const PROTEIN_ITEMS = ["Two Eggs w/ Meat", "Meat Omelette", "Waffle & Meat", "Steak & Eggs", "Meat & Egg Sandwich"];

beforeEach(reseed);
afterAll(() => db.$disconnect());

async function proteinPrices(modName: string) {
  return Object.fromEntries(await Promise.all(PROTEIN_ITEMS.map(async (n) => [n, price(await group(n, "Protein"), modName)])));
}

describe("must-have: item-only edit", () => {
  it("Bacon price on Steak & Eggs (scope item) leaves every other item unchanged", async () => {
    const { mod, itemId } = await ids();
    const before = await Promise.all(PROTEIN_ITEMS.filter((n) => n !== "Meat Omelette" && n !== "Steak & Eggs").map((n) => group(n, "Protein")));
    const omeletteBefore = await group("Meat Omelette", "Protein");
    const templateBefore = await db.modifier.findUniqueOrThrow({ where: { id: mod("Protein", "Bacon") } });

    const r = await engine.setModifierField(mod("Protein", "Bacon"), "price", 200, { type: "item", itemId: itemId("Steak & Eggs") });
    expect(r).toMatchObject({ ok: true, summary: "Bacon price → $2.00 on Steak & Eggs only" });

    expect(price(await group("Steak & Eggs", "Protein"), "Bacon")).toBe(200);
    const after = await Promise.all(PROTEIN_ITEMS.filter((n) => n !== "Meat Omelette" && n !== "Steak & Eggs").map((n) => group(n, "Protein")));
    expect(after).toEqual(before);
    expect(await group("Meat Omelette", "Protein")).toEqual(omeletteBefore);
    // "This item only" never touches template rows.
    expect(await db.modifier.findUniqueOrThrow({ where: { id: mod("Protein", "Bacon") } })).toEqual(templateBefore);
  });

  it("override equal to the template value is deleted, not stored", async () => {
    const { mod, itemId, link } = await ids();
    await engine.setModifierField(mod("Protein", "Bacon"), "price", 0, { type: "item", itemId: itemId("Steak & Eggs") });
    const ov = await db.modifierOverride.findUnique({ where: { linkId_modifierId: { linkId: await link("Steak & Eggs", "Protein"), modifierId: mod("Protein", "Bacon") } } });
    expect(ov).toBeNull();
  });

  it("'choose items' only changes the checked items", async () => {
    const { mod, itemId } = await ids();
    await engine.setModifierField(mod("Protein", "Turkey Bacon"), "price", 75, { type: "items", itemIds: [itemId("Waffle & Meat"), itemId("Two Eggs w/ Meat")] });
    const p = await proteinPrices("Turkey Bacon");
    expect(p).toEqual({ "Two Eggs w/ Meat": 75, "Meat Omelette": 0, "Waffle & Meat": 75, "Steak & Eggs": 0, "Meat & Egg Sandwich": 0 });
  });

  it("'items' scope covering every linked item is treated as 'all'", async () => {
    const { mod, itemId } = await ids();
    const r = await engine.setModifierField(mod("Protein", "Scrapple"), "price", 25, { type: "items", itemIds: PROTEIN_ITEMS.map(itemId) });
    expect(r).toMatchObject({ ok: true });
    expect((await db.modifier.findUniqueOrThrow({ where: { id: mod("Protein", "Scrapple") } })).priceCents).toBe(25);
  });

  it("rejects an item that is not linked to the group", async () => {
    const { mod, itemId } = await ids();
    const r = await engine.setModifierField(mod("Protein", "Bacon"), "price", 1, { type: "item", itemId: itemId("BLT") });
    expect(r.ok).toBe(false);
  });
});

describe("must-have: 'all' scope with conflicts", () => {
  it("template Bacon price updates everyone except overridden items, returned as conflicts", async () => {
    const { mod } = await ids();
    const r = await engine.setModifierField(mod("Protein", "Bacon"), "price", 75, { type: "all" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.conflicts).toEqual([expect.objectContaining({ itemName: "Steak & Eggs", value: 150 })]);
    expect(await proteinPrices("Bacon")).toEqual({
      "Two Eggs w/ Meat": 75,
      "Meat Omelette": 75,
      "Waffle & Meat": 75,
      "Steak & Eggs": 150,
      "Meat & Egg Sandwich": 75,
    });
  });

  it("getModifierFieldConflicts previews the same conflicts without writing", async () => {
    const { mod } = await ids();
    const c = await engine.getModifierFieldConflicts(mod("Protein", "Bacon"), "price", 75);
    expect(c.map((x) => x.itemName)).toEqual(["Steak & Eggs"]);
    expect(await db.changeLog.count()).toBe(0);
  });

  it("resetConflicts also clears the items' own values in the same change", async () => {
    const { mod } = await ids();
    const r = await engine.setModifierField(mod("Protein", "Bacon"), "price", 75, { type: "all" }, { resetConflicts: true });
    expect(r).toMatchObject({ ok: true, summary: "Bacon price → $0.75 on all linked items (reset 1 item)" });
    expect(Object.values(await proteinPrices("Bacon"))).toEqual([75, 75, 75, 75, 75]);
    expect(await db.changeLog.count()).toBe(1);
    // Scrapple stays hidden on Steak & Eggs — only the price override was cleared.
    expect(names(await group("Steak & Eggs", "Protein"))).not.toContain("Scrapple");
  });

  it("template change to the item's own value cleans that override instead of conflicting", async () => {
    const { mod } = await ids();
    const r = await engine.setModifierField(mod("Protein", "Bacon"), "price", 150, { type: "all" });
    expect(r.ok && r.conflicts).toBeFalsy();
    expect((await group("Steak & Eggs", "Protein")).modifiers.find((m) => m.name === "Bacon")?.overridden).toEqual([]);
  });

  it("group min with scope all returns links with their own min as conflicts", async () => {
    const { groupId, itemId } = await ids();
    await engine.setGroupField(groupId("Protein"), "min", 0, { type: "item", itemId: itemId("Waffle & Meat") });
    const r = await engine.setGroupField(groupId("Protein"), "min", 2, { type: "all" });
    expect(r.ok && r.conflicts?.map((c) => c.itemName)).toEqual(["Waffle & Meat"]);
    expect((await group("Waffle & Meat", "Protein")).minSelect).toBe(0);
    expect((await group("Two Eggs w/ Meat", "Protein")).minSelect).toBe(2);
  });
});

describe("group fields", () => {
  it("item-only max 'no limit' and name override", async () => {
    const { groupId, itemId } = await ids();
    await engine.setGroupField(groupId("Protein"), "max", null, { type: "item", itemId: itemId("Waffle & Meat") });
    await engine.setGroupField(groupId("Protein"), "name", "Meat", { type: "item", itemId: itemId("Waffle & Meat") });
    const g = await group("Waffle & Meat", "Meat");
    expect(g.maxSelect).toBeNull();
    expect(g.overriddenFields.sort()).toEqual(["max", "name"]);
    expect((await group("Two Eggs w/ Meat", "Protein")).maxSelect).toBe(1);
  });
});

describe("hide / add / stock", () => {
  it("hide on one item only; out-of-stock is global", async () => {
    const { mod, itemId } = await ids();
    await engine.hideModifier(mod("Protein", "Beef Sausage"), { type: "item", itemId: itemId("Waffle & Meat") });
    expect(names(await group("Waffle & Meat", "Protein"))).not.toContain("Beef Sausage");
    expect(names(await group("Two Eggs w/ Meat", "Protein"))).toContain("Beef Sausage");

    await engine.setModifierStock(mod("Protein", "Pork Sausage"), false);
    for (const n of PROTEIN_ITEMS) {
      expect((await group(n, "Protein")).modifiers.find((m) => m.name === "Pork Sausage")?.inStock).toBe(false);
    }
  });

  it("hide with scope all deletes the template option", async () => {
    const { mod } = await ids();
    await engine.hideModifier(mod("Protein", "Scrapple"), { type: "all" });
    for (const n of PROTEIN_ITEMS) expect(names(await group(n, "Protein"))).not.toContain("Scrapple");
  });

  it("add option to one item creates an extra on that item only", async () => {
    const { groupId, itemId } = await ids();
    await engine.addModifier(groupId("Protein"), { name: "Chorizo", priceCents: 150 }, { type: "item", itemId: itemId("Two Eggs w/ Meat") });
    expect(names(await group("Two Eggs w/ Meat", "Protein"))).toContain("Chorizo");
    expect(names(await group("Waffle & Meat", "Protein"))).not.toContain("Chorizo");
    expect(await db.modifier.count({ where: { name: "Chorizo" } })).toBe(0);
  });
});

describe("must-have: detach", () => {
  it("creates an independent group; later template edits don't affect it", async () => {
    const { mod, link } = await ids();
    const steakLink = await link("Steak & Eggs", "Protein");
    const resolvedBefore = await group("Steak & Eggs", "Protein");

    const r = await engine.detachGroup(steakLink);
    expect(r).toMatchObject({ ok: true });
    const detached = await group("Steak & Eggs", "Protein (Steak & Eggs)");
    expect(detached.name).toBe("Protein (Steak & Eggs)");
    expect(detached.isCustomized).toBe(false);
    expect(detached.sharedWithCount).toBe(0);
    expect(detached.modifiers.map((m) => [m.name, m.priceCents])).toEqual(resolvedBefore.modifiers.map((m) => [m.name, m.priceCents]));

    await engine.setModifierField(mod("Protein", "Bacon"), "price", 999, { type: "all" });
    await engine.addModifier((await ids()).groupId("Protein"), { name: "Ham", priceCents: 0 }, { type: "all" });
    const later = await group("Steak & Eggs", "Protein (Steak & Eggs)");
    expect(price(later, "Bacon")).toBe(150);
    expect(names(later)).not.toContain("Ham");
    expect(price(await group("Waffle & Meat", "Protein"), "Bacon")).toBe(999);
    expect((await group("Waffle & Meat", "Protein")).sharedWithCount).toBe(3);
  });
});

describe("reset", () => {
  it("Reset all makes Steak & Eggs match shared Protein again", async () => {
    const { link } = await ids();
    await engine.resetOverrides(await link("Steak & Eggs", "Protein"));
    const steak = await group("Steak & Eggs", "Protein");
    const waffle = await group("Waffle & Meat", "Protein");
    expect(steak.isCustomized).toBe(false);
    expect(steak.modifiers).toEqual(waffle.modifiers);
  });

  it("reset a single field keeps the others", async () => {
    const { link, mod } = await ids();
    await engine.resetOverrides(await link("Steak & Eggs", "Protein"), [{ kind: "modifier", modifierId: mod("Protein", "Bacon"), field: "price" }]);
    const steak = await group("Steak & Eggs", "Protein");
    expect(price(steak, "Bacon")).toBe(0);
    expect(names(steak)).not.toContain("Scrapple");
    expect(steak.isCustomized).toBe(true);
  });
});

describe("must-have: undo", () => {
  it("restores the exact previous state for every change type, in stack order", async () => {
    const { mod, itemId, link, groupId } = await ids();
    const s0 = await dump();

    const ops = [
      () => engine.setModifierField(mod("Protein", "Bacon"), "price", 300, { type: "all" }, { resetConflicts: true }),
      () => engine.setGroupField(groupId("Protein"), "max", null, { type: "item", itemId: itemId("Waffle & Meat") }),
      () => engine.hideModifier(mod("Protein", "Turkey Bacon"), { type: "all" }),
      () => engine.addModifier(groupId("Bread"), { name: "Sourdough", priceCents: 50 }, { type: "item", itemId: itemId("BLT") }),
      async () => engine.detachGroup(await link("Meat Omelette", "Protein")),
      async () => engine.unlinkGroup(await link("Coffee", "Drink Size")),
      () => engine.linkGroup([itemId("Pancake Stack")], groupId("Protein")),
      () => engine.updateItem(itemId("BLT"), { priceCents: 1, isAvailable: false }),
      () => engine.deleteGroup(groupId("Side")),
    ];
    const states = [s0];
    const changeIds: string[] = [];
    for (const op of ops) {
      const r = await op();
      expect(r.ok, JSON.stringify(r)).toBe(true);
      if (r.ok && r.changeId) changeIds.push(r.changeId);
      states.push(await dump());
    }
    expect(changeIds).toHaveLength(ops.length);

    // Undoing an older change first is refused.
    expect((await engine.undo(changeIds[0])).ok).toBe(false);

    for (let i = changeIds.length - 1; i >= 0; i--) {
      const r = await engine.undo(changeIds[i]);
      expect(r.ok, JSON.stringify(r)).toBe(true);
      expect(await dump()).toEqual(states[i]);
    }
    expect((await engine.latestUndoable(DEMO_STORE_ID))).toBeNull();
  });

  it("writes one ChangeLog row per change, none for no-op edits", async () => {
    const { mod, itemId } = await ids();
    await engine.setModifierField(mod("Protein", "Bacon"), "price", 150, { type: "item", itemId: itemId("Steak & Eggs") });
    expect(await db.changeLog.count()).toBe(0);
    await engine.updateItem(itemId("BLT"), { name: "B.L.T." });
    expect((await db.changeLog.findMany()).map((c) => c.summary)).toEqual(['BLT: renamed to "B.L.T."']);
    expect((await item("B.L.T.")).priceCents).toBe(799);
  });
});
