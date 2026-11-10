"use client";

/** Group Library (7.5): all templates with usage, template editor, and Where-used list. */
import { MenuDataProvider } from "@/components/editor/menu-data";
import { PlusIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import type { EditorData } from "@/lib/menu/queries";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CreateGroupDialog } from "./create-group-dialog";
import { TemplateEditor } from "./template-editor";

function syncUrl(groupId: string | null) {
  const url = new URL(window.location.href);
  if (groupId) url.searchParams.set("group", groupId);
  else url.searchParams.delete("group");
  window.history.replaceState(window.history.state, "", url);
}

export function GroupLibrary({ data, initialGroup }: { data: EditorData; initialGroup?: string }) {
  const { templates, storeId } = data;
  const [selectedId, setSelectedId] = useState<string | null>(templates.find((t) => t.id === initialGroup)?.id ?? null);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const q = search.trim().toLowerCase();
  const list = q ? templates.filter((t) => t.name.toLowerCase().includes(q) || t.modifiers.some((m) => m.name.toLowerCase().includes(q))) : templates;
  const selected = templates.find((t) => t.id === selectedId) ?? null;
  const select = (id: string | null) => {
    setSelectedId(id);
    syncUrl(id);
  };

  return (
    <MenuDataProvider categories={data.menu.categories}>
    <div className="grid h-full min-h-0 lg:grid-cols-[minmax(22rem,30rem)_1fr]">
      <section className={cn("flex min-h-0 flex-col border-r", selected && "hidden lg:flex")}>
        <div className="flex items-center gap-2 border-b p-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute top-2 left-2 size-4 text-muted-foreground" />
            <Input placeholder="Search modifier groups or modifiers…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 pl-8" />
          </div>
          <Button size="sm" onClick={() => setCreating(true)}>
            <PlusIcon /> New modifier group
          </Button>
        </div>
        <ul className="flex-1 divide-y overflow-y-auto">
          {list.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => select(t.id)}
                className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50", selectedId === t.id && "bg-muted")}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Min {t.minSelect} · Max {t.maxSelect ?? "∞"} · {t.modifiers.length} modifier{t.modifiers.length === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div>used by {t.usedBy}</div>
                  <div className={t.customizedCount ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}>{t.customizedCount} customized</div>
                </div>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="px-4 py-6 text-sm text-muted-foreground">No modifier groups found.</li>}
        </ul>
      </section>
      <section className={cn("min-h-0", !selected && "hidden lg:block")}>
        {selected ? (
          <TemplateEditor key={selected.id} storeId={storeId} template={selected} onClose={() => select(null)} />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">Select a modifier group to edit it for all linked items.</div>
        )}
      </section>
      <CreateGroupDialog storeId={storeId} open={creating} onOpenChange={setCreating} />
    </div>
    </MenuDataProvider>
  );
}
