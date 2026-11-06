/** Read-side loaders that feed lib/menu/resolve.ts. No writes here. */
import type { DB } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { resolveMenu, type ResolvedMenu, type StoreInput } from "./resolve";

export type Reader = DB | Prisma.TransactionClient;

const linkInclude = {
  group: { include: { modifiers: true } },
  modOverrides: true,
  extras: true,
} as const;

/** Load a store in the nested shape resolveMenu() expects. */
export async function loadStoreInput(db: Reader, storeId: string): Promise<StoreInput | null> {
  return db.store.findUnique({
    where: { id: storeId },
    include: {
      categories: {
        include: { items: { include: { groupLinks: { include: linkInclude } } } },
      },
    },
  });
}

export async function loadResolvedMenu(db: Reader, storeId: string): Promise<ResolvedMenu | null> {
  const store = await loadStoreInput(db, storeId);
  return store ? resolveMenu(store) : null;
}

/** All raw rows for a store (used for MenuVersion.rawSnapshot). */
export async function loadRawSnapshot(db: Reader, storeId: string) {
  const [store, categories, groups] = await Promise.all([
    db.store.findUnique({ where: { id: storeId } }),
    db.category.findMany({
      where: { storeId },
      include: {
        items: { include: { groupLinks: { include: { modOverrides: true, extras: true } } } },
      },
    }),
    db.modifierGroup.findMany({ where: { storeId }, include: { modifiers: true } }),
  ]);
  return JSON.parse(JSON.stringify({ store, categories, groups }));
}
