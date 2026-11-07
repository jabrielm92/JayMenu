"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { createGroupAction, linkGroupAction } from "@/app/stores/[storeId]/actions";
import { useChange } from "@/components/editor/use-change";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ResolvedItem, TemplateSummary } from "@/lib/menu/resolve";

/** "+ Link group": search existing groups or create a new one for this item. */
export function LinkGroupDialog({ storeId, item, templates }: { storeId: string; item: ResolvedItem; templates: TemplateSummary[] }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"search" | "create">("search");
  const [name, setName] = useState("");
  const [min, setMin] = useState("0");
  const [max, setMax] = useState("1");
  const { run, pending } = useChange();
  const linked = new Set(item.groups.map((g) => g.groupId));
  const available = templates.filter((t) => !linked.has(t.id));

  const close = () => {
    setOpen(false);
    setMode("search");
    setName("");
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PlusIcon /> Add modifier group
      </Button>
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{mode === "search" ? `Add a modifier group to ${item.name}` : "Create a new modifier group"}</DialogTitle>
            <DialogDescription>
              {mode === "search" ? "Pick a shared modifier group. You can customize it for this item afterwards." : `It will be linked to ${item.name}. Add modifiers after creating it.`}
            </DialogDescription>
          </DialogHeader>
          {mode === "search" ? (
            <Command className="rounded-md border">
              <CommandInput placeholder="Search modifier groups…" />
              <CommandList>
                <CommandEmpty>No matching modifier groups.</CommandEmpty>
                <CommandGroup>
                  {available.map((t) => (
                    <CommandItem
                      key={t.id}
                      value={t.name}
                      disabled={pending}
                      onSelect={async () => {
                        if (await run(() => linkGroupAction({ itemIds: [item.id], groupId: t.id }))) close();
                      }}
                    >
                      <span className="flex-1">{t.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {t.modifiers.length} modifiers · used by {t.usedBy}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          ) : (
            <form
              id="create-group"
              className="grid gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const minN = Number(min);
                const maxN = max.trim() === "" ? null : Number(max);
                if (await run(() => createGroupAction({ storeId, name, minSelect: minN, maxSelect: maxN, linkToItemId: item.id }))) close();
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="g-name">Name</Label>
                <Input id="g-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="g-min">Min</Label>
                  <Input id="g-min" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="g-max">Max (empty = no limit)</Label>
                  <Input id="g-max" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} />
                </div>
              </div>
            </form>
          )}
          <DialogFooter>
            {mode === "search" ? (
              <Button variant="outline" onClick={() => setMode("create")}>
                <PlusIcon /> Create new modifier group
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setMode("search")}>
                  Back
                </Button>
                <Button type="submit" form="create-group" disabled={!name.trim() || pending}>
                  Create &amp; link
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
