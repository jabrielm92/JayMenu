/** Read-only queries for screens. Menu data is always shaped by lib/menu/resolve.ts. */
import { getPrisma } from "@/lib/db";
import { loadStoreInput } from "./load";
import { resolveMenu, summarizeTemplates, toPublicMenu, type PublicMenu, type ResolvedMenu, type TemplateSummary } from "./resolve";

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

export async function getPublishData(storeId: string) {
  const db = getPrisma();
  const [store, pending, versions] = await Promise.all([
    db.store.findUnique({ where: { id: storeId }, select: { id: true, name: true } }),
    db.changeLog.findMany({
      where: { storeId, versionId: null, undone: false },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, summary: true, scope: true, createdAt: true },
    }),
    db.menuVersion.findMany({
      where: { storeId },
      orderBy: { versionNumber: "desc" },
      select: { id: true, versionNumber: true, note: true, publishedAt: true },
    }),
  ]);
  if (!store) return null;
  const counts = await db.changeLog.groupBy({ by: ["versionId"], where: { storeId, undone: false, versionId: { not: null } }, _count: true });
  const countBy = new Map(counts.map((c) => [c.versionId, c._count]));
  return {
    store,
    pending,
    versions: versions.map((v) => ({ ...v, changeCount: countBy.get(v.id) ?? 0 })),
  };
}

/** Customer-facing menu: the current draft, or the latest published snapshot. */
export async function getPreviewMenu(storeId: string, which: "draft" | "published") {
  const db = getPrisma();
  if (which === "published") {
    const v = await db.menuVersion.findFirst({ where: { storeId }, orderBy: { versionNumber: "desc" } });
    return v ? { menu: v.resolvedSnapshot as unknown as PublicMenu, versionNumber: v.versionNumber, publishedAt: v.publishedAt } : null;
  }
  const store = await loadStoreInput(db, storeId);
  return store ? { menu: toPublicMenu(resolveMenu(store)), versionNumber: null, publishedAt: null } : null;
}

/** Latest published snapshot for the public API. */
export async function getPublishedMenu(storeId: string) {
  const v = await getPrisma().menuVersion.findFirst({ where: { storeId }, orderBy: { versionNumber: "desc" } });
  return v ? { version: v.versionNumber, publishedAt: v.publishedAt.toISOString(), menu: v.resolvedSnapshot as unknown as PublicMenu } : null;
}

export async function listStores() {
  return getPrisma().store.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}
