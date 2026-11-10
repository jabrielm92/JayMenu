"use client";

/** Copy-to flows: pick items in the shared picker, then run the change through the engine. */
import { copyExtraToItemsAction, copyGroupToItemsAction, setModifierItemsAction } from "@/app/stores/[storeId]/actions";
import { useItemPicker } from "@/components/editor/item-picker";
import { useMenuCategories } from "@/components/editor/menu-data";
import { useChange } from "@/components/editor/use-change";
import type { ResolvedGroup, ResolvedItem, TemplateSummary } from "@/lib/menu/resolve";

const items = (n: number) => `${n} item${n === 1 ? "" : "s"}`;

export function useCopy(template: TemplateSummary) {
  const pickItems = useItemPicker();
  const categories = useMenuCategories();
  const { run } = useChange();
  const linked = new Set(template.links.map((l) => l.itemId));
  const alreadyHas = Object.fromEntries([...linked].map((id) => [id, "already has it"]));

  /** Copy this modifier group to more items; from an item card, optionally with that item's changes. */
  async function copyGroup(from?: { item: ResolvedItem; group: ResolvedGroup }) {
    const r = await pickItems({
      title: `Copy ${from?.group.name ?? template.name} to items`,
      description: "The items you pick get this same shared modifier group. Later shared edits reach them too, and each can still have its own changes.",
      categories,
      disabled: alreadyHas,
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
      title: `Which items have "${modifierName}"?`,
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

  /** Copy an item-only modifier to other items that have this modifier group. */
  async function copyExtra(extraId: string, name: string, onItemId: string) {
    const has: Record<string, string> = {};
    for (const i of categories.flatMap((c) => c.items))
      for (const g of i.groups)
        if (g.groupId === template.id && g.modifiers.some((m) => m.source === "extra" && m.name.toLowerCase() === name.toLowerCase()))
          has[i.id] = i.id === onItemId ? "this item" : "already has it";
    const r = await pickItems({
      title: `Copy "${name}" to items`,
      description: `Only items with ${template.name} are listed. Each copy is that item's own modifier.`,
      categories,
      onlyItemIds: [...linked],
      disabled: has,
      confirmLabel: (n) => `Copy to ${items(n)}`,
    });
    if (!r) return false;
    return run(() => copyExtraToItemsAction({ extraId, itemIds: r.itemIds }));
  }

  return { copyGroup, chooseModifierItems, copyExtra };
}
