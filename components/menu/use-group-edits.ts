"use client";

/**
 * Edit flows for a modifier group, shared by the item panel (item context)
 * and the Group Library (template context). Each flow: Scope Prompt → server action → toast.
 */
import {
  addModifierAction,
  getGroupConflictsAction,
  getModifierConflictsAction,
  hideModifierAction,
  setGroupFieldAction,
  setModifierFieldAction,
  setModifierStockAction,
  showModifierAction,
} from "@/app/stores/[storeId]/actions";
import { useConfirm } from "@/components/editor/confirm";
import { useScopePrompt } from "@/components/editor/scope-prompt";
import { useChange } from "@/components/editor/use-change";
import type { Conflict } from "@/lib/menu/changes";
import type { GroupField, ModifierField, TemplateSummary } from "@/lib/menu/resolve";
import { formatCents } from "@/lib/money";

export const fmtGroupValue = (field: GroupField, v: string | number | null) =>
  field === "max" && v === null ? "no limit" : field === "name" ? `"${v}"` : String(v);
export const fmtModValue = (field: ModifierField, v: string | number | null) =>
  field === "price" ? formatCents(Number(v)) : field === "name" ? `"${v}"` : String(v);

const MOD_LABEL: Record<ModifierField, string> = { name: "name", price: "price", sortOrder: "position" };

/** `itemId` set = item context (default "This item only"); unset = template context (default "All"). */
export function useGroupEdits(template: TemplateSummary, itemId?: string) {
  const askScope = useScopePrompt();
  const confirm = useConfirm();
  const { run, pending } = useChange();
  const defaultScope = itemId ? ("item" as const) : ("all" as const);
  const base = { links: template.links, currentItemId: itemId, defaultScope };

  async function setGroupField(field: GroupField, value: string | number | null) {
    const label = field === "name" ? "name" : field;
    const answer = await askScope({
      ...base,
      title: field === "name" ? `Rename "${template.name}" to "${value}"` : `Change ${template.name} ${label} to ${fmtGroupValue(field, value)}`,
      getConflicts: () => getGroupConflictsAction({ groupId: template.id, field, value }),
      conflictNoun: `${label} for ${template.name}`,
      formatConflict: (c: Conflict) => `${c.itemName}: ${fmtGroupValue(field, c.value)}`,
    });
    if (!answer) return false;
    return run(() =>
      setGroupFieldAction({ groupId: template.id, field, value, scope: answer.scope, opts: { resetConflicts: answer.resetConflicts } }),
    );
  }

  async function setModifierField(modifierId: string, displayName: string, field: ModifierField, value: string | number) {
    const tmplName = template.modifiers.find((m) => m.id === modifierId)?.name ?? displayName;
    const answer = await askScope({
      ...base,
      title: field === "name" ? `Rename "${displayName}" to "${value}"` : `Change "${displayName}" ${MOD_LABEL[field]} to ${fmtModValue(field, value)}`,
      getConflicts: () => getModifierConflictsAction({ modifierId, field, value }),
      conflictNoun: `${MOD_LABEL[field]} for ${tmplName}`,
      formatConflict: (c: Conflict) => `${c.itemName}: ${fmtModValue(field, c.value)}`,
    });
    if (!answer) return false;
    return run(() =>
      setModifierFieldAction({ modifierId, field, value, scope: answer.scope, opts: { resetConflicts: answer.resetConflicts } }),
    );
  }

  /** Item context: hide (scope prompt; "All" deletes). Template context: delete with confirm. */
  async function hideModifier(modifierId: string, displayName: string) {
    if (!itemId || template.links.length <= 1) {
      if (itemId) return run(() => hideModifierAction({ modifierId, scope: { type: "item", itemId } }));
      const ok = await confirm({
        title: `Delete "${displayName}" from ${template.name}?`,
        description: `It will be removed from all ${template.links.length} linked items. You can undo this before publishing.`,
        confirmLabel: "Delete modifier",
        destructive: true,
      });
      if (!ok) return false;
      return run(() => hideModifierAction({ modifierId, scope: { type: "all" } }));
    }
    const answer = await askScope({
      ...base,
      title: `Hide "${displayName}"`,
      allWarning: `"All linked items" deletes this modifier from the shared ${template.name} group.`,
    });
    if (!answer) return false;
    if (answer.scope.type === "all") {
      const ok = await confirm({
        title: `Delete "${displayName}" from ${template.name}?`,
        description: `It will be removed from all ${template.links.length} linked items.`,
        confirmLabel: "Delete modifier",
        destructive: true,
      });
      if (!ok) return false;
    }
    return run(() => hideModifierAction({ modifierId, scope: answer.scope }));
  }

  async function showModifier(modifierId: string) {
    if (!itemId) return run(() => showModifierAction({ modifierId, scope: { type: "all" } }));
    return run(() => showModifierAction({ modifierId, scope: { type: "item", itemId } }));
  }

  async function addModifier(name: string, priceCents: number) {
    const answer = await askScope({ ...base, title: `Add modifier "${name}"${priceCents ? ` ${formatCents(priceCents)}` : ""}` });
    if (!answer) return false;
    return run(() => addModifierAction({ groupId: template.id, name, priceCents, scope: answer.scope }));
  }

  async function setStock(modifierId: string, inStock: boolean) {
    return run(() => setModifierStockAction({ modifierId, inStock }));
  }

  return { setGroupField, setModifierField, hideModifier, showModifier, addModifier, setStock, run, pending, confirm };
}
