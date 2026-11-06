"use client";

import { EyeIcon, EyeOffIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { createCategoryAction, deleteCategoryAction, updateCategoryAction } from "@/app/stores/[storeId]/actions";
import { useConfirm } from "@/components/editor/confirm";
import { useChange } from "@/components/editor/use-change";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { ResolvedCategory } from "@/lib/menu/resolve";
import { cn } from "@/lib/utils";

export function CategoryPane({
  storeId,
  categories,
  selectedId,
  onSelect,
  search,
  onSearch,
}: {
  storeId: string;
  categories: ResolvedCategory[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearch: (s: string) => void;
}) {
  const { run } = useChange();
  const confirm = useConfirm();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3">
        <div className="relative">
          <SearchIcon className="absolute top-2 left-2 size-4 text-muted-foreground" />
          <Input placeholder="Search items…" value={search} onChange={(e) => onSearch(e.target.value)} className="h-8 pl-8" />
        </div>
      </div>
      <ul className="flex-1 overflow-y-auto p-2">
        {categories.map((c) => (
          <li key={c.id}>
            {renaming === c.id ? (
              <form
                className="p-1"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const v = String(new FormData(e.currentTarget).get("name") ?? "").trim();
                  if (v && v !== c.name) await run(() => updateCategoryAction({ categoryId: c.id, patch: { name: v } }));
                  setRenaming(null);
                }}
              >
                <Input name="name" autoFocus defaultValue={c.name} className="h-8" onBlur={(e) => e.currentTarget.form?.requestSubmit()} />
              </form>
            ) : (
              <div
                className={cn(
                  "group/cat flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
                  selectedId === c.id && !search && "bg-muted font-medium",
                  !c.isActive && "text-muted-foreground",
                )}
                onClick={() => onSelect(c.id)}
              >
                <span className="flex-1 truncate">
                  {c.name}
                  {!c.isActive && <span className="ml-1 text-xs">(hidden)</span>}
                </span>
                <span className="text-xs text-muted-foreground">{c.items.length}</span>
                <span onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label={`${c.name} actions`} className="opacity-60 group-hover/cat:opacity-100" />}>
                      <MoreHorizontalIcon />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setRenaming(c.id)}>
                        <PencilIcon /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => run(() => updateCategoryAction({ categoryId: c.id, patch: { isActive: !c.isActive } }))}>
                        {c.isActive ? <EyeOffIcon /> : <EyeIcon />} {c.isActive ? "Hide from menu" : "Show on menu"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={async () => {
                          if (
                            await confirm({
                              title: `Delete category "${c.name}"?`,
                              description: `Its ${c.items.length} item(s) are deleted too. You can undo before publishing.`,
                              confirmLabel: "Delete category",
                              destructive: true,
                            })
                          )
                            await run(() => deleteCategoryAction({ categoryId: c.id }));
                        }}
                      >
                        <Trash2Icon /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="border-t p-2">
        {adding ? (
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (newName.trim() && (await run(() => createCategoryAction({ storeId, name: newName })))) {
                setNewName("");
                setAdding(false);
              }
            }}
          >
            <Input autoFocus placeholder="Category name" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-8" />
            <Button size="sm" type="submit" disabled={!newName.trim()}>
              Add
            </Button>
          </form>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            <PlusIcon /> Add category
          </Button>
        )}
      </div>
    </div>
  );
}
