"use client";

/** Compare Drawer (7.4): shared value vs this item, with per-row Reset and Reset all. */
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { ResetTarget } from "@/lib/menu/changes";
import type { ResolvedGroup, ResolvedItem, TemplateSummary } from "@/lib/menu/resolve";
import { formatAddOn } from "@/lib/money";
import { cn } from "@/lib/utils";

type Row = { key: string; label: string; shared: string; mine: string; differs: boolean; target?: ResetTarget };

const maxText = (v: number | null) => (v === null ? "no limit" : String(v));
const optText = (name: string, price: number) => `${name}${price ? ` ${formatAddOn(price)}` : ""}`;

function buildRows(group: ResolvedGroup, template: TemplateSummary): Row[] {
  const rows: Row[] = [
    { key: "name", label: "Group name", shared: template.name, mine: group.name, differs: group.overriddenFields.includes("name"), target: { kind: "group", field: "name" } },
    { key: "min", label: "Min", shared: String(template.minSelect), mine: String(group.minSelect), differs: group.overriddenFields.includes("min"), target: { kind: "group", field: "min" } },
    { key: "max", label: "Max", shared: maxText(template.maxSelect), mine: maxText(group.maxSelect), differs: group.overriddenFields.includes("max"), target: { kind: "group", field: "max" } },
  ];
  for (const t of template.modifiers) {
    const mine = group.modifiers.find((m) => m.modifierId === t.id);
    const hidden = group.hiddenModifierIds.includes(t.id);
    rows.push({
      key: t.id,
      label: "Modifier",
      shared: optText(t.name, t.priceCents),
      mine: hidden ? "Hidden" : mine ? optText(mine.name, mine.priceCents) : "—",
      differs: hidden || (mine?.overridden.length ?? 0) > 0,
      target: { kind: "modifier", modifierId: t.id },
    });
  }
  for (const m of group.modifiers.filter((x) => x.source === "extra")) {
    rows.push({ key: m.extraId!, label: "Item-only modifier", shared: "—", mine: optText(m.name, m.priceCents), differs: true, target: { kind: "extras" } });
  }
  return rows;
}

export function CompareDrawer({
  open,
  onOpenChange,
  item,
  group,
  template,
  onReset,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item: ResolvedItem;
  group: ResolvedGroup;
  template: TemplateSummary;
  onReset: (targets?: ResetTarget[]) => Promise<boolean>;
}) {
  const rows = buildRows(group, template);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Compare: {template.name}</SheetTitle>
          <SheetDescription>Shared group vs {item.name}. Amber rows are this item&apos;s own values.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 font-medium">Shared value</th>
                <th className="py-2 font-medium">This item</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className={cn("border-b last:border-0", r.differs && "bg-amber-50 dark:bg-amber-950/30")}>
                  <td className="py-2 pr-2">
                    <div className="text-[10px] uppercase text-muted-foreground">{r.label}</div>
                    {r.shared}
                  </td>
                  <td className={cn("py-2 pr-2", r.differs && "font-medium text-amber-800 dark:text-amber-300")}>{r.mine}</td>
                  <td className="py-2 text-right">
                    {r.differs && r.target && (
                      <Button size="xs" variant="outline" onClick={() => onReset([r.target!])}>
                        Reset
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <SheetFooter>
          <Button disabled={!group.isCustomized} onClick={async () => (await onReset()) && onOpenChange(false)}>
            Reset all to shared
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
