"use client";

import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import type { ChangeResult } from "@/lib/menu/changes";

/** Runs a server action that returns a ChangeResult and toasts the outcome. Resolves to ok. */
export function useChange() {
  const [pending, startTransition] = useTransition();
  const run = useCallback(
    (fn: () => Promise<ChangeResult>) =>
      new Promise<boolean>((resolve) => {
        startTransition(async () => {
          try {
            const r = await fn();
            if (r.ok) {
              if (r.changeId) toast.success(r.summary);
              resolve(true);
            } else {
              toast.error(r.error);
              resolve(false);
            }
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Something went wrong");
            resolve(false);
          }
        });
      }),
    [],
  );
  return { run, pending };
}
