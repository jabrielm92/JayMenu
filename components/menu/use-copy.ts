"use client";

/** Copy-to flows: pick in a picker dialog, then run the change through the engine. */
import { copyExtraToItemsAction, copyGroupToItemsAction, copyModifierToGroupsAction, setModifierItemsAction } from "@/app/stores/[storeId]/actions";
import { useDrillPicker, type AddMode, type Pair } from "@/components/editor/drill-picker";
import { useItemPicker } from "@/components/editor/item-picker";
import { useMenuCategories, useMenuTemplates } from "@/components/editor/menu-data";
import { useChange } from "@/components/editor/use-change";
import type { ResolvedGroup, ResolvedItem, TemplateSummary } from "@/lib/menu/resolve";

const items = (n: number) => `${n} item${n === 1 ? "" : "s"}`;

// "Ask where to add a copied modifier" preference (per browser).
const PREF_KEY = "jaymenu.copyModifier";
function readPref(): { ask: boolean; choice: AddMode } {
  try {
    const v = JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}");
    return { ask: v.ask !== false, choice: v.choice === "groups" ? "groups" : "items" };
  } catch {
    return { ask: true, choice: "items" };
  }
}
function savePref(ask: boolean, choice: AddMode) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify({ ask, choice }));
  } catch {}
}

export function useCopy(template: TemplateSummary) {
  const pickItems = useItemPicker();
  const drill = useDrillPicker();
  const categories = useMenuCategories();
  const templates = useMenuTemplates();
  const { run } = useChange();
  const linked = new Set(template.links.map((l) => l.itemId));

  /** Copy this modifier group to more items (Categories → Items); from an item card, optionally with that item's changes. */
  async function copyGroup(from?: { item: ResolvedItem; group: ResolvedGroup }) {
    const r = await drill({
      title: `Copy ${from?.group.name ?? template.name} to items`,
      description: "Pick a category, then tick items. They get this same shared modifier group, and each can still have its own changes.",
      categories,
      level: "items",
      disabledItems: Object.fromEntries([...linked].map((id) => [id, "already has it"])),
      toggle: from?.group.isCustomized ? { label: `Include ${from.item.name}'s own changes`, defaultChecked: true } : undefined,
      confirmLabel: (n) => `Copy to ${items(n)}`,
    });
    if (!r) return false;
    return run(() => copyGroupToItemsAction({ groupId: template.id, itemIds: r.itemIds, fromLinkId: from && r.toggle ? from.group.linkId : undefined }));
  }

  /** Choose which of the group's items show a shared modifier (others hide it). */
  async function chooseModifierItems(modifierId: string, modifierName: string) {
    const visible = template.links
      .filter((l) => {
        const g = categories.flatMap((c) => c.items).find((i) => i.id === l.itemId)?.groups.find((x) => x.linkId === l.linkId);
        return g ? !g.hiddenModifierIds.includes(modifierId) : true;
      })
      .map((l) => l.itemId);
    const r = await pickItems({
      title: `Show/hide "${modifierName}" on items`,
      description: `Only items with ${template.name} are listed. Unticked items hide it; nothing is deleted.`,
      categories,
      onlyItemIds: [...linked],
      initialSelected: visible,
      allowEmpty: true,
      confirmLabel: (n) => `Show on ${items(n)}`,
    });
    if (!r) return false;
    return run(() => setModifierItemsAction({ modifierId, itemIds: r.itemIds }));
  }

  /** Copy an item-only modifier to other items that have this same modifier group. */
  async function copyExtra(extraId: string, name: string, onItemId: string) {
    const has: Record<string, string> = {};
    for (const i of categories.flatMap((c) => c.items))
      for (const g of i.groups)
        if (g.groupId === template.id && g.modifiers.some((m) => m.source === "extra" && m.name.toLowerCase() === name.toLowerCase()))
          has[i.id] = i.id === onItemId ? "this item" : "already has it";
    const r = await pickItems({
      title: `Copy "${name}" to items with ${template.name}`,
      description: `Only items with ${template.name} are listed. Each copy is that item's own modifier.`,
      categories,
      onlyItemIds: [...linked],
      disabled: has,
      confirmLabel: (n) => `Copy to ${items(n)}`,
    });
    if (!r) return false;
    return run(() => copyExtraToItemsAction({ extraId, itemIds: r.itemIds }));
  }

  /** Copy a modifier into OTHER modifier groups: Categories → Items → tick modifier groups. */
  async function copyModifierToGroups(source: { modifierId: string } | { extraId: string }, name: string) {
    const lower = name.trim().toLowerCase();
    const byId = new Map(templates.map((t) => [t.id, t]));
    const pref = readPref();
    const r = await drill({
      title: `Copy "${name}" to other modifier groups`,
      description: "Pick a category, then an item, then tick the modifier groups to copy it into. You can pick across several items.",
      categories,
      level: "groups",
      groupReason: (_item, g) => {
        if (g.groupId === template.id) return "already here";
        const t = byId.get(g.groupId);
        if (t?.modifiers.some((m) => m.name.trim().toLowerCase() === lower) || g.modifiers.some((m) => m.name.trim().toLowerCase() === lower)) return "already has it";
        return undefined;
      },
      where: {
        ask: pref.ask,
        remembered: pref.choice,
        savePref,
        summarize: (pairs: Pair[]) => {
          const groupIds = new Set(pairs.map((p) => p.groupId));
          const total = new Set([...groupIds].flatMap((gid) => (byId.get(gid)?.links ?? []).map((l) => `${l.itemId}|${gid}`))).size;
          return { picked: pairs.length, total };
        },
      },
      confirmLabel: (n) => `Copy to ${n} modifier group${n === 1 ? "" : "s"}`,
    });
    if (!r) return false;
    return run(() => copyModifierToGroupsAction({ source, targets: r.pairs, mode: r.mode }));
  }

  return { copyGroup, chooseModifierItems, copyExtra, copyModifierToGroups };
}
