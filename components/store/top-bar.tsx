import { EyeIcon } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { loginRequired, requireAdmin } from "@/lib/auth/guard";
import { getStoreHeader } from "@/lib/menu/queries";
import { NavLinks } from "./nav-links";
import { SignOutButton } from "./sign-out-button";
import { UndoButton } from "./undo-button";

export async function TopBar({ params }: { params: Promise<{ storeId: string }> }) {
  await connection();
  await requireAdmin();
  const { storeId } = await params;
  const store = await getStoreHeader(storeId);
  if (!store) notFound();
  const base = `/stores/${storeId}`;
  const n = store.unpublished;

  return (
    <header className="flex min-h-14 shrink-0 items-center gap-3 border-b px-3 pt-[env(safe-area-inset-top)] sm:gap-4 sm:px-4">
      <Link href={`${base}/menu`} className="font-semibold tracking-tight">
        JayMenu
      </Link>
      <span className="hidden truncate text-sm text-muted-foreground lg:inline">{store.name}</span>
      <NavLinks />
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <Link
          href={`${base}/publish`}
          className={n ? "whitespace-nowrap text-sm font-medium text-amber-700 hover:underline dark:text-amber-400" : "whitespace-nowrap text-sm text-muted-foreground"}
        >
          {n ? (
            <>
              {n}
              <span className="hidden sm:inline"> unpublished</span>
              <span className="hidden xl:inline"> change{n === 1 ? "" : "s"}</span>
              <span className="sm:hidden"> to publish</span>
            </>
          ) : (
            <span className="hidden sm:inline">Up to date</span>
          )}
        </Link>
        <UndoButton latest={store.latest} />
        <Link href={`${base}/preview`} aria-label="Preview" className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-sm hover:bg-muted sm:px-2.5">
          <EyeIcon className="size-4 sm:hidden" />
          <span className="hidden sm:inline">Preview</span>
        </Link>
        <Link href={`${base}/publish`} className="whitespace-nowrap rounded-lg bg-primary px-2.5 py-1 text-sm font-medium text-primary-foreground hover:bg-primary/80">
          <span className="hidden sm:inline">Review &amp; </span>Publish
        </Link>
        {loginRequired() && <SignOutButton />}
      </div>
    </header>
  );
}
