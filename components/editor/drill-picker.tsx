"use client";

/**
 * Drill-down picker: Categories → Items (→ an item's Modifier Groups).
 *  - level "items":  tick items (copy a modifier group to items).
 *  - level "groups": tick modifier groups on items (copy a modifier into other modifier groups).
 * Ticks are kept while moving between levels. Optional "where" step asks how to add a copied modifier.
 * `const drill = useDrillPicker(); const r = await drill({...}); if (r) ...`
 */
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { ResolvedCategory, ResolvedGroup, ResolvedItem } from "@/lib/menu/resolve";
import { cn } from "@/lib/utils";

export type Pair = { itemId: string; groupId: string };
export type AddMode = "items" | "groups";

export type WhereStep = {
  /** Ask every time (true) or use `remembered` silently (false). */
  ask: boolean;
  remembered: AddMode;
  /** For the picked pairs: picked item count, and how many items use those modifier groups in total. */
  summarize: (pairs: Pair[]) => { picked: number; total: number };
  /** Saves the "ask every time" preference and last choice. */
  savePref: (ask: boolean, choice: AddMode) => void;
};

export type DrillRequest = {
  title: string;
  description?: string;
  categories: ResolvedCategory[];
  level: "items" | "groups";
  /** level "items": items that can't be picked, with a reason. */
  disabledItems?: Record<string, string>;
  /** level "groups": reason a modifier group on an item can't be picked, if any. */
  groupReason?: (item: ResolvedItem, group: ResolvedGroup) => string | undefined;
  toggle?: { label: string; defaultChecked: boolean };
  where?: WhereStep;
  confirmLabel: (count: number) => string;
};

export type DrillResult = { itemIds: string[]; pairs: Pair[]; toggle: boolean; mode: AddMode };

type View = { kind: "categories" } | { kind: "category"; id: string } | { kind: "item"; id: string; fromCategory: string };

const DrillContext = createContext<(r: DrillRequest) => Promise<DrillResult | null>>(async () => null);
export const useDrillPicker = () => useContext(DrillContext);

const pairKey = (p: Pair) => `${p.itemId}|${p.groupId}`;

export function DrillPickerProvider({ children }: { children: React.ReactNode }) {
  const [req, setReq] = useState<DrillRequest | null>(null);
  const [view, setView] = useState<View>({ kind: "categories" });
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Set<string>>(new Set());
  const [pairs, setPairs] = useState<Map<string, Pair>>(new Map());
  const [toggle, setToggle] = useState(false);
  const [ask, setAsk] = useState(true);
  const [stage, setStage] = useState<"pick" | "where">("pick");
  const [mode, setMode] = useState<AddMode>("items");
  const [dontAsk, setDontAsk] = useState(false);
  const resolver = useRef<(v: DrillResult | null) => void>(undefined);

  const drill = useCallback(
    (r: DrillRequest) =>
      new Promise<DrillResult | null>((resolve) => {
        resolver.current = resolve;
        setView({ kind: "categories" });
        setSearch("");
        setItems(new Set());
        setPairs(new Map());
        setToggle(r.toggle?.defaultChecked ?? false);
        setAsk(r.where?.ask ?? true);
        setMode(r.where?.remembered ?? "items");
        setDontAsk(false);
        setStage("pick");
        setReq(r);
      }),
    [],
  );

  const finish = (v: DrillResult | null) => {
    resolver.current?.(v);
    resolver.current = undefined;
    setReq(null);
  };

  const allItems = (req?.categories ?? []).flatMap((c) => c.items.map((i) => ({ item: i, category: c })));
  const pickable = (i: ResolvedItem) => (req?.level === "groups" ? i.groups.length > 0 : true);
  const count = req?.level === "groups" ? pairs.size : items.size;
  const pairsOn = (itemId: string) => [...pairs.values()].filter((p) => p.itemId === itemId).length;
  const selectedIn = (c: ResolvedCategory) =>
    req?.level === "groups" ? c.items.reduce((n, i) => n + pairsOn(i.id), 0) : c.items.filter((i) => items.has(i.id)).length;

  const setItem = (id: string, on: boolean) =>
    setItems((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const setPair = (p: Pair, on: boolean) =>
    setPairs((prev) => {
      const next = new Map(prev);
      if (on) next.set(pairKey(p), p);
      else next.delete(pairKey(p));
      return next;
    });

  const confirm = () => {
    if (!req) return;
    const picked = [...pairs.values()];
    const base = { itemIds: [...items], pairs: picked, toggle };
    if (req.level === "groups" && req.where) {
      const s = req.where.summarize(picked);
      if (s.picked >= s.total) return finish({ ...base, mode: "groups" }); // every item is picked: same either way
      if (!ask) return finish({ ...base, mode });
      return setStage("where");
    }
    finish({ ...base, mode: "items" });
  };

  // ---------- rows ----------

  const itemRowForItemsLevel = (i: ResolvedItem) => {
    const reason = req?.disabledItems?.[i.id];
    return (
      <Label key={i.id} className={cn("flex items-center gap-2 py-1 font-normal", reason && "text-muted-foreground")}>
        <Checkbox checked={!reason && items.has(i.id)} disabled={!!reason} onCheckedChange={(v) => setItem(i.id, !!v)} />
        <span className="flex-1">{i.name}</span>
        {reason && <span className="text-xs">{reason}</span>}
      </Label>
    );
  };

  const itemRowForGroupsLevel = (i: ResolvedItem, fromCategory: string) => {
    const n = pairsOn(i.id);
    return (
      <button
        key={i.id}
        type="button"
        onClick={() => setView({ kind: "item", id: i.id, fromCategory })}
        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
      >
        <span className="flex-1">{i.name}</span>
        {n > 0 && <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">{n}</span>}
        <span className="text-xs text-muted-foreground">{i.groups.length} groups</span>
        <ChevronRightIcon className="size-4 text-muted-foreground" />
      </button>
    );
  };

  // ---------- body ----------

  let body: React.ReactNode = null;
  let back: { label: string; to: View } | null = null;
  let heading = "";

  if (req && stage === "pick") {
    const q = search.trim().toLowerCase();
    if (view.kind === "categories") {
      heading = "Categories";
      if (q) {
        const hits = allItems.filter(({ item }) => pickable(item) && item.name.toLowerCase().includes(q));
        body = (
          <div className="space-y-0.5">
            {hits.length === 0 && <p className="p-2 text-sm text-muted-foreground">No items match.</p>}
            {hits.map(({ item, category }) => (req.level === "items" ? itemRowForItemsLevel(item) : itemRowForGroupsLevel(item, category.id)))}
          </div>
        );
      } else {
        body = (
          <div className="space-y-0.5">
            {req.categories.map((c) => {
              const n = selectedIn(c);
              const usable = c.items.filter(pickable).length;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={usable === 0}
                  onClick={() => setView({ kind: "category", id: c.id })}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2.5 text-left text-sm hover:bg-muted disabled:opacity-50"
                >
                  <span className="flex-1 font-medium">{c.name}</span>
                  {n > 0 && <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">{n} selected</span>}
                  <span className="text-xs text-muted-foreground">{usable} items</span>
                  <ChevronRightIcon className="size-4 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        );
      }
    } else if (view.kind === "category") {
      const c = req.categories.find((x) => x.id === view.id)!;
      heading = c.name;
      back = { label: "Categories", to: { kind: "categories" } };
      const list = c.items.filter(pickable);
      if (req.level === "items") {
        const ids = list.filter((i) => !req.disabledItems?.[i.id]).map((i) => i.id);
        const all = ids.length > 0 && ids.every((id) => items.has(id));
        body = (
          <div>
            {ids.length > 1 && (
              <div className="mb-1 flex justify-end">
                <button type="button" className="text-xs text-primary hover:underline" onClick={() => ids.forEach((id) => setItem(id, !all))}>
                  {all ? "Clear" : "Select all"}
                </button>
              </div>
            )}
            {list.map(itemRowForItemsLevel)}
          </div>
        );
      } else {
        body = <div className="space-y-0.5">{list.map((i) => itemRowForGroupsLevel(i, c.id))}</div>;
      }
    } else {
      const entry = allItems.find(({ item }) => item.id === view.id)!;
      const item = entry.item;
      heading = item.name;
      back = { label: req.categories.find((c) => c.id === view.fromCategory)?.name ?? "Back", to: { kind: "category", id: view.fromCategory } };
      body = (
        <div className="space-y-1">
          <p className="pb-1 text-xs text-muted-foreground">Tick the modifier groups to copy into.</p>
          {item.groups.map((g) => {
            const reason = req.groupReason?.(item, g);
            const p = { itemId: item.id, groupId: g.groupId };
            return (
              <Label key={g.linkId} className={cn("flex items-center gap-2 py-1 font-normal", reason && "text-muted-foreground")}>
                <Checkbox checked={!reason && pairs.has(pairKey(p))} disabled={!!reason} onCheckedChange={(v) => setPair(p, !!v)} />
                <span className="flex-1">{g.name}</span>
                {reason && <span className="text-xs">{reason}</span>}
              </Label>
            );
          })}
        </div>
      );
    }
  }

  const where = req?.where;
  const summary = where && stage === "where" ? where.summarize([...pairs.values()]) : null;

  return (
    <DrillContext.Provider value={drill}>
      {children}
      <Dialog open={!!req} onOpenChange={(o) => !o && finish(null)}>
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{req?.title}</DialogTitle>
            {req?.description && stage === "pick" && <DialogDescription>{req.description}</DialogDescription>}
          </DialogHeader>

          {stage === "pick" ? (
            <>
              {view.kind === "categories" && (
                <div className="relative">
                  <SearchIcon className="absolute top-2 left-2 size-4 text-muted-foreground" />
                  <Input placeholder="Search items…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 pl-8" />
                </div>
              )}
              {view.kind !== "categories" && (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="-ml-2" onClick={() => back && setView(back.to)}>
                    <ChevronLeftIcon /> {back?.label}
                  </Button>
                  <span className="truncate text-sm font-medium">{heading}</span>
                </div>
              )}
              <div className="min-h-48 flex-1 overflow-y-auto rounded-md border p-2">{body}</div>
              {req?.toggle && (
                <Label className="flex items-center gap-2 text-sm font-normal">
                  <Checkbox checked={toggle} onCheckedChange={(v) => setToggle(!!v)} /> {req.toggle.label}
                </Label>
              )}
              {where && !ask && (
                <p className="text-xs text-muted-foreground">
                  Adds to {mode === "items" ? "only the items you pick" : "every item that uses those modifier groups"}.{" "}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => {
                      setAsk(true);
                      where.savePref(true, mode);
                    }}
                  >
                    Ask me each time
                  </button>
                </p>
              )}
            </>
          ) : (
            summary && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Those modifier groups are used by {summary.total} items; you picked {summary.picked}. Where should it be added?
                </p>
                <RadioGroup value={mode} onValueChange={(v) => setMode(v as AddMode)} className="gap-3">
                  <Label className="flex items-start gap-2 font-normal">
                    <RadioGroupItem value="items" className="mt-0.5" />
                    <span>
                      Only the items I picked ({summary.picked})
                      <span className="block text-xs text-muted-foreground">Other items using those modifier groups don&apos;t change.</span>
                    </span>
                  </Label>
                  <Label className="flex items-start gap-2 font-normal">
                    <RadioGroupItem value="groups" className="mt-0.5" />
                    <span>
                      Every item that uses those modifier groups ({summary.total})
                      <span className="block text-xs text-muted-foreground">Added to the shared modifier group itself.</span>
                    </span>
                  </Label>
                </RadioGroup>
                <Label className="flex items-center gap-2 text-sm font-normal">
                  <Checkbox checked={dontAsk} onCheckedChange={(v) => setDontAsk(!!v)} /> Don&apos;t ask again (always do this)
                </Label>
              </div>
            )
          )}

          <DialogFooter>
            {stage === "pick" ? (
              <>
                <Button variant="outline" onClick={() => finish(null)}>
                  Cancel
                </Button>
                <Button disabled={count === 0} onClick={confirm}>
                  {req?.confirmLabel(count)}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setStage("pick")}>
                  Back
                </Button>
                <Button
                  onClick={() => {
                    where?.savePref(!dontAsk, mode);
                    finish({ itemIds: [...items], pairs: [...pairs.values()], toggle, mode });
                  }}
                >
                  Copy
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DrillContext.Provider>
  );
}
