"use client";

/**
 * Modifiers: every modifier in the store, its modifier group, how many items use it,
 * and which items have their own value. Edits here default to "All linked items".
 */
import { ChevronDownIcon, ChevronRightIcon, CopyIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { deleteExtraAction, updateExtraAction } from "@/app/stores/[storeId]/actions";
import { useChange } from "@/components/editor/use-change";
import { InlineEdit } from "@/components/editor/inline-edit";
import { CopyMenu, StockDot } from "@/components/menu/option-row";
import { useCopy } from "@/components/menu/use-copy";
import { useGroupEdits } from "@/components/menu/use-group-edits";
import { MenuDataProvider } from "@/components/editor/menu-data";
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
  const copy = useCopy(template);
  const [open, setOpen] = useState(false);
  const sharedCopy = [
    { label: "Show/hide on items…", onClick: () => copy.chooseModifierItems(mod.id, mod.name) },
    { label: "Copy to other modifier groups…", onClick: () => copy.copyModifierToGroups({ modifierId: mod.id }, mod.name) },
  ];
  return (
    <>
      <tr className="hover:bg-muted/40">
        <td className="px-2 py-1">
          <InlineEdit ariaLabel="Modifier name" value={mod.name} {...nameEdit} onCommit={(v) => edits.setModifierField(mod.id, mod.name, "name", v)} className="w-full" />
          {/* Phones: the other columns, stacked under the name. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1.5 pb-1 text-xs text-muted-foreground md:hidden">
            <StockDot inStock={mod.inStock} onToggle={() => edits.setStock(mod.id, !mod.inStock)} scopeHint="everywhere" />
            <Link href={`/stores/${storeId}/groups?group=${template.id}`} className="underline-offset-2 hover:underline">
              {template.name}
            </Link>
            <CopyMenu entries={sharedCopy}>
              <span className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
                {template.usedBy} items <CopyIcon className="size-3" />
              </span>
            </CopyMenu>
            {itemValues.length > 0 && (
              <button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
                {open ? <ChevronDownIcon className="size-3.5" /> : <ChevronRightIcon className="size-3.5" />}
                {itemValues.length} differ
              </button>
            )}
          </div>
        </td>
        <td className="hidden px-3 py-1 md:table-cell">
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
        <td className="hidden px-3 py-1 md:table-cell">
          <StockDot inStock={mod.inStock} onToggle={() => edits.setStock(mod.id, !mod.inStock)} scopeHint="everywhere" />
        </td>
        <td className="hidden px-3 py-1 md:table-cell tabular-nums">
          <CopyMenu entries={sharedCopy}>
            <span className="inline-flex items-center gap-1 hover:underline">
              {template.usedBy} <CopyIcon className="size-3 text-muted-foreground" />
            </span>
          </CopyMenu>
        </td>
        <td className="hidden px-3 py-1 md:table-cell">
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
            <td className="py-1 pr-3 pl-8" colSpan={6}>
              <div className="flex justify-between gap-3 md:justify-start md:gap-10">
                <Link href={`/stores/${storeId}/menu?item=${v.itemId}`} className="hover:underline md:w-64">
                  {v.itemName}
                </Link>
                <span className="text-right text-amber-800 dark:text-amber-300">{v.text}</span>
              </div>
            </td>
          </tr>
        ))}
    </>
  );
}

function ExtraModifierRow({ storeId, row, template }: { storeId: string; row: ExtraRow; template: TemplateSummary }) {
  const { run } = useChange();
  const confirm = useConfirm();
  const { mod } = row;
  const extraId = mod.extraId!;
  const copy = useCopy(template);
  const extraCopy = [
    { label: `Copy to other items with ${row.groupName}…`, onClick: () => copy.copyExtra(extraId, mod.name, row.itemId) },
    { label: "Copy to other modifier groups…", onClick: () => copy.copyModifierToGroups({ extraId }, mod.name) },
  ];
  return (
    <tr className="hover:bg-muted/40">
      <td className="px-2 py-1">
        <div className="flex items-center">
          <InlineEdit ariaLabel="Modifier name" value={mod.name} {...nameEdit} onCommit={(v) => run(() => updateExtraAction({ extraId, patch: { name: v } }))} className="w-full" />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1.5 pb-1 text-xs text-muted-foreground md:hidden">
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">only on</span>
          <Link href={`/stores/${storeId}/menu?item=${row.itemId}`} className="underline-offset-2 hover:underline">
            {row.itemName}
          </Link>
          <span>{row.groupName}</span>
          <CopyMenu entries={extraCopy}>
            <span className="inline-flex items-center gap-1 text-primary">
              <CopyIcon className="size-3" /> Copy
            </span>
          </CopyMenu>
        </div>
      </td>
      <td className="hidden px-3 py-1 md:table-cell">
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
      <td className="hidden px-3 py-1 md:table-cell">
        <StockDot inStock={mod.inStock} onToggle={() => run(() => updateExtraAction({ extraId, patch: { inStock: !mod.inStock } }))} scopeHint="on this item" />
      </td>
      <td className="hidden px-3 py-1 md:table-cell tabular-nums">1</td>
      <td className="hidden px-3 py-1 md:table-cell">
        <span className="mr-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">only on</span>
        <Link href={`/stores/${storeId}/menu?item=${row.itemId}`} className="text-xs hover:underline">
          {row.itemName}
        </Link>
        <CopyMenu entries={extraCopy}>
          <span className="ml-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs hover:bg-muted">
            <CopyIcon className="size-3" /> Copy
          </span>
        </CopyMenu>
        <Button
          variant="ghost"
          size="xs"
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
    <MenuDataProvider categories={data.menu.categories} templates={data.templates}>
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Modifiers</h1>
            <p className="text-sm text-muted-foreground">
              {rows.length} modifiers · {customizedCount} differ on some items. Edits here apply to all linked items by default.
            </p>
          </div>
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
            <Label className="flex items-center gap-2 text-sm font-normal">
              <Checkbox checked={onlyCustomized} onCheckedChange={(c) => setOnlyCustomized(!!c)} /> Only ones that differ by item
            </Label>
            <div className="relative w-full sm:w-auto">
              <SearchIcon className="absolute top-2 left-2 size-4 text-muted-foreground" />
              <Input placeholder="Search modifiers or modifier groups…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-full pl-8 sm:w-60" />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Modifier</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">Modifier Group</th>
                <th className="px-3 py-2 text-right font-medium">Price</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">Stock</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">Items</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">Per-item differences</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y")}>
              {shown.map((r) =>
                r.kind === "shared" ? <SharedModifierRow key={r.key} storeId={data.storeId} row={r} /> : <ExtraModifierRow key={r.key} storeId={data.storeId} row={r} template={data.templates.find((t) => t.id === r.groupId)!} />,
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
    </MenuDataProvider>
  );
}
