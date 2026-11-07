"use client";

import { EyeIcon, EyeOffIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { InlineEdit } from "@/components/editor/inline-edit";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCents, parseDollarsToCents } from "@/lib/money";
import { cn } from "@/lib/utils";

export const AMBER = "text-amber-700 dark:text-amber-400 font-medium";

export function IconTip({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function ResetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <IconTip label={label}>
      <Button variant="ghost" size="icon-xs" className="text-amber-700" onClick={onClick} aria-label={label}>
        <RotateCcwIcon />
      </Button>
    </IconTip>
  );
}

export function StockDot({ inStock, onToggle, scopeHint }: { inStock: boolean; onToggle: () => void; scopeHint: string }) {
  const label = `${inStock ? "In stock" : "Out of stock"} ${scopeHint} — click to mark ${inStock ? "out of stock" : "in stock"}`;
  return (
    <IconTip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={onToggle}
        className={cn("size-3 shrink-0 rounded-full ring-2 ring-offset-1 ring-transparent hover:ring-border", inStock ? "bg-emerald-500" : "bg-red-500")}
      />
    </IconTip>
  );
}

export type OptionRowProps = {
  name: string;
  priceCents: number;
  inStock: boolean;
  hidden?: boolean;
  /** Amber + reset icon for these. */
  nameOverridden?: boolean;
  priceOverridden?: boolean;
  /** Item-only option (LinkExtraModifier). */
  extra?: boolean;
  onName: (v: string) => Promise<boolean>;
  onPrice: (v: number) => Promise<boolean>;
  onStock: () => void;
  stockHint: string;
  onResetName?: () => void;
  onResetPrice?: () => void;
  onHide?: () => void;
  onShow?: () => void;
  onDelete?: () => void;
  hideLabel?: string;
};

export function OptionRow(p: OptionRowProps) {
  return (
    <div className={cn("group/row flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-muted/50", p.hidden && "opacity-50")}>
      <StockDot inStock={p.inStock} onToggle={p.onStock} scopeHint={p.stockHint} />
      <div className="flex min-w-0 flex-1 items-center">
        <InlineEdit
          ariaLabel="Modifier name"
          value={p.name}
          format={(v) => v}
          parse={(s) => (s.trim() ? s.trim() : undefined)}
          onCommit={p.onName}
          disabled={p.hidden}
          className={cn("w-full", p.nameOverridden && AMBER, p.hidden && "line-through")}
        />
        {p.nameOverridden && p.onResetName && <ResetButton label="Reset name to shared" onClick={p.onResetName} />}
        {p.extra && <span className="ml-1 shrink-0 rounded bg-amber-100 px-1.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">this item only</span>}
        {p.hidden && <span className="ml-1 shrink-0 text-xs text-muted-foreground">hidden here</span>}
      </div>
      <div className="flex items-center">
        {p.priceOverridden && p.onResetPrice && <ResetButton label="Reset price to shared" onClick={p.onResetPrice} />}
        <InlineEdit
          ariaLabel="Modifier price"
          inputMode="decimal"
          value={p.priceCents}
          format={formatCents}
          parse={(s) => parseDollarsToCents(s) ?? undefined}
          onCommit={p.onPrice}
          disabled={p.hidden}
          className={cn("w-20 text-right tabular-nums", p.priceOverridden && AMBER)}
        />
      </div>
      <div className="flex w-14 justify-end">
        {p.onDelete && (
          <IconTip label="Remove modifier">
            <Button variant="ghost" size="icon-xs" onClick={p.onDelete} aria-label="Remove modifier">
              <Trash2Icon />
            </Button>
          </IconTip>
        )}
        {p.hidden && p.onShow && (
          <IconTip label="Show on this item">
            <Button variant="ghost" size="icon-xs" className="text-amber-700" onClick={p.onShow} aria-label="Show modifier">
              <EyeOffIcon />
            </Button>
          </IconTip>
        )}
        {!p.hidden && p.onHide && (
          <IconTip label={p.hideLabel ?? "Hide"}>
            <Button variant="ghost" size="icon-xs" onClick={p.onHide} aria-label={p.hideLabel ?? "Hide"}>
              {p.hideLabel?.startsWith("Delete") ? <Trash2Icon /> : <EyeIcon />}
            </Button>
          </IconTip>
        )}
      </div>
    </div>
  );
}
