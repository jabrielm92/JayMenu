"use client";

import { Undo2Icon } from "lucide-react";
import { undoAction } from "@/app/stores/[storeId]/actions";
import { useChange } from "@/components/editor/use-change";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function UndoButton({ latest }: { latest: { id: string; summary: string } | null }) {
  const { run, pending } = useChange();
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button variant="outline" size="sm" aria-label="Undo" disabled={!latest || pending} onClick={() => latest && run(() => undoAction({ changeId: latest.id }))}>
            <Undo2Icon /> <span className="hidden sm:inline">Undo</span>
          </Button>
        }
      />
      <TooltipContent>{latest ? `Undo: ${latest.summary}` : "Nothing to undo"}</TooltipContent>
    </Tooltip>
  );
}
