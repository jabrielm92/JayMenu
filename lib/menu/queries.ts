/** Read-only queries for screens. Menu data is always shaped by lib/menu/resolve.ts. */
import { getPrisma } from "@/lib/db";
import { loadStoreInput } from "./load";
import { resolveMenu, summarizeTemplates, type ResolvedMenu, type TemplateSummary } from "./resolve";

export type EditorData = {
  storeId: string;
  storeName: string;
  menu: ResolvedMenu;
  templates: TemplateSummary[];
};

export async function getEditorData(storeId: string): Promise<EditorData | null> {
  const db = getPrisma();
  const [store, groups] = await Promise.all([
    loadStoreInput(db, storeId),
    db.modifierGroup.findMany({ where: { storeId }, include: { modifiers: true } }),
  ]);
  if (!store) return null;
  const menu = resolveMenu(store);
  return { storeId, storeName: store.name, menu, templates: summarizeTemplates(menu, groups) };
}

export async function getStoreHeader(storeId: string) {
  const db = getPrisma();
  const [store, unpublished, latest] = await Promise.all([
    db.store.findUnique({ where: { id: storeId }, select: { id: true, name: true } }),
    db.changeLog.count({ where: { storeId, undone: false, versionId: null } }),
    db.changeLog.findFirst({
      where: { storeId, undone: false, versionId: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, summary: true },
    }),
  ]);
  return store ? { ...store, unpublished, latest } : null;
}

export async function listStores() {
  return getPrisma().store.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}
