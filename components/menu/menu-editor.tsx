"use client";

/** Menu Editor (7.1): categories | items | item panel. Selection lives in the URL (?category=&item=). */
import { MenuDataProvider } from "@/components/editor/menu-data";
import { useState } from "react";
import type { EditorData } from "@/lib/menu/queries";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { CategoryPane } from "./category-pane";
import { ItemList } from "./item-list";
import { ItemPanel } from "./item-panel";

function syncUrl(category: string | null, item: string | null) {
  const url = new URL(window.location.href);
  if (category) url.searchParams.set("category", category);
  else url.searchParams.delete("category");
  if (item) url.searchParams.set("item", item);
  else url.searchParams.delete("item");
  window.history.replaceState(window.history.state, "", url);
}

export function MenuEditor({ data, initialCategory, initialItem }: { data: EditorData; initialCategory?: string; initialItem?: string }) {
  const { menu, templates, storeId } = data;
  const allItems = menu.categories.flatMap((c) => c.items.map((i) => ({ ...i, categoryName: c.name })));
  const startItem = allItems.find((i) => i.id === initialItem);
  const [categoryId, setCategoryId] = useState<string | null>(
    startItem?.categoryId ?? menu.categories.find((c) => c.id === initialCategory)?.id ?? menu.categories[0]?.id ?? null,
  );
  const [itemId, setItemId] = useState<string | null>(startItem?.id ?? null);
  const [search, setSearch] = useState("");

  const category = menu.categories.find((c) => c.id === categoryId) ?? menu.categories[0];
  const item = allItems.find((i) => i.id === itemId) ?? null;
  const q = search.trim().toLowerCase();
  const listItems = q ? allItems.filter((i) => i.name.toLowerCase().includes(q)) : (category?.items ?? []);

  const selectCategory = (id: string) => {
    setSearch("");
    setCategoryId(id);
    setItemId(null);
    syncUrl(id, null);
  };
  const selectItem = (id: string | null) => {
    setItemId(id);
    syncUrl(category?.id ?? null, id);
  };

  return (
    <MenuDataProvider categories={data.menu.categories}>
    <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[13rem_minmax(16rem,1fr)] lg:grid-cols-[14rem_minmax(18rem,22rem)_1fr]">
      <aside className="hidden min-h-0 border-r md:block">
        <CategoryPane storeId={storeId} categories={menu.categories} selectedId={category?.id ?? null} onSelect={selectCategory} search={search} onSearch={setSearch} />
      </aside>
      <section className={cn("flex min-h-0 flex-col md:border-r", item && "hidden lg:flex")}>
        {/* Phones: search + swipeable category chips instead of the side column. */}
        <div className="space-y-2 border-b p-3 md:hidden">
          <Input placeholder="Search items…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9" />
          <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
            {menu.categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => selectCategory(c.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-sm whitespace-nowrap",
                  c.id === category?.id && !q ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1">
        <ItemList
          title={q ? `Results for “${search.trim()}”` : (category?.name ?? "No categories")}
          items={q ? listItems : listItems.map((i) => ({ ...i }))}
          categoryId={q ? null : (category?.id ?? null)}
          selectedId={itemId}
          onSelect={selectItem}
        />
        </div>
      </section>
      <section className={cn("min-h-0", !item && "hidden lg:block")}>
        {item ? (
          <ItemPanel key={item.id} storeId={storeId} item={item} templates={templates} onClose={() => selectItem(null)} />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">Select an item to edit it.</div>
        )}
      </section>
    </div>
    </MenuDataProvider>
  );
}
