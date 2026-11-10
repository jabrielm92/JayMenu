"use client";

/** Gives deep components (copy dialogs) the store's categories → items without prop drilling. */
import { createContext, useContext } from "react";
import type { ResolvedCategory } from "@/lib/menu/resolve";

const MenuDataContext = createContext<ResolvedCategory[]>([]);

export function MenuDataProvider({ categories, children }: { categories: ResolvedCategory[]; children: React.ReactNode }) {
  return <MenuDataContext.Provider value={categories}>{children}</MenuDataContext.Provider>;
}

export const useMenuCategories = () => useContext(MenuDataContext);
