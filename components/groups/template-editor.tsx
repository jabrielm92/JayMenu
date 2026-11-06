"use client";

import { ExternalLinkIcon, Trash2Icon, XIcon } from "lucide-react";
import Link from "next/link";
import { deleteGroupAction } from "@/app/stores/[storeId]/actions";
import { InlineEdit } from "@/components/editor/inline-edit";
import { AddOptionForm } from "@/components/menu/add-option-form";
import { MinMaxEdit } from "@/components/menu/min-max-edit";
import { OptionRow } from "@/components/menu/option-row";
import { useGroupEdits } from "@/components/menu/use-group-edits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TemplateSummary } from "@/lib/menu/resolve";

/** Edits the shared template. Changes default to "All linked items". */
export function TemplateEditor({ storeId, template, onClose }: { storeId: string; template: TemplateSummary; onClose: () => void }) {
  const edits = useGroupEdits(template);
  const { run, confirm } = edits;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <InlineEdit
          ariaLabel="Group name"
          value={template.name}
          format={(v) => v}
          parse={(s) => (s.trim() ? s.trim() : undefined)}
          onCommit={(v) => edits.setGroupField("name", v)}
          className="h-9 flex-1 text-lg font-semibold"
        />
        <Badge variant="secondary">Shared template</Badge>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Delete group"
          onClick={async () => {
            const ok = await confirm({
              title: `Delete group "${template.name}"?`,
              description: template.usedBy
                ? `It will be unlinked from ${template.usedBy} item(s), including their customizations. You can undo before publishing.`
                : "It isn't linked to any items.",
              confirmLabel: "Delete group",
              destructive: true,
            });
            if (ok && (await run(() => deleteGroupAction({ groupId: template.id })))) onClose();
          }}
        >
          <Trash2Icon />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          <XIcon />
        </Button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <section className="rounded-lg border bg-card">
          <div className="border-b px-3 py-2">
            <MinMaxEdit min={template.minSelect} max={template.maxSelect} onMin={(v) => edits.setGroupField("min", v)} onMax={(v) => edits.setGroupField("max", v)} />
            <p className="mt-1 text-xs text-muted-foreground">Edits here apply to all linked items by default, except where an item has its own value.</p>
          </div>
          <div className="space-y-0.5 p-2">
            {template.modifiers.map((m) => (
              <OptionRow
                key={m.id}
                name={m.name}
                priceCents={m.priceCents}
                inStock={m.inStock}
                stockHint="everywhere"
                onName={(v) => edits.setModifierField(m.id, m.name, "name", v)}
                onPrice={(v) => edits.setModifierField(m.id, m.name, "price", v)}
                onStock={() => edits.setStock(m.id, !m.inStock)}
                onHide={() => edits.hideModifier(m.id, m.name)}
                hideLabel="Delete option"
              />
            ))}
            {template.modifiers.length === 0 && <p className="px-2 py-1 text-sm text-muted-foreground">No options yet.</p>}
            <div className="pt-1">
              <AddOptionForm onAdd={edits.addModifier} />
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-2 font-semibold">
            Where used <span className="font-normal text-muted-foreground">· {template.usedBy} items · {template.customizedCount} customized</span>
          </h3>
          {template.links.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not linked to any items. Link it from an item in the Menu editor.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {template.links.map((l) => (
                <li key={l.linkId}>
                  <Link href={`/stores/${storeId}/menu?item=${l.itemId}`} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50">
                    <span className="flex-1">{l.itemName}</span>
                    {l.isCustomized ? (
                      <Badge className="border-amber-300 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Customized</Badge>
                    ) : (
                      <Badge variant="outline">Shared</Badge>
                    )}
                    <ExternalLinkIcon className="size-3.5 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
