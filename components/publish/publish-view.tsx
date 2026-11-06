"use client";

/** Review & Publish (7.6). */
import { Undo2Icon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { publishAction, undoAction } from "@/app/stores/[storeId]/actions";
import { useChange } from "@/components/editor/use-change";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Pending = { id: string; summary: string; scope: string; createdAt: string };
type Version = { id: string; versionNumber: number; note: string | null; publishedAt: string; changeCount: number };

const SCOPE_LABEL: Record<string, string> = { item: "This item", items: "Some items", all: "All linked", none: "" };
const fmtDate = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function PublishView({ storeId, pending, versions }: { storeId: string; pending: Pending[]; versions: Version[] }) {
  const [note, setNote] = useState("");
  const [publishing, startPublish] = useTransition();
  const { run, pending: undoing } = useChange();
  const canPublish = pending.length > 0 || versions.length === 0;

  const publish = () =>
    startPublish(async () => {
      const r = await publishAction({ storeId, note });
      if (r.ok) {
        toast.success(r.summary);
        setNote("");
      } else toast.error(r.error);
    });

  return (
    <div className="mx-auto grid h-full max-w-5xl gap-8 overflow-y-auto p-6 lg:grid-cols-[1fr_20rem]">
      <section>
        <h1 className="text-xl font-semibold">Review &amp; Publish</h1>
        <p className="mb-4 text-sm text-muted-foreground">Nothing goes live until you publish. Undo works newest-first.</p>
        {pending.length === 0 ? (
          <p className="rounded-lg border p-6 text-sm text-muted-foreground">No unpublished changes.</p>
        ) : (
          <ol className="divide-y rounded-lg border">
            {pending.map((c, i) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm">{c.summary}</div>
                  <div className="text-xs text-muted-foreground">{fmtDate(c.createdAt)}</div>
                </div>
                {SCOPE_LABEL[c.scope] && <Badge variant="outline">{SCOPE_LABEL[c.scope]}</Badge>}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={i !== 0 || undoing}
                  title={i !== 0 ? "Undo newer changes first" : "Undo this change"}
                  onClick={() => run(() => undoAction({ changeId: c.id }))}
                >
                  <Undo2Icon /> Undo
                </Button>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-6 grid gap-2">
          <Label htmlFor="note">Note (optional)</Label>
          <Textarea id="note" rows={2} placeholder="e.g. New breakfast prices" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex items-center gap-3">
            <Button onClick={publish} disabled={!canPublish || publishing}>
              {publishing ? "Publishing…" : `Publish${pending.length ? ` ${pending.length} change${pending.length === 1 ? "" : "s"}` : ""}`}
            </Button>
            <Link href={`/stores/${storeId}/preview`} className="text-sm text-muted-foreground hover:underline">
              Preview draft first →
            </Link>
          </div>
        </div>
      </section>

      <aside>
        <h2 className="mb-3 font-semibold">Version history</h2>
        {versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not published yet.</p>
        ) : (
          <ol className="space-y-2">
            {versions.map((v, i) => (
              <li key={v.id} className="rounded-lg border px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Version {v.versionNumber}</span>
                  {i === 0 && <Badge variant="secondary">Live</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {fmtDate(v.publishedAt)} · {v.changeCount} change{v.changeCount === 1 ? "" : "s"}
                </div>
                {v.note && <div className="mt-1">{v.note}</div>}
              </li>
            ))}
          </ol>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Public API:{" "}
          <a className="underline" href={`/api/public/stores/${storeId}/menu`} target="_blank" rel="noreferrer">
            /api/public/stores/{storeId}/menu
          </a>
        </p>
      </aside>
    </div>
  );
}
