"use client";

/**
 * Modifiers: every modifier in the store, its modifier group, how many items use it,
 * and which items have their own value. Edits here default to "All linked items".
 */
import { ChevronDownIcon, ChevronRightIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { deleteExtraAction, updateExtraAction } from "@/app/stores/[storeId]/actions";
import { useChange } from "@/components/editor/use-change";
import { InlineEdit } from "@/components/editor/inline-edit";
import { StockDot } from "@/components/menu/option-row";
import { useGroupEdits } from "@/components/menu/use-group-edits";
import { useConfirm } from "@/components/editor/confirm";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EditorData } from "@/lib/menu/queries";
import type { ResolvedModifier, TemplateModifierInput, TemplateSummary } from "@/lib/menu/resolve";
import { formatCents, parseDollarsToCents } from "@/lib/money";
import { cn } from "@/lib/utils";

/** One item's own value for a shared modifier. */
type ItemValue = { itemId: string; itemName: string; text: string };

type SharedRow = { kind: "shared"; key: string; template: TemplateSummary; mod: TemplateModifierInput; itemValues: ItemValue[] };
type ExtraRow = { kind: "extra"; key: string; groupId: string; groupName: string; itemId: string; itemName: string; mod: ResolvedModifier };
type Row = SharedRow | ExtraRow;

function buildRows(data: EditorData): Row[] {
  const items = data.menu.categories.flatMap((c) => c.items);
  const rows: Row[] = [];
  for (const t of data.templates) {
    const groupsOnItems = items.flatMap((i) => i.groups.filter((g) => g.groupId === t.id).map((g) => ({ item: i, g })));
    for (const m of t.modifiers) {
      const itemValues: ItemValue[] = [];
      for (const { item, g } of groupsOnItems) {
        if (g.hiddenModifierIds.includes(m.id)) {
          itemValues.push({ itemId: item.id, itemName: item.name, text: "Hidden on this item" });
          continue;
        }
        const r = g.modifiers.find((x) => x.modifierId === m.id);
        if (!r?.overridden.length) continue;
        const parts: string[] = [];
        if (r.overridden.includes("name")) parts.push(`named "${r.name}"`);
        if (r.overridden.includes("price")) parts.push(formatCents(r.priceCents));
        if (r.overridden.includes("sortOrder")) parts.push("own position");
        itemValues.push({ itemId: item.id, itemName: item.name, text: parts.join(", ") });
      }
      rows.push({ kind: "shared", key: m.id, template: t, mod: m, itemValues });
    }
    for (const { item, g } of groupsOnItems)
      for (const x of g.modifiers.filter((y) => y.source === "extra"))
        rows.push({ kind: "extra", key: x.extraId!, groupId: t.id, groupName: t.name, itemId: item.id, itemName: item.name, mod: x });
  }
  return rows;
}

const nameEdit = { format: (v: string) => v, parse: (s: string) => (s.trim() ? s.trim() : undefined) };
const priceEdit = { format: formatCents, parse: (s: string) => parseDollarsToCents(s) ?? undefined };

function SharedModifierRow({ storeId, row }: { storeId: string; row: SharedRow }) {
  const { template, mod, itemValues } = row;
  const edits = useGroupEdits(template);
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="hover:bg-muted/40">
        <td className="px-2 py-1">
          <InlineEdit ariaLabel="Modifier name" value={mod.name} {...nameEdit} onCommit={(v) => edits.setModifierField(mod.id, mod.name, "name", v)} className="w-full" />
        </td>
        <td className="px-3 py-1">
          <Link href={`/stores/${storeId}/groups?group=${template.id}`} className="hover:underline">
            {template.name}
          </Link>
        </td>
        <td className="px-2 py-1">
          <InlineEdit
            ariaLabel="Modifier price"
            inputMode="decimal"
            value={mod.priceCents}
            {...priceEdit}
            onCommit={(v) => edits.setModifierField(mod.id, mod.name, "price", v)}
            className="w-20 text-right tabular-nums"
          />
        </td>
        <td className="px-3 py-1">
          <StockDot inStock={mod.inStock} onToggle={() => edits.setStock(mod.id, !mod.inStock)} scopeHint="everywhere" />
        </td>
        <td className="px-3 py-1 tabular-nums">{template.usedBy}</td>
        <td className="px-3 py-1">
          {itemValues.length === 0 ? (
            <span className="text-xs text-muted-foreground">Same on all items</span>
          ) : (
            <button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline dark:text-amber-400">
              {open ? <ChevronDownIcon className="size-3.5" /> : <ChevronRightIcon className="size-3.5" />}
              {itemValues.length} item{itemValues.length === 1 ? " has its" : "s have their"} own value
            </button>
          )}
        </td>
      </tr>
      {open &&
        itemValues.map((v) => (
          <tr key={v.itemId} className="bg-amber-50/60 text-xs dark:bg-amber-950/20">
            <td className="py-1 pr-2 pl-8" colSpan={2}>
              <Link href={`/stores/${storeId}/menu?item=${v.itemId}`} className="hover:underline">
                {v.itemName}
              </Link>
            </td>
            <td className="px-3 py-1 text-right whitespace-nowrap text-amber-800 dark:text-amber-300">{v.text}</td>
            <td colSpan={3} />
          </tr>
        ))}
    </>
  );
}

function ExtraModifierRow({ storeId, row }: { storeId: string; row: ExtraRow }) {
  const { run } = useChange();
  const confirm = useConfirm();
  const { mod } = row;
  const extraId = mod.extraId!;
  return (
    <tr className="hover:bg-muted/40">
      <td className="px-2 py-1">
        <div className="flex items-center">
          <InlineEdit ariaLabel="Modifier name" value={mod.name} {...nameEdit} onCommit={(v) => run(() => updateExtraAction({ extraId, patch: { name: v } }))} className="w-full" />
        </div>
      </td>
      <td className="px-3 py-1">
        <Link href={`/stores/${storeId}/groups?group=${row.groupId}`} className="hover:underline">
          {row.groupName}
        </Link>
      </td>
      <td className="px-2 py-1">
        <InlineEdit
          ariaLabel="Modifier price"
          inputMode="decimal"
          value={mod.priceCents}
          {...priceEdit}
          onCommit={(v) => run(() => updateExtraAction({ extraId, patch: { priceCents: v } }))}
          className="w-20 text-right tabular-nums"
        />
      </td>
      <td className="px-3 py-1">
        <StockDot inStock={mod.inStock} onToggle={() => run(() => updateExtraAction({ extraId, patch: { inStock: !mod.inStock } }))} scopeHint="on this item" />
      </td>
      <td className="px-3 py-1 tabular-nums">1</td>
      <td className="px-3 py-1">
        <span className="mr-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">only on</span>
        <Link href={`/stores/${storeId}/menu?item=${row.itemId}`} className="text-xs hover:underline">
          {row.itemName}
        </Link>
        <Button
          variant="ghost"
          size="xs"
          className="ml-2"
          onClick={async () => {
            if (await confirm({ title: `Remove "${mod.name}" from ${row.itemName}?`, confirmLabel: "Remove", destructive: true })) await run(() => deleteExtraAction({ extraId }));
          }}
        >
          Remove
        </Button>
      </td>
    </tr>
  );
}

export function ModifiersView({ data }: { data: EditorData }) {
  const rows = useMemo(() => buildRows(data), [data]);
  const [search, setSearch] = useState("");
  const [onlyCustomized, setOnlyCustomized] = useState(false);
  const q = search.trim().toLowerCase();
  const shown = rows.filter((r) => {
    const groupName = r.kind === "shared" ? r.template.name : r.groupName;
    if (q && !r.mod.name.toLowerCase().includes(q) && !groupName.toLowerCase().includes(q)) return false;
    if (onlyCustomized) return r.kind === "extra" || r.itemValues.length > 0;
    return true;
  });
  const customizedCount = rows.filter((r) => r.kind === "extra" || r.itemValues.length > 0).length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Modifiers</h1>
            <p className="text-sm text-muted-foreground">
              {rows.length} modifiers · {customizedCount} differ on some items. Edits here apply to all linked items by default.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Label className="flex items-center gap-2 text-sm font-normal">
              <Checkbox checked={onlyCustomized} onCheckedChange={(c) => setOnlyCustomized(!!c)} /> Only ones that differ by item
            </Label>
            <div className="relative">
              <SearchIcon className="absolute top-2 left-2 size-4 text-muted-foreground" />
              <Input placeholder="Search modifiers or modifier groups…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-60 pl-8" />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Modifier</th>
                <th className="px-3 py-2 font-medium">Modifier Group</th>
                <th className="px-3 py-2 text-right font-medium">Price</th>
                <th className="px-3 py-2 font-medium">Stock</th>
                <th className="px-3 py-2 font-medium">Items</th>
                <th className="px-3 py-2 font-medium">Per-item differences</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y")}>
              {shown.map((r) =>
                r.kind === "shared" ? <SharedModifierRow key={r.key} storeId={data.storeId} row={r} /> : <ExtraModifierRow key={r.key} storeId={data.storeId} row={r} />,
              )}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-muted-foreground">
                    No modifiers match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
