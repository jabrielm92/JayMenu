"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

type Props<T> = {
  value: T;
  /** Shown in the input. */
  format: (v: T) => string;
  /** Returns the parsed value, or undefined when invalid. */
  parse: (s: string) => T | undefined;
  /** Return false to revert (e.g. the user cancelled the scope prompt). */
  onCommit: (v: T) => Promise<boolean> | boolean;
  className?: string;
  placeholder?: string;
  ariaLabel: string;
  disabled?: boolean;
  inputMode?: "text" | "decimal" | "numeric";
};

/** Text input that saves on blur / Enter and reverts on Escape or invalid input. */
export function InlineEdit<T>({ value, format, parse, onCommit, className, placeholder, ariaLabel, disabled, inputMode }: Props<T>) {
  const ref = useRef<HTMLInputElement>(null);
  const shown = format(value);
  const busy = useRef(false);

  const revert = () => {
    if (ref.current) ref.current.value = shown;
  };

  const commit = async () => {
    const el = ref.current;
    if (!el || busy.current) return;
    if (el.value === shown) return;
    const parsed = parse(el.value);
    if (parsed === undefined) return revert();
    busy.current = true;
    const ok = await onCommit(parsed);
    busy.current = false;
    if (!ok) revert();
  };

  return (
    <input
      key={shown}
      ref={ref}
      defaultValue={shown}
      aria-label={ariaLabel}
      placeholder={placeholder}
      disabled={disabled}
      inputMode={inputMode}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          revert();
          e.currentTarget.blur();
        }
      }}
      className={cn(
        "h-7 min-w-0 rounded-md border border-transparent bg-transparent px-1.5 text-sm outline-none transition-colors hover:border-border focus:border-ring focus:bg-background disabled:opacity-60",
        className,
      )}
    />
  );
}
