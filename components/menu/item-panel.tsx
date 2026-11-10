"use client";

import { ChevronLeftIcon, Trash2Icon, XIcon } from "lucide-react";
import { deleteItemAction, updateItemAction } from "@/app/stores/[storeId]/actions";
import { useConfirm } from "@/components/editor/confirm";
import { useChange } from "@/components/editor/use-change";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ResolvedItem, TemplateSummary } from "@/lib/menu/resolve";
import { formatCents, parseDollarsToCents } from "@/lib/money";
import { GroupCard } from "./group-card";
import { CopyFromDialog } from "./copy-from-dialog";
import { LinkGroupDialog } from "./link-group-dialog";

type Patch = Parameters<typeof updateItemAction>[0];

export function ItemPanel({ storeId, item, templates, onClose }: { storeId: string; item: ResolvedItem; templates: TemplateSummary[]; onClose: () => void }) {
  const { run } = useChange();
  const confirm = useConfirm();
  const save = (patch: Record<string, unknown>) => run(() => updateItemAction({ itemId: item.id, patch } satisfies Patch));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Button variant="ghost" size="sm" className="-ml-2 lg:hidden" onClick={onClose}>
          <ChevronLeftIcon /> Back
        </Button>
        <h2 className="flex-1 truncate text-lg font-semibold">{item.name}</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Delete item"
          onClick={async () => {
            if (await confirm({ title: `Delete "${item.name}"?`, description: "Its group links and customizations are removed too. You can undo before publishing.", confirmLabel: "Delete item", destructive: true })) {
              if (await run(() => deleteItemAction({ itemId: item.id }))) onClose();
            }
          }}
        >
          <Trash2Icon />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Close panel" onClick={onClose} className="hidden lg:inline-flex">
          <XIcon />
        </Button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {/* key forces the uncontrolled inputs to pick up server values after each save */}
        <section key={JSON.stringify([item.name, item.priceCents, item.description, item.imageUrl])} className="grid gap-3">
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="item-name">Name</Label>
              <Input id="item-name" defaultValue={item.name} onBlur={(e) => e.target.value.trim() && e.target.value !== item.name && save({ name: e.target.value.trim() })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="item-price">Price</Label>
              <Input
                id="item-price"
                inputMode="decimal"
                defaultValue={formatCents(item.priceCents)}
                onBlur={(e) => {
                  const c = parseDollarsToCents(e.target.value);
                  if (c === null || c < 0) e.target.value = formatCents(item.priceCents);
                  else if (c !== item.priceCents) save({ priceCents: c });
                }}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="item-desc">Description</Label>
            <Textarea id="item-desc" rows={2} defaultValue={item.description ?? ""} onBlur={(e) => e.target.value.trim() !== (item.description ?? "") && save({ description: e.target.value.trim() || null })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="item-img">Image URL</Label>
            <Input
              id="item-img"
              type="url"
              placeholder="https://…"
              defaultValue={item.imageUrl ?? ""}
              onBlur={(e) => e.target.value.trim() !== (item.imageUrl ?? "") && save({ imageUrl: e.target.value.trim() || null })}
            />
          </div>
          <div className="flex gap-6">
            <Label className="flex items-center gap-2 font-normal">
              <Switch checked={item.isAvailable} onCheckedChange={(v) => save({ isAvailable: v })} /> Available
            </Label>
            <Label className="flex items-center gap-2 font-normal">
              <Switch checked={item.taxable} onCheckedChange={(v) => save({ taxable: v })} /> Taxable
            </Label>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Modifier Groups</h3>
            <div className="flex gap-2">
              <CopyFromDialog item={item} />
              <LinkGroupDialog storeId={storeId} item={item} templates={templates} />
            </div>
          </div>
          {item.groups.length === 0 && <p className="text-sm text-muted-foreground">No modifier groups linked yet.</p>}
          {item.groups.map((g) => {
            const template = templates.find((t) => t.id === g.groupId);
            return template ? <GroupCard key={g.linkId} item={item} group={g} template={template} /> : null;
          })}
        </section>
      </div>
    </div>
  );
}
