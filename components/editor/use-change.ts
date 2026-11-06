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
          } catch {
            // Most likely the session expired (the proxy redirects the action to /login).
            toast.error("Couldn't save — your session may have expired. Refresh the page and sign in again.");
            resolve(false);
          }
        });
      }),
    [],
  );
  return { run, pending };
}
