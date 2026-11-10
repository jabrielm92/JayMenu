"use client";

/** Categories: list, add, rename, show/hide, delete. Click through to the category's items. */
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { createCategoryAction, deleteCategoryAction, updateCategoryAction } from "@/app/stores/[storeId]/actions";
import { useConfirm } from "@/components/editor/confirm";
import { useChange } from "@/components/editor/use-change";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { ResolvedCategory } from "@/lib/menu/resolve";

export function CategoriesView({ storeId, categories }: { storeId: string; categories: ResolvedCategory[] }) {
  const { run } = useChange();
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Categories</h1>
          <form
            className="flex w-full gap-2 sm:w-auto"
            onSubmit={async (e) => {
              e.preventDefault();
              if (name.trim() && (await run(() => createCategoryAction({ storeId, name })))) setName("");
            }}
          >
            <Input placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} className="h-8 min-w-0 flex-1 sm:w-56 sm:flex-none" />
            <Button size="sm" type="submit" disabled={!name.trim()}>
              <PlusIcon /> Add category
            </Button>
          </form>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium sm:px-4">Category</th>
                <th className="px-2 py-2 font-medium sm:px-4">Items</th>
                <th className="px-2 py-2 font-medium sm:px-4">
                  <span className="sm:hidden">Shown</span>
                  <span className="hidden sm:inline">Shown on menu</span>
                </th>
                <th className="w-10 sm:w-16" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {categories.map((c) => {
                const customized = c.items.filter((i) => i.groups.some((g) => g.isCustomized)).length;
                return (
                  <tr key={c.id} className={c.isActive ? "" : "text-muted-foreground"}>
                    <td className="px-2 py-1.5 sm:px-4">
                      {renaming === c.id ? (
                        <Input
                          autoFocus
                          aria-label="Category name"
                          defaultValue={c.name}
                          className="h-8"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") setRenaming(null);
                          }}
                          onBlur={async (e) => {
                            const v = e.currentTarget.value.trim();
                            if (v && v !== c.name) await run(() => updateCategoryAction({ categoryId: c.id, patch: { name: v } }));
                            setRenaming(null);
                          }}
                        />
                      ) : (
                        <div className="group/name flex items-center gap-1">
                          <Link href={`/stores/${storeId}/menu?category=${c.id}`} className="font-medium hover:underline">
                            {c.name}
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Rename ${c.name}`}
                            className="opacity-50 group-hover/name:opacity-100"
                            onClick={() => setRenaming(c.id)}
                          >
                            <PencilIcon />
                          </Button>
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1.5 sm:px-4">
                      {c.items.length}
                      {customized > 0 && <span className="hidden text-xs text-amber-700 sm:inline dark:text-amber-400"> · {customized} with customized modifier groups</span>}
                    </td>
                    <td className="px-2 py-1.5 sm:px-4">
                      <Switch
                        size="sm"
                        aria-label={`Show ${c.name} on menu`}
                        checked={c.isActive}
                        onCheckedChange={(v) => run(() => updateCategoryAction({ categoryId: c.id, patch: { isActive: v } }))}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Delete ${c.name}`}
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
                          <Trash2Icon />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-muted-foreground">
                    No categories yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
