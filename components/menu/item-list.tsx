"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { createItemAction, updateItemAction } from "@/app/stores/[storeId]/actions";
import { useChange } from "@/components/editor/use-change";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { ResolvedItem } from "@/lib/menu/resolve";
import { formatCents, parseDollarsToCents } from "@/lib/money";
import { cn } from "@/lib/utils";

function ItemBadges({ item }: { item: ResolvedItem }) {
  const n = item.groups.length;
  const c = item.groups.filter((g) => g.isCustomized).length;
  if (!n) return <span className="text-xs text-muted-foreground">No groups</span>;
  return (
    <span className="text-xs text-muted-foreground">
      {n} group{n === 1 ? "" : "s"}
      {c > 0 && <span className="text-amber-700 dark:text-amber-400"> · {c} customized</span>}
    </span>
  );
}

function AddItem({ categoryId }: { categoryId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const { run, pending } = useChange();
  const cents = parseDollarsToCents(price || "0");
  if (!open)
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <PlusIcon /> Add item
      </Button>
    );
  return (
    <form
      className="flex gap-2 p-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim() || cents === null) return;
        if (await run(() => createItemAction({ categoryId, name, priceCents: cents }))) {
          setName("");
          setPrice("");
          setOpen(false);
        }
      }}
    >
      <Input autoFocus placeholder="Item name" value={name} onChange={(e) => setName(e.target.value)} className="h-8 flex-1" />
      <Input placeholder="$0.00" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="h-8 w-20" />
      <Button size="sm" type="submit" disabled={pending || !name.trim() || cents === null}>
        Add
      </Button>
      <Button size="sm" variant="ghost" type="button" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  );
}

export function ItemList({
  title,
  items,
  categoryId,
  selectedId,
  onSelect,
}: {
  title: string;
  items: (ResolvedItem & { categoryName?: string })[];
  categoryId: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { run } = useChange();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">{items.length} items</span>
      </div>
      <ul className="flex-1 divide-y overflow-y-auto">
        {items.map((i) => (
          <li key={i.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelect(i.id)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(i.id)}
              className={cn("flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-muted/50", selectedId === i.id && "bg-muted", !i.isAvailable && "opacity-60")}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{i.name}</div>
                <div className="flex gap-2">
                  {i.categoryName && <span className="text-xs text-muted-foreground">{i.categoryName} ·</span>}
                  <ItemBadges item={i} />
                </div>
              </div>
              <span className="tabular-nums text-sm">{formatCents(i.priceCents)}</span>
              <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <Switch
                  size="sm"
                  aria-label={`${i.name} available`}
                  checked={i.isAvailable}
                  onCheckedChange={(v) => run(() => updateItemAction({ itemId: i.id, patch: { isAvailable: v } }))}
                />
              </span>
            </div>
          </li>
        ))}
        {items.length === 0 && <li className="px-4 py-6 text-sm text-muted-foreground">No items.</li>}
      </ul>
      {categoryId && (
        <div className="border-t p-2">
          <AddItem categoryId={categoryId} />
        </div>
      )}
    </div>
  );
}
