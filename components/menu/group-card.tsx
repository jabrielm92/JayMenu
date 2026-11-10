"use client";

import { CopyIcon, GitCompareIcon, MoreHorizontalIcon, RotateCcwIcon, ScissorsIcon, UnlinkIcon } from "lucide-react";
import { useState } from "react";
import {
  deleteExtraAction,
  detachGroupAction,
  resetOverridesAction,
  unlinkGroupAction,
  updateExtraAction,
} from "@/app/stores/[storeId]/actions";
import { InlineEdit } from "@/components/editor/inline-edit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ResetTarget } from "@/lib/menu/changes";
import type { ResolvedGroup, ResolvedItem, TemplateSummary } from "@/lib/menu/resolve";
import { cn } from "@/lib/utils";
import { AddOptionForm } from "./add-option-form";
import { CompareDrawer } from "./compare-drawer";
import { MinMaxEdit } from "./min-max-edit";
import { AMBER, OptionRow, ResetButton } from "./option-row";
import { useCopy } from "./use-copy";
import { useGroupEdits } from "./use-group-edits";

export function SharedBadge({ group }: { group: ResolvedGroup }) {
  if (group.isCustomized)
    return <Badge className="border-amber-300 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Customized for this item</Badge>;
  if (group.sharedWithCount === 0) return <Badge variant="outline">Only on this item</Badge>;
  return (
    <Badge variant="secondary">
      Shared · {group.sharedWithCount} other item{group.sharedWithCount === 1 ? "" : "s"}
    </Badge>
  );
}

export function GroupCard({ item, group, template }: { item: ResolvedItem; group: ResolvedGroup; template: TemplateSummary }) {
  const edits = useGroupEdits(template, item.id);
  const { run, confirm } = edits;
  const copy = useCopy(template);
  const [compareOpen, setCompareOpen] = useState(false);
  const reset = (targets?: ResetTarget[]) => run(() => resetOverridesAction({ linkId: group.linkId, targets }));
  const hiddenMods = template.modifiers.filter((m) => group.hiddenModifierIds.includes(m.id));
  const stockHint = "everywhere";

  return (
    <div className={cn("rounded-lg border bg-card", group.isCustomized && "border-amber-300 dark:border-amber-800")}>
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <div className="flex min-w-0 basis-full items-center sm:flex-1 sm:basis-auto">
          <InlineEdit
            ariaLabel="Group name"
            value={group.name}
            format={(v) => v}
            parse={(s) => (s.trim() ? s.trim() : undefined)}
            onCommit={(v) => edits.setGroupField("name", v)}
            className={cn("w-full font-semibold", group.overriddenFields.includes("name") && AMBER)}
          />
          {group.overriddenFields.includes("name") && <ResetButton label="Reset name to shared" onClick={() => reset([{ kind: "group", field: "name" }])} />}
        </div>
        <SharedBadge group={group} />
        <Button variant="ghost" size="xs" className="ml-auto sm:ml-0" onClick={() => copy.copyGroup({ item, group })}>
          <CopyIcon /> Copy to items
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label="Group actions" />}>
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => setCompareOpen(true)}>
              <GitCompareIcon /> Compare with shared
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!group.isCustomized} onClick={() => reset()}>
              <RotateCcwIcon /> Reset all to shared
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={group.sharedWithCount === 0}
              onClick={async () => {
                const ok = await confirm({
                  title: `Detach ${group.name} from the shared group?`,
                  description: `${item.name} gets its own copy "${group.name} (${item.name})" with its current modifiers. Later changes to the shared group won't affect it.`,
                  confirmLabel: "Detach",
                });
                if (ok) await run(() => detachGroupAction({ linkId: group.linkId }));
              }}
            >
              <ScissorsIcon /> Detach (make independent)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={async () => {
                const ok = await confirm({
                  title: `Unlink ${group.name} from ${item.name}?`,
                  description: group.isCustomized ? "This item's customizations for this group will be removed too." : undefined,
                  confirmLabel: "Unlink",
                  destructive: true,
                });
                if (ok) await run(() => unlinkGroupAction({ linkId: group.linkId }));
              }}
            >
              <UnlinkIcon /> Unlink from item
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="px-3 pt-2">
        <MinMaxEdit
          min={group.minSelect}
          max={group.maxSelect}
          minOverridden={group.overriddenFields.includes("min")}
          maxOverridden={group.overriddenFields.includes("max")}
          onMin={(v) => edits.setGroupField("min", v)}
          onMax={(v) => edits.setGroupField("max", v)}
          onResetMin={() => reset([{ kind: "group", field: "min" }])}
          onResetMax={() => reset([{ kind: "group", field: "max" }])}
        />
        {group.warnings.map((w) => (
          <p key={w} className="mt-1 text-xs text-destructive">
            ⚠ {w}
          </p>
        ))}
      </div>

      <div className="space-y-0.5 p-2">
        {group.modifiers.map((m) =>
          m.source === "template" ? (
            <OptionRow
              key={m.modifierId}
              name={m.name}
              priceCents={m.priceCents}
              inStock={m.inStock}
              stockHint={stockHint}
              nameOverridden={m.overridden.includes("name")}
              priceOverridden={m.overridden.includes("price")}
              onName={(v) => edits.setModifierField(m.modifierId!, m.name, "name", v)}
              onPrice={(v) => edits.setModifierField(m.modifierId!, m.name, "price", v)}
              onStock={() => edits.setStock(m.modifierId!, !m.inStock)}
              onResetName={() => reset([{ kind: "modifier", modifierId: m.modifierId!, field: "name" }])}
              onResetPrice={() => reset([{ kind: "modifier", modifierId: m.modifierId!, field: "price" }])}
              onHide={() => edits.hideModifier(m.modifierId!, m.name)}
              hideLabel="Hide on this item"
              onCopy={() => copy.chooseModifierItems(m.modifierId!, m.name)}
              copyLabel="Choose which items have it…"
            />
          ) : (
            <OptionRow
              key={m.extraId}
              extra
              name={m.name}
              priceCents={m.priceCents}
              inStock={m.inStock}
              stockHint="on this item"
              onName={(v) => run(() => updateExtraAction({ extraId: m.extraId, patch: { name: v } }))}
              onPrice={(v) => run(() => updateExtraAction({ extraId: m.extraId, patch: { priceCents: v } }))}
              onStock={() => run(() => updateExtraAction({ extraId: m.extraId, patch: { inStock: !m.inStock } }))}
              onCopy={() => copy.copyExtra(m.extraId!, m.name, item.id)}
              copyLabel="Copy to other items…"
              onDelete={async () => {
                if (await confirm({ title: `Remove "${m.name}" from ${item.name}?`, confirmLabel: "Remove", destructive: true }))
                  await run(() => deleteExtraAction({ extraId: m.extraId }));
              }}
            />
          ),
        )}
        {hiddenMods.map((m) => (
          <OptionRow
            key={m.id}
            hidden
            name={m.name}
            priceCents={m.priceCents}
            inStock={m.inStock}
            stockHint={stockHint}
            onName={async () => false}
            onPrice={async () => false}
            onStock={() => edits.setStock(m.id, !m.inStock)}
            onShow={() => edits.showModifier(m.id)}
            onCopy={() => copy.chooseModifierItems(m.id, m.name)}
            copyLabel="Choose which items have it…"
          />
        ))}
        <div className="pt-1">
          <AddOptionForm onAdd={edits.addModifier} />
        </div>
      </div>

      <CompareDrawer open={compareOpen} onOpenChange={setCompareOpen} item={item} group={group} template={template} onReset={reset} />
    </div>
  );
}
