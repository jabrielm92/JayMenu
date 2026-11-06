"use client";

import { InlineEdit } from "@/components/editor/inline-edit";
import { cn } from "@/lib/utils";
import { AMBER, ResetButton } from "./option-row";

type Props = {
  min: number;
  max: number | null;
  minOverridden?: boolean;
  maxOverridden?: boolean;
  onMin: (v: number) => Promise<boolean>;
  onMax: (v: number | null) => Promise<boolean>;
  onResetMin?: () => void;
  onResetMax?: () => void;
};

const parseMin = (s: string) => (/^\d{1,2}$/.test(s.trim()) ? Number(s.trim()) : undefined);
const parseMax = (s: string): number | null | undefined => {
  const t = s.trim().toLowerCase();
  if (t === "" || t === "∞" || t === "no limit" || t === "any") return null;
  return /^\d{1,2}$/.test(t) && Number(t) >= 1 ? Number(t) : undefined;
};

/** "Min [1] · Max [1]" editor; empty max = no limit. */
export function MinMaxEdit(p: Props) {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <span>Min</span>
      <InlineEdit ariaLabel="Minimum selections" inputMode="numeric" value={p.min} format={String} parse={parseMin} onCommit={p.onMin} className={cn("h-6 w-9 text-center text-xs", p.minOverridden && AMBER)} />
      {p.minOverridden && p.onResetMin && <ResetButton label="Reset min to shared" onClick={p.onResetMin} />}
      <span className="ml-1">Max</span>
      <InlineEdit
        ariaLabel="Maximum selections (empty = no limit)"
        inputMode="numeric"
        value={p.max}
        format={(v) => (v === null ? "∞" : String(v))}
        parse={parseMax}
        onCommit={p.onMax}
        className={cn("h-6 w-9 text-center text-xs", p.maxOverridden && AMBER)}
      />
      {p.maxOverridden && p.onResetMax && <ResetButton label="Reset max to shared" onClick={p.onResetMax} />}
    </div>
  );
}
