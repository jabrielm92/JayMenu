/**
 * Menu resolution — the single source of truth for "what does this item actually offer".
 * Effective group = template, then the item's link overrides on top. Pure functions, no DB.
 * See JAYMENU_PLAN.md Section 5.
 */

// ---------- Input shapes (structurally compatible with Prisma rows) ----------

export type TemplateModifierInput = {
  id: string;
  name: string;
  priceCents: number;
  inStock: boolean;
  sortOrder: number;
};

export type TemplateInput = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number | null;
  modifiers: TemplateModifierInput[];
};

export type LinkInput = {
  id: string;
  itemId: string;
  groupId: string;
  sortOrder: number;
  nameOverride: string | null;
  minOverride: number | null;
  maxOverride: number | null;
  maxOverrideSet: boolean;
};

export type ModifierOverrideInput = {
  modifierId: string;
  nameOverride: string | null;
  priceCentsOverride: number | null;
  hidden: boolean;
  sortOrderOverride: number | null;
};

export type ExtraInput = {
  id: string;
  name: string;
  priceCents: number;
  inStock: boolean;
  sortOrder: number;
};

export type LinkWithData = LinkInput & {
  group: TemplateInput;
  modOverrides: ModifierOverrideInput[];
  extras: ExtraInput[];
};

export type ItemInput = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceCents: number;
  taxable: boolean;
  isAvailable: boolean;
  imageUrl: string | null;
  sortOrder: number;
};

export type StoreInput = {
  id: string;
  name: string;
  taxRatePct: number | string | { toString(): string } | null;
  categories: Array<{
    id: string;
    name: string;
    description: string | null;
    sortOrder: number;
    isActive: boolean;
    items: Array<ItemInput & { groupLinks: LinkWithData[] }>;
  }>;
};

// ---------- Output shapes ----------

export type ModifierField = "name" | "price" | "sortOrder";
export type GroupField = "name" | "min" | "max";

export type ResolvedModifier = {
  source: "template" | "extra";
  modifierId?: string;
  extraId?: string;
  name: string;
  priceCents: number;
  inStock: boolean;
  sortOrder: number;
  overridden: ModifierField[];
};

export type ResolvedGroup = {
  linkId: string;
  groupId: string;
  name: string;
  minSelect: number;
  maxSelect: number | null;
  sortOrder: number;
  isCustomized: boolean; // any override or extra exists on this link
  sharedWithCount: number; // number of OTHER items linked to this template
  overriddenFields: GroupField[];
  modifiers: ResolvedModifier[]; // hidden ones removed
  hiddenModifierIds: string[];
  warnings: string[];
};

export type ResolvedItem = ItemInput & { groups: ResolvedGroup[] };

export type ResolvedCategory = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  items: ResolvedItem[];
};

export type ResolvedMenu = {
  storeId: string;
  storeName: string;
  taxRatePct: number | null;
  categories: ResolvedCategory[];
};

// ---------- Helpers ----------

const bySortThenName = <T extends { sortOrder: number; name: string }>(a: T, b: T) =>
  a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);

/** True when an override row carries no effective change (all fields default). */
export function isEmptyOverride(o: ModifierOverrideInput): boolean {
  return (
    o.nameOverride === null &&
    o.priceCentsOverride === null &&
    o.sortOrderOverride === null &&
    !o.hidden
  );
}

/** True when the link itself carries any group-level override. */
export function linkHasGroupOverrides(link: LinkInput): boolean {
  return link.nameOverride !== null || link.minOverride !== null || link.maxOverrideSet;
}

// ---------- Resolution ----------

export function resolveGroup(
  link: LinkInput,
  template: TemplateInput,
  overrides: ModifierOverrideInput[],
  extras: ExtraInput[],
  sharedWithCount: number,
): ResolvedGroup {
  const overriddenFields: GroupField[] = [];

  // 1–2. Template values, then group-level overrides.
  let name = template.name;
  let minSelect = template.minSelect;
  let maxSelect = template.maxSelect;
  if (link.nameOverride !== null) {
    name = link.nameOverride;
    overriddenFields.push("name");
  }
  if (link.minOverride !== null) {
    minSelect = link.minOverride;
    overriddenFields.push("min");
  }
  if (link.maxOverrideSet) {
    maxSelect = link.maxOverride;
    overriddenFields.push("max");
  }

  // 3. Template modifiers with per-link overrides.
  const overrideByMod = new Map(overrides.map((o) => [o.modifierId, o]));
  const modifiers: ResolvedModifier[] = [];
  const hiddenModifierIds: string[] = [];
  for (const m of template.modifiers) {
    const o = overrideByMod.get(m.id);
    if (o?.hidden) {
      hiddenModifierIds.push(m.id);
      continue;
    }
    const overridden: ModifierField[] = [];
    let modName = m.name;
    let price = m.priceCents;
    let sort = m.sortOrder;
    if (o?.nameOverride != null) {
      modName = o.nameOverride;
      overridden.push("name");
    }
    if (o?.priceCentsOverride != null) {
      price = o.priceCentsOverride;
      overridden.push("price");
    }
    if (o?.sortOrderOverride != null) {
      sort = o.sortOrderOverride;
      overridden.push("sortOrder");
    }
    modifiers.push({
      source: "template",
      modifierId: m.id,
      name: modName,
      priceCents: price,
      inStock: m.inStock, // stock is always global
      sortOrder: sort,
      overridden,
    });
  }

  // 4. Item-only extras.
  for (const e of extras) {
    modifiers.push({
      source: "extra",
      extraId: e.id,
      name: e.name,
      priceCents: e.priceCents,
      inStock: e.inStock,
      sortOrder: e.sortOrder,
      overridden: [],
    });
  }

  // 5. Sort.
  modifiers.sort(bySortThenName);

  // 6. Validation warnings (never throw).
  const warnings: string[] = [];
  if (minSelect > modifiers.length) {
    warnings.push(
      `Requires at least ${minSelect} choice${minSelect === 1 ? "" : "s"} but only ${modifiers.length} option${modifiers.length === 1 ? " is" : "s are"} visible.`,
    );
  }
  if (maxSelect !== null && maxSelect < minSelect) {
    warnings.push(`Max (${maxSelect}) is less than min (${minSelect}).`);
  }

  const isCustomized =
    linkHasGroupOverrides(link) ||
    overrides.some((o) => !isEmptyOverride(o)) ||
    extras.length > 0;

  return {
    linkId: link.id,
    groupId: template.id,
    name,
    minSelect,
    maxSelect,
    sortOrder: link.sortOrder,
    isCustomized,
    sharedWithCount,
    overriddenFields,
    modifiers,
    hiddenModifierIds,
    warnings,
  };
}

/**
 * Resolve one item. `linkCounts` maps groupId → total number of links to that template
 * (across the whole store); sharedWithCount = that total minus this item.
 */
export function resolveItem(
  item: ItemInput,
  linksWithData: LinkWithData[],
  linkCounts: Map<string, number> = new Map(),
): ResolvedItem {
  const groups = linksWithData
    .map((l) =>
      resolveGroup(
        l,
        l.group,
        l.modOverrides,
        l.extras,
        Math.max(0, (linkCounts.get(l.groupId) ?? 1) - 1),
      ),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  return {
    id: item.id,
    categoryId: item.categoryId,
    name: item.name,
    description: item.description,
    priceCents: item.priceCents,
    taxable: item.taxable,
    isAvailable: item.isAvailable,
    imageUrl: item.imageUrl,
    sortOrder: item.sortOrder,
    groups,
  };
}

/** Count links per template across the store. */
export function countLinks(store: StoreInput): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of store.categories)
    for (const i of c.items)
      for (const l of i.groupLinks) counts.set(l.groupId, (counts.get(l.groupId) ?? 0) + 1);
  return counts;
}

export function resolveMenu(store: StoreInput): ResolvedMenu {
  const counts = countLinks(store);
  return {
    storeId: store.id,
    storeName: store.name,
    taxRatePct: store.taxRatePct == null ? null : Number(store.taxRatePct.toString()),
    categories: [...store.categories].sort(bySortThenName).map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      sortOrder: c.sortOrder,
      isActive: c.isActive,
      items: [...c.items].sort(bySortThenName).map((i) => resolveItem(i, i.groupLinks, counts)),
    })),
  };
}

/**
 * Customer-facing view: drops inactive categories, unavailable items and out-of-stock options.
 * Used by Preview and the publish snapshot.
 */
export function toCustomerMenu(menu: ResolvedMenu): ResolvedMenu {
  return {
    ...menu,
    categories: menu.categories
      .filter((c) => c.isActive)
      .map((c) => ({
        ...c,
        items: c.items
          .filter((i) => i.isAvailable)
          .map((i) => ({
            ...i,
            groups: i.groups.map((g) => ({ ...g, modifiers: g.modifiers.filter((m) => m.inStock) })),
          })),
      })),
  };
}

// ---------- Template summaries (Group Library, Compare, Scope Prompt) ----------

export type TemplateLink = { linkId: string; itemId: string; itemName: string; isCustomized: boolean };

export type TemplateSummary = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number | null;
  modifiers: TemplateModifierInput[]; // template values, sorted
  links: TemplateLink[];
  usedBy: number;
  customizedCount: number;
};

/** Describe every template with where it is used (derived from the resolved menu). */
export function summarizeTemplates(menu: ResolvedMenu, groups: TemplateInput[]): TemplateSummary[] {
  const linksByGroup = new Map<string, TemplateLink[]>();
  for (const c of menu.categories)
    for (const i of c.items)
      for (const g of i.groups) {
        const list = linksByGroup.get(g.groupId) ?? [];
        list.push({ linkId: g.linkId, itemId: i.id, itemName: i.name, isCustomized: g.isCustomized });
        linksByGroup.set(g.groupId, list);
      }
  return [...groups]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((g) => {
      const links = (linksByGroup.get(g.id) ?? []).sort((a, b) => a.itemName.localeCompare(b.itemName));
      return {
        id: g.id,
        name: g.name,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        modifiers: [...g.modifiers].sort(bySortThenName),
        links,
        usedBy: links.length,
        customizedCount: links.filter((l) => l.isCustomized).length,
      };
    });
}
