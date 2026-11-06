"use client";

import { useState } from "react";
import { createGroupAction } from "@/app/stores/[storeId]/actions";
import { useChange } from "@/components/editor/use-change";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseDollarsToCents } from "@/lib/money";

/** Options are entered one per line, e.g. "Medium +0.50". */
function parseOptions(text: string) {
  const out: { name: string; priceCents: number }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(.*?)\s+\+?\$?(\d+(?:\.\d{1,2})?)$/);
    if (m) out.push({ name: m[1].trim(), priceCents: parseDollarsToCents(m[2]) ?? 0 });
    else out.push({ name: line, priceCents: 0 });
  }
  return out;
}

export function CreateGroupDialog({ storeId, open, onOpenChange }: { storeId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = useState("");
  const [min, setMin] = useState("0");
  const [max, setMax] = useState("1");
  const [options, setOptions] = useState("");
  const { run, pending } = useChange();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New shared group</DialogTitle>
          <DialogDescription>Link it to items from the Menu editor.</DialogDescription>
        </DialogHeader>
        <form
          id="new-group"
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await run(() =>
              createGroupAction({ storeId, name, minSelect: Number(min), maxSelect: max.trim() === "" ? null : Number(max), modifiers: parseOptions(options) }),
            );
            if (ok) {
              setName("");
              setOptions("");
              onOpenChange(false);
            }
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="ng-name">Name</Label>
            <Input id="ng-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ng-min">Min</Label>
              <Input id="ng-min" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ng-max">Max (empty = no limit)</Label>
              <Input id="ng-max" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ng-opts">Options (one per line, optional price)</Label>
            <Textarea id="ng-opts" rows={4} placeholder={"Small\nMedium +0.50\nLarge +1.00"} value={options} onChange={(e) => setOptions(e.target.value)} />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="new-group" disabled={!name.trim() || pending}>
            Create group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
