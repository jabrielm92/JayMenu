"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseDollarsToCents } from "@/lib/money";

/** Small inline "Add option" form. */
export function AddOptionForm({ onAdd, label = "Add modifier" }: { onAdd: (name: string, priceCents: number) => Promise<boolean>; label?: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  if (!open)
    return (
      <Button variant="ghost" size="xs" onClick={() => setOpen(true)}>
        <PlusIcon /> {label}
      </Button>
    );

  const cents = price.trim() ? parseDollarsToCents(price) : 0;
  const valid = name.trim().length > 0 && cents !== null;

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid) return;
        if (await onAdd(name.trim(), cents ?? 0)) {
          setName("");
          setPrice("");
          setOpen(false);
        }
      }}
    >
      <Input autoFocus placeholder="Modifier name" value={name} onChange={(e) => setName(e.target.value)} className="h-7 flex-1" />
      <Input placeholder="$0.00" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="h-7 w-20" aria-invalid={cents === null} />
      <Button size="xs" type="submit" disabled={!valid}>
        Add
      </Button>
      <Button size="xs" variant="ghost" type="button" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  );
}
