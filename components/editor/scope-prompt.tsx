"use client";

/**
 * Scope Prompt (JAYMENU_PLAN.md 7.3): asks where a change to a shared group applies.
 * `const askScope = useScopePrompt(); const r = await askScope({...}); if (!r) return;`
 */
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Conflict, Scope } from "@/lib/menu/changes";
import type { TemplateLink } from "@/lib/menu/resolve";

export type ScopeRequest = {
  /** e.g. `Change "Bacon" price to $1.50` */
  title: string;
  /** Every item linked to the template. */
  links: TemplateLink[];
  /** The item being edited (item context). Omit in template context. */
  currentItemId?: string;
  /** "item" when editing from an item, "all" from the Group Library. */
  defaultScope: "item" | "all";
  /** Loads conflicts for an "all" change. */
  getConflicts?: () => Promise<Conflict[]>;
  /** e.g. "price for Bacon" */
  conflictNoun?: string;
  formatConflict?: (c: Conflict) => string;
  /** Extra warning shown when "All linked items" is selected. */
  allWarning?: string;
  /** Item context only: hide the "All" option (e.g. not meaningful). */
  allowAll?: boolean;
};

export type ScopeAnswer = { scope: Scope; resetConflicts: boolean };

type Choice = "item" | "all" | "choose";
type Remembered = { item?: Choice; template?: Choice };

const ScopeContext = createContext<(r: ScopeRequest) => Promise<ScopeAnswer | null>>(async () => null);
export const useScopePrompt = () => useContext(ScopeContext);

const STORAGE_KEY = "jaymenu.scope.remember";
function readRemembered(): Remembered {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

type Stage =
  | { kind: "closed" }
  | { kind: "scope"; req: ScopeRequest }
  | { kind: "conflicts"; req: ScopeRequest; scope: Scope; conflicts: Conflict[] };

export function ScopePromptProvider({ children }: { children: React.ReactNode }) {
  const [stage, setStage] = useState<Stage>({ kind: "closed" });
  const [choice, setChoice] = useState<Choice>("item");
  const [chosen, setChosen] = useState<string[]>([]);
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const resolver = useRef<(v: ScopeAnswer | null) => void>(undefined);

  const finish = (v: ScopeAnswer | null) => {
    resolver.current?.(v);
    resolver.current = undefined;
    setStage({ kind: "closed" });
    setBusy(false);
  };

  /** For an "all" scope, look for conflicts and show the follow-up if needed. */
  const continueWith = useCallback(async (req: ScopeRequest, scope: Scope) => {
    if (scope.type !== "all" || !req.getConflicts) return finish({ scope, resetConflicts: false });
    setBusy(true);
    const conflicts = await req.getConflicts();
    setBusy(false);
    if (!conflicts.length) return finish({ scope, resetConflicts: false });
    setStage({ kind: "conflicts", req, scope, conflicts });
  }, []);

  const ask = useCallback(
    (req: ScopeRequest) =>
      new Promise<ScopeAnswer | null>((resolve) => {
        resolver.current = resolve;
        // Linked to one item (or none): no prompt, edit the group directly.
        if (req.links.length <= 1) return finish({ scope: { type: "all" }, resetConflicts: true });

        const ctx = req.currentItemId ? "item" : "template";
        const remembered = readRemembered()[ctx];
        if (remembered && remembered !== "choose" && !(remembered === "all" && req.allowAll === false)) {
          const scope: Scope = remembered === "item" && req.currentItemId ? { type: "item", itemId: req.currentItemId } : { type: "all" };
          void continueWith(req, scope);
          return;
        }
        setChoice(req.currentItemId ? req.defaultScope : req.defaultScope === "item" ? "choose" : "all");
        setChosen(req.currentItemId ? [req.currentItemId] : []);
        setRemember(false);
        setStage({ kind: "scope", req });
      }),
    [continueWith],
  );

  const apply = () => {
    if (stage.kind !== "scope") return;
    const { req } = stage;
    let scope: Scope;
    if (choice === "item" && req.currentItemId) scope = { type: "item", itemId: req.currentItemId };
    else if (choice === "all") scope = { type: "all" };
    else if (chosen.length === req.links.length) scope = { type: "all" };
    else scope = { type: "items", itemIds: chosen };
    if (remember && choice !== "choose") {
      const r = readRemembered();
      r[req.currentItemId ? "item" : "template"] = choice;
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(r));
      } catch {}
    }
    void continueWith(req, scope);
  };

  const req = stage.kind === "closed" ? null : stage.req;
  const current = req?.links.find((l) => l.itemId === req.currentItemId);

  return (
    <ScopeContext.Provider value={ask}>
      {children}

      <Dialog open={stage.kind === "scope"} onOpenChange={(o) => !o && finish(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{req?.title}</DialogTitle>
            <DialogDescription>This group is shared by {req?.links.length} items. Apply to:</DialogDescription>
          </DialogHeader>
          <RadioGroup value={choice} onValueChange={(v) => setChoice(v as Choice)} className="gap-3">
            {current && (
              <Label className="flex items-center gap-2 font-normal">
                <RadioGroupItem value="item" /> This item only <span className="text-muted-foreground">({current.itemName})</span>
              </Label>
            )}
            {req?.allowAll !== false && (
              <Label className="flex items-center gap-2 font-normal">
                <RadioGroupItem value="all" /> All linked items ({req?.links.length})
              </Label>
            )}
            <Label className="flex items-center gap-2 font-normal">
              <RadioGroupItem value="choose" /> Choose items…
            </Label>
          </RadioGroup>
          {choice === "all" && req?.allWarning && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{req.allWarning}</p>
          )}
          {choice === "choose" && (
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
              {req?.links.map((l) => (
                <Label key={l.itemId} className="flex items-center gap-2 font-normal">
                  <Checkbox
                    checked={chosen.includes(l.itemId)}
                    onCheckedChange={(c) => setChosen((prev) => (c ? [...prev, l.itemId] : prev.filter((x) => x !== l.itemId)))}
                  />
                  {l.itemName}
                  {l.isCustomized && <span className="text-xs text-amber-600">customized</span>}
                </Label>
              ))}
            </div>
          )}
          {choice !== "choose" && (
            <Label className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
              <Checkbox checked={remember} onCheckedChange={(c) => setRemember(!!c)} /> Remember my choice for this session
            </Label>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => finish(null)}>
              Cancel
            </Button>
            <Button onClick={apply} disabled={busy || (choice === "choose" && chosen.length === 0)}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stage.kind === "conflicts"} onOpenChange={(o) => !o && finish(null)}>
        <DialogContent className="sm:max-w-md">
          {stage.kind === "conflicts" && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {stage.conflicts.length} item{stage.conflicts.length === 1 ? " has its" : "s have their"} own {stage.req.conflictNoun ?? "value"}
                </DialogTitle>
                <DialogDescription>
                  {stage.conflicts.map((c) => (stage.req.formatConflict ? stage.req.formatConflict(c) : `${c.itemName}: ${c.value}`)).join(" · ")}
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">Keep their own value, or reset them to the new shared value too?</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => finish({ scope: stage.scope, resetConflicts: false })}>
                  Keep theirs
                </Button>
                <Button onClick={() => finish({ scope: stage.scope, resetConflicts: true })}>Reset them too</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </ScopeContext.Provider>
  );
}
