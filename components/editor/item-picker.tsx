"use client";

/**
 * "Pick items" dialog used by every Copy action.
 * `const pickItems = useItemPicker(); const r = await pickItems({...}); if (r) ...`
 */
import { SearchIcon } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type PickerCategory = { id: string; name: string; items: { id: string; name: string }[] };

export type PickItemsRequest = {
  title: string;
  description?: string;
  categories: PickerCategory[];
  /** Only these items are listed (e.g. items that have a modifier group). Default: all. */
  onlyItemIds?: string[];
  /** Listed but not selectable, with a reason (e.g. "already has it"). */
  disabled?: Record<string, string>;
  initialSelected?: string[];
  /** Optional checkbox shown above the buttons, e.g. "Include this item's changes". */
  toggle?: { label: string; defaultChecked: boolean };
  confirmLabel: (count: number) => string;
  /** Allow confirming with nothing selected. */
  allowEmpty?: boolean;
};

export type PickItemsResult = { itemIds: string[]; toggle: boolean };

const PickerContext = createContext<(r: PickItemsRequest) => Promise<PickItemsResult | null>>(async () => null);
export const useItemPicker = () => useContext(PickerContext);

export function ItemPickerProvider({ children }: { children: React.ReactNode }) {
  const [req, setReq] = useState<PickItemsRequest | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toggle, setToggle] = useState(false);
  const [search, setSearch] = useState("");
  const resolver = useRef<(v: PickItemsResult | null) => void>(undefined);

  const pick = useCallback(
    (r: PickItemsRequest) =>
      new Promise<PickItemsResult | null>((resolve) => {
        resolver.current = resolve;
        setSelected(new Set(r.initialSelected ?? []));
        setToggle(r.toggle?.defaultChecked ?? false);
        setSearch("");
        setReq(r);
      }),
    [],
  );

  const finish = (v: PickItemsResult | null) => {
    resolver.current?.(v);
    resolver.current = undefined;
    setReq(null);
  };

  const q = search.trim().toLowerCase();
  const only = req?.onlyItemIds ? new Set(req.onlyItemIds) : null;
  const cats = (req?.categories ?? [])
    .map((c) => ({ ...c, items: c.items.filter((i) => (!only || only.has(i.id)) && (!q || i.name.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))) }))
    .filter((c) => c.items.length > 0);
  const selectable = (id: string) => !req?.disabled?.[id];
  const toggleItem = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <PickerContext.Provider value={pick}>
      {children}
      <Dialog open={!!req} onOpenChange={(o) => !o && finish(null)}>
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{req?.title}</DialogTitle>
            {req?.description && <DialogDescription>{req.description}</DialogDescription>}
          </DialogHeader>
          <div className="relative">
            <SearchIcon className="absolute top-2 left-2 size-4 text-muted-foreground" />
            <Input placeholder="Search items or categories…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 pl-8" />
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto rounded-md border p-3">
            {cats.length === 0 && <p className="text-sm text-muted-foreground">No items match.</p>}
            {cats.map((c) => {
              const ids = c.items.map((i) => i.id).filter(selectable);
              const all = ids.length > 0 && ids.every((id) => selected.has(id));
              return (
                <div key={c.id}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{c.name}</span>
                    {ids.length > 1 && (
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => setSelected((prev) => new Set(all ? [...prev].filter((x) => !ids.includes(x)) : [...prev, ...ids]))}
                      >
                        {all ? "Clear" : "Select all"}
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {c.items.map((i) => {
                      const reason = req?.disabled?.[i.id];
                      return (
                        <Label key={i.id} className={`flex items-center gap-2 font-normal ${reason ? "text-muted-foreground" : ""}`}>
                          <Checkbox checked={reason ? false : selected.has(i.id)} disabled={!!reason} onCheckedChange={(v) => toggleItem(i.id, !!v)} />
                          <span className="flex-1">{i.name}</span>
                          {reason && <span className="text-xs">{reason}</span>}
                        </Label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {req?.toggle && (
            <Label className="flex items-center gap-2 text-sm font-normal">
              <Checkbox checked={toggle} onCheckedChange={(v) => setToggle(!!v)} /> {req.toggle.label}
            </Label>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => finish(null)}>
              Cancel
            </Button>
            <Button disabled={!req?.allowEmpty && selected.size === 0} onClick={() => finish({ itemIds: [...selected].filter(selectable), toggle })}>
              {req?.confirmLabel([...selected].filter(selectable).length)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PickerContext.Provider>
  );
}
