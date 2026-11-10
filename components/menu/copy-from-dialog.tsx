"use client";

/** "Copy from item…": pick another item, then which of its modifier groups to copy onto this item. */
import { CopyIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { copyGroupsFromItemAction } from "@/app/stores/[storeId]/actions";
import { useMenuCategories } from "@/components/editor/menu-data";
import { useChange } from "@/components/editor/use-change";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ResolvedItem } from "@/lib/menu/resolve";
import { cn } from "@/lib/utils";

export function CopyFromDialog({ item }: { item: ResolvedItem }) {
  const categories = useMenuCategories();
  const { run, pending } = useChange();
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [includeChanges, setIncludeChanges] = useState(true);
  const [search, setSearch] = useState("");

  const has = new Set(item.groups.map((g) => g.groupId));
  const source = categories.flatMap((c) => c.items).find((i) => i.id === sourceId) ?? null;
  const q = search.trim().toLowerCase();
  const cats = categories
    .map((c) => ({ ...c, items: c.items.filter((i) => i.id !== item.id && i.groups.length > 0 && (!q || i.name.toLowerCase().includes(q))) }))
    .filter((c) => c.items.length);
  const sourceHasChanges = source?.groups.some((g) => picked.includes(g.groupId) && g.isCustomized) ?? false;

  const reset = () => {
    setSourceId(null);
    setPicked([]);
    setSearch("");
    setIncludeChanges(true);
  };
  const choose = (id: string) => {
    const src = categories.flatMap((c) => c.items).find((i) => i.id === id)!;
    setSourceId(id);
    setPicked(src.groups.filter((g) => !has.has(g.groupId)).map((g) => g.groupId));
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CopyIcon /> Copy from item
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{source ? `Copy from ${source.name}` : `Copy modifier groups to ${item.name}`}</DialogTitle>
            <DialogDescription>
              {source ? `Tick the modifier groups to add to ${item.name}. They stay shared, not duplicated.` : "Pick the item to copy modifier groups from."}
            </DialogDescription>
          </DialogHeader>

          {!source ? (
            <>
              <div className="relative">
                <SearchIcon className="absolute top-2 left-2 size-4 text-muted-foreground" />
                <Input autoFocus placeholder="Search items…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 pl-8" />
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-md border p-2">
                {cats.map((c) => (
                  <div key={c.id}>
                    <div className="px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{c.name}</div>
                    {c.items.map((i) => (
                      <button key={i.id} type="button" onClick={() => choose(i.id)} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
                        <span>{i.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {i.groups.length} modifier group{i.groups.length === 1 ? "" : "s"}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
                {cats.length === 0 && <p className="p-2 text-sm text-muted-foreground">No items match.</p>}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5 rounded-md border p-3">
                {source.groups.map((g) => {
                  const already = has.has(g.groupId);
                  return (
                    <Label key={g.linkId} className={cn("flex items-center gap-2 font-normal", already && "text-muted-foreground")}>
                      <Checkbox
                        checked={!already && picked.includes(g.groupId)}
                        disabled={already}
                        onCheckedChange={(v) => setPicked((p) => (v ? [...p, g.groupId] : p.filter((x) => x !== g.groupId)))}
                      />
                      <span className="flex-1">{g.name}</span>
                      {already ? (
                        <span className="text-xs">already on {item.name}</span>
                      ) : (
                        g.isCustomized && <span className="text-xs text-amber-700 dark:text-amber-400">customized on {source.name}</span>
                      )}
                    </Label>
                  );
                })}
              </div>
              {sourceHasChanges && (
                <Label className="flex items-center gap-2 text-sm font-normal">
                  <Checkbox checked={includeChanges} onCheckedChange={(v) => setIncludeChanges(!!v)} /> Include {source.name}&apos;s own changes
                </Label>
              )}
            </div>
          )}

          <DialogFooter>
            {source ? (
              <>
                <Button variant="outline" onClick={() => setSourceId(null)}>
                  Back
                </Button>
                <Button
                  disabled={picked.length === 0 || pending}
                  onClick={async () => {
                    const ok = await run(() =>
                      copyGroupsFromItemAction({ sourceItemId: source.id, targetItemId: item.id, groupIds: picked, includeChanges: sourceHasChanges && includeChanges }),
                    );
                    if (ok) {
                      setOpen(false);
                      reset();
                    }
                  }}
                >
                  Copy {picked.length} modifier group{picked.length === 1 ? "" : "s"}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
