"use client";

/** Gives deep components (copy dialogs) the store's categories → items and modifier groups without prop drilling. */
import { createContext, useContext } from "react";
import type { ResolvedCategory, TemplateSummary } from "@/lib/menu/resolve";

type MenuData = { categories: ResolvedCategory[]; templates: TemplateSummary[] };
const MenuDataContext = createContext<MenuData>({ categories: [], templates: [] });

export function MenuDataProvider({ categories, templates, children }: MenuData & { children: React.ReactNode }) {
  return <MenuDataContext.Provider value={{ categories, templates }}>{children}</MenuDataContext.Provider>;
}

export const useMenuCategories = () => useContext(MenuDataContext).categories;
export const useMenuTemplates = () => useContext(MenuDataContext).templates;
