import { describe, expect, it } from "vitest";
import {
  resolveGroup,
  resolveMenu,
  toCustomerMenu,
  type ExtraInput,
  type LinkInput,
  type ModifierOverrideInput,
  type StoreInput,
  type TemplateInput,
} from "./resolve";

// ---------- Fixture: the Section 3 worked example ----------

function protein(): TemplateInput {
  return {
    id: "g-protein",
    name: "Protein",
    minSelect: 1,
    maxSelect: 1,
    modifiers: [
      { id: "m-bacon", name: "Bacon", priceCents: 0, inStock: true, sortOrder: 0 },
      { id: "m-sausage", name: "Sausage", priceCents: 0, inStock: true, sortOrder: 1 },
      { id: "m-scrapple", name: "Scrapple", priceCents: 0, inStock: true, sortOrder: 2 },
      { id: "m-tbacon", name: "Turkey Bacon", priceCents: 0, inStock: true, sortOrder: 3 },
    ],
  };
}

function link(id: string, itemId: string, patch: Partial<LinkInput> = {}): LinkInput {
  return {
    id,
    itemId,
    groupId: "g-protein",
    sortOrder: 0,
    nameOverride: null,
    minOverride: null,
    maxOverride: null,
    maxOverrideSet: false,
    ...patch,
  };
}

function ov(modifierId: string, patch: Partial<ModifierOverrideInput> = {}): ModifierOverrideInput {
  return {
    modifierId,
    nameOverride: null,
    priceCentsOverride: null,
    hidden: false,
    sortOrderOverride: null,
    ...patch,
  };
}

type State = {
  template: TemplateInput;
  links: Record<string, { link: LinkInput; overrides: ModifierOverrideInput[]; extras: ExtraInput[] }>;
};

function initialState(): State {
  return {
    template: protein(),
    links: {
      waffle: { link: link("l-waffle", "waffle"), overrides: [], extras: [] },
      omelette: { link: link("l-omelette", "omelette"), overrides: [], extras: [] },
      steak: { link: link("l-steak", "steak"), overrides: [], extras: [] },
    },
  };
}

function resolveAll(s: State) {
  const n = Object.keys(s.links).length;
  return Object.fromEntries(
    Object.entries(s.links).map(([k, v]) => [
      k,
      resolveGroup(v.link, s.template, v.overrides, v.extras, n - 1),
    ]),
  );
}

const price = (g: ReturnType<typeof resolveGroup>, name: string) =>
  g.modifiers.find((m) => m.name === name)?.priceCents;
const names = (g: ReturnType<typeof resolveGroup>) => g.modifiers.map((m) => m.name);

// ---------- Tests ----------

describe("resolveGroup — Section 3 worked example", () => {
  it("baseline: every item sees the plain shared template", () => {
    const r = resolveAll(initialState());
    for (const g of Object.values(r)) {
      expect(names(g)).toEqual(["Bacon", "Sausage", "Scrapple", "Turkey Bacon"]);
      expect(g.isCustomized).toBe(false);
      expect(g.sharedWithCount).toBe(2);
      expect(g.name).toBe("Protein");
    }
  });

  it("row 1: Steak & Eggs Bacon → $1.50 (this item only) leaves others at $0", () => {
    const s = initialState();
    const before = resolveAll(s);
    s.links.steak.overrides.push(ov("m-bacon", { priceCentsOverride: 150 }));
    const r = resolveAll(s);

    expect(price(r.steak, "Bacon")).toBe(150);
    expect(r.steak.modifiers[0].overridden).toEqual(["price"]);
    expect(r.steak.isCustomized).toBe(true);
    // An override on one link never changes another link's result.
    expect(r.waffle).toEqual(before.waffle);
    expect(r.omelette).toEqual(before.omelette);
  });

  it("row 2: Steak & Eggs hides Scrapple; others still show it", () => {
    const s = initialState();
    s.links.steak.overrides.push(ov("m-scrapple", { hidden: true }));
    const r = resolveAll(s);

    expect(names(r.steak)).not.toContain("Scrapple");
    expect(r.steak.hiddenModifierIds).toEqual(["m-scrapple"]);
    expect(names(r.waffle)).toContain("Scrapple");
    expect(names(r.omelette)).toContain("Scrapple");
  });

  it("row 3: template Sausage → $0.50 reaches all items", () => {
    const s = initialState();
    s.links.steak.overrides.push(ov("m-bacon", { priceCentsOverride: 150 }));
    s.template.modifiers[1].priceCents = 50;
    const r = resolveAll(s);
    for (const g of Object.values(r)) expect(price(g, "Sausage")).toBe(50);
  });

  it("row 4: template Bacon → $0.75 updates all except the item that overrode Bacon", () => {
    const s = initialState();
    s.links.steak.overrides.push(ov("m-bacon", { priceCentsOverride: 150 }));
    s.template.modifiers[0].priceCents = 75;
    const r = resolveAll(s);
    expect(price(r.waffle, "Bacon")).toBe(75);
    expect(price(r.omelette, "Bacon")).toBe(75);
    expect(price(r.steak, "Bacon")).toBe(150);
  });

  it("row 5: extra 'Ham +$1' appears on Meat Omelette only", () => {
    const s = initialState();
    s.links.omelette.extras.push({ id: "x-ham", name: "Ham", priceCents: 100, inStock: true, sortOrder: 100 });
    const r = resolveAll(s);

    const ham = r.omelette.modifiers.find((m) => m.name === "Ham");
    expect(ham).toMatchObject({ source: "extra", extraId: "x-ham", priceCents: 100 });
    expect(names(r.omelette).at(-1)).toBe("Ham");
    expect(r.omelette.isCustomized).toBe(true);
    expect(names(r.waffle)).not.toContain("Ham");
    expect(names(r.steak)).not.toContain("Ham");
  });

  it("row 6: detach — a copy of the resolved values is independent of later template edits", () => {
    const s = initialState();
    s.links.waffle.overrides.push(ov("m-bacon", { priceCentsOverride: 25 }));
    const resolvedWaffle = resolveAll(s).waffle;

    // Detach = new template built from resolved values, link points to it, no overrides.
    const detached: TemplateInput = {
      id: "g-detached",
      name: "Protein (Waffle & Meat)",
      minSelect: resolvedWaffle.minSelect,
      maxSelect: resolvedWaffle.maxSelect,
      modifiers: resolvedWaffle.modifiers.map((m, i) => ({
        id: `d-${i}`,
        name: m.name,
        priceCents: m.priceCents,
        inStock: m.inStock,
        sortOrder: m.sortOrder,
      })),
    };
    s.template.modifiers[0].priceCents = 999; // later shared edit
    const r = resolveGroup(link("l-waffle", "waffle", { groupId: "g-detached" }), detached, [], [], 0);
    expect(price(r, "Bacon")).toBe(25);
    expect(r.name).toBe("Protein (Waffle & Meat)");
    expect(r.isCustomized).toBe(false);
  });
});

describe("resolveGroup — group-level overrides", () => {
  it("applies name and min overrides and reports them", () => {
    const r = resolveGroup(link("l", "i", { nameOverride: "Meat", minOverride: 0 }), protein(), [], [], 0);
    expect(r.name).toBe("Meat");
    expect(r.minSelect).toBe(0);
    expect(r.maxSelect).toBe(1);
    expect(r.overriddenFields).toEqual(["name", "min"]);
    expect(r.isCustomized).toBe(true);
  });

  it("max override is ignored unless maxOverrideSet", () => {
    const r = resolveGroup(link("l", "i", { maxOverride: 3 }), protein(), [], [], 0);
    expect(r.maxSelect).toBe(1);
    expect(r.isCustomized).toBe(false);
  });

  it("max override to a number", () => {
    const r = resolveGroup(link("l", "i", { maxOverride: 3, maxOverrideSet: true }), protein(), [], [], 0);
    expect(r.maxSelect).toBe(3);
    expect(r.overriddenFields).toEqual(["max"]);
  });

  it("max override to 'no limit' (null with maxOverrideSet)", () => {
    const r = resolveGroup(link("l", "i", { maxOverride: null, maxOverrideSet: true }), protein(), [], [], 0);
    expect(r.maxSelect).toBeNull();
    expect(r.isCustomized).toBe(true);
  });

  it("template 'no limit' max passes through", () => {
    const t = { ...protein(), maxSelect: null };
    expect(resolveGroup(link("l", "i"), t, [], [], 0).maxSelect).toBeNull();
  });
});

describe("resolveGroup — modifiers", () => {
  it("name and sort overrides re-order the list", () => {
    const r = resolveGroup(
      link("l", "i"),
      protein(),
      [ov("m-tbacon", { sortOrderOverride: -1, nameOverride: "Turkey Bacon (lean)" })],
      [],
      0,
    );
    expect(names(r)[0]).toBe("Turkey Bacon (lean)");
    expect(r.modifiers[0].overridden).toEqual(["name", "sortOrder"]);
  });

  it("ties on sortOrder fall back to name", () => {
    const t = protein();
    t.modifiers.forEach((m) => (m.sortOrder = 0));
    expect(names(resolveGroup(link("l", "i"), t, [], [], 0))).toEqual([
      "Bacon",
      "Sausage",
      "Scrapple",
      "Turkey Bacon",
    ]);
  });

  it("stock is global: out-of-stock template modifier is out on every item", () => {
    const t = protein();
    t.modifiers[0].inStock = false;
    const a = resolveGroup(link("a", "a"), t, [ov("m-bacon", { priceCentsOverride: 150 })], [], 1);
    const b = resolveGroup(link("b", "b"), t, [], [], 1);
    expect(a.modifiers.find((m) => m.modifierId === "m-bacon")?.inStock).toBe(false);
    expect(b.modifiers.find((m) => m.modifierId === "m-bacon")?.inStock).toBe(false);
  });

  it("an empty override row does not count as customized", () => {
    const r = resolveGroup(link("l", "i"), protein(), [ov("m-bacon")], [], 0);
    expect(r.isCustomized).toBe(false);
    expect(r.modifiers[0].overridden).toEqual([]);
  });

  it("warns (does not throw) when min exceeds visible options", () => {
    const t = { ...protein(), minSelect: 4, maxSelect: null };
    const r = resolveGroup(link("l", "i"), t, [ov("m-bacon", { hidden: true })], [], 0);
    expect(r.modifiers).toHaveLength(3);
    expect(r.warnings).toHaveLength(1);
  });
});

describe("resolveMenu", () => {
  const t = protein();
  const mkLink = (id: string, itemId: string, overrides: ModifierOverrideInput[] = []) => ({
    ...link(id, itemId),
    group: t,
    modOverrides: overrides,
    extras: [],
  });
  const item = (id: string, sortOrder: number, isAvailable = true) => ({
    id,
    categoryId: "c1",
    name: id,
    description: null,
    priceCents: 500,
    taxable: true,
    isAvailable,
    imageUrl: null,
    sortOrder,
  });
  const store: StoreInput = {
    id: "s",
    name: "Demo",
    taxRatePct: "8.00",
    categories: [
      {
        id: "c1",
        name: "Breakfast",
        description: null,
        sortOrder: 0,
        isActive: true,
        items: [
          { ...item("b", 1), groupLinks: [mkLink("l-b", "b")] },
          { ...item("a", 0), groupLinks: [mkLink("l-a", "a", [ov("m-bacon", { priceCentsOverride: 150 })])] },
          { ...item("off", 2, false), groupLinks: [mkLink("l-off", "off")] },
        ],
      },
    ],
  };

  it("sorts items, counts shared links, parses tax rate", () => {
    const m = resolveMenu(store);
    expect(m.taxRatePct).toBe(8);
    expect(m.categories[0].items.map((i) => i.id)).toEqual(["a", "b", "off"]);
    expect(m.categories[0].items[0].groups[0].sharedWithCount).toBe(2);
    expect(price(m.categories[0].items[0].groups[0], "Bacon")).toBe(150);
    expect(price(m.categories[0].items[1].groups[0], "Bacon")).toBe(0);
  });

  it("customer view drops unavailable items and out-of-stock options", () => {
    const t2 = protein();
    t2.modifiers[1].inStock = false;
    const s2: StoreInput = {
      ...store,
      categories: store.categories.map((c) => ({
        ...c,
        items: c.items.map((i) => ({ ...i, groupLinks: i.groupLinks.map((l) => ({ ...l, group: t2 })) })),
      })),
    };
    const m = toCustomerMenu(resolveMenu(s2));
    expect(m.categories[0].items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(names(m.categories[0].items[0].groups[0])).not.toContain("Sausage");
  });
});
