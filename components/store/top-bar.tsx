import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guard";
import { getStoreHeader } from "@/lib/menu/queries";
import { NavLinks } from "./nav-links";
import { UndoButton } from "./undo-button";

export async function TopBar({ params }: { params: Promise<{ storeId: string }> }) {
  await connection();
  await requireAdmin();
  const { storeId } = await params;
  const store = await getStoreHeader(storeId);
  if (!store) notFound();
  const base = `/stores/${storeId}`;

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b px-4">
      <Link href="/" className="font-semibold tracking-tight">
        JayMenu
      </Link>
      <span className="truncate text-sm text-muted-foreground">{store.name}</span>
      <NavLinks base={base} />
      <div className="ml-auto flex items-center gap-2">
        <Link
          href={`${base}/publish`}
          className={store.unpublished ? "text-sm font-medium text-amber-700 hover:underline dark:text-amber-400" : "text-sm text-muted-foreground"}
        >
          {store.unpublished ? `${store.unpublished} unpublished change${store.unpublished === 1 ? "" : "s"}` : "No unpublished changes"}
        </Link>
        <UndoButton latest={store.latest} />
        <Link href={`${base}/preview`} className="hidden rounded-lg border px-2.5 py-1 text-sm hover:bg-muted sm:inline-block">
          Preview
        </Link>
        <Link href={`${base}/publish`} className="rounded-lg bg-primary px-2.5 py-1 text-sm font-medium text-primary-foreground hover:bg-primary/80">
          Review &amp; Publish
        </Link>
      </div>
    </header>
  );
}
