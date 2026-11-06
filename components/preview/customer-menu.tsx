"use client";

/** Customer-style rendering of a PublicMenu (7.7). Click an item to see its choices. */
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PublicGroup, PublicItem, PublicMenu } from "@/lib/menu/resolve";
import { formatAddOn, formatCents } from "@/lib/money";

function rule(g: PublicGroup) {
  const { minSelect: min, maxSelect: max } = g;
  if (min === 0 && max === null) return "Optional";
  if (min === 0) return `Optional · up to ${max}`;
  if (max === min) return `Required · choose ${min}`;
  if (max === null) return `Required · choose at least ${min}`;
  return `Required · choose ${min}–${max}`;
}

function ItemDialog({ item, onClose }: { item: PublicItem | null; onClose: () => void }) {
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  if (!item) return null;
  const toggle = (g: PublicGroup, optId: string) =>
    setPicked((p) => {
      const cur = p[g.id] ?? [];
      if (cur.includes(optId)) return { ...p, [g.id]: cur.filter((x) => x !== optId) };
      if (g.maxSelect === 1) return { ...p, [g.id]: [optId] };
      if (g.maxSelect !== null && cur.length >= g.maxSelect) return p;
      return { ...p, [g.id]: [...cur, optId] };
    });
  const total =
    item.priceCents +
    item.modifierGroups.reduce((sum, g) => sum + (picked[g.id] ?? []).reduce((s, id) => s + (g.options.find((o) => o.id === id)?.priceCents ?? 0), 0), 0);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
          <DialogDescription>{item.description ?? formatCents(item.priceCents)}</DialogDescription>
        </DialogHeader>
        {item.modifierGroups.length === 0 && <p className="text-sm text-muted-foreground">No choices for this item.</p>}
        {item.modifierGroups.map((g) => (
          <fieldset key={g.id} className="space-y-1">
            <legend className="mb-1 flex w-full items-baseline justify-between">
              <span className="font-medium">{g.name}</span>
              <span className="text-xs text-muted-foreground">{rule(g)}</span>
            </legend>
            {g.options.map((o) => {
              const checked = (picked[g.id] ?? []).includes(o.id);
              return (
                <label key={o.id} className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm has-checked:border-primary">
                  <input type={g.maxSelect === 1 ? "radio" : "checkbox"} name={g.id} checked={checked} onChange={() => toggle(g, o.id)} className="accent-primary" />
                  <span className="flex-1">{o.name}</span>
                  <span className="text-muted-foreground">{formatAddOn(o.priceCents)}</span>
                </label>
              );
            })}
          </fieldset>
        ))}
        <div className="flex justify-between border-t pt-3 font-medium">
          <span>Total</span>
          <span>{formatCents(total)}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CustomerMenu({ menu }: { menu: PublicMenu }) {
  const [open, setOpen] = useState<PublicItem | null>(null);
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">{menu.storeName}</h1>
      <div className="space-y-8">
        {menu.categories.map((c) => (
          <section key={c.id}>
            <h2 className="mb-3 text-lg font-semibold">{c.name}</h2>
            {c.items.length === 0 && <p className="text-sm text-muted-foreground">No items available.</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {c.items.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => setOpen(i)}
                  className="rounded-lg border bg-background p-4 text-left shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{i.name}</span>
                    <span className="tabular-nums">{formatCents(i.priceCents)}</span>
                  </div>
                  {i.description && <p className="mt-1 text-sm text-muted-foreground">{i.description}</p>}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <ItemDialog key={open?.id} item={open} onClose={() => setOpen(null)} />
    </div>
  );
}
