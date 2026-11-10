import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CustomerMenu } from "@/components/preview/customer-menu";
import { requireAdmin } from "@/lib/auth/guard";
import { getPreviewMenu } from "@/lib/menu/queries";
import { cn } from "@/lib/utils";

async function PreviewContent({ params, searchParams }: PageProps<"/stores/[storeId]/preview">) {
  await connection();
  await requireAdmin();
  const [{ storeId }, sp] = await Promise.all([params, searchParams]);
  const which = sp.v === "published" ? "published" : "draft";
  const data = await getPreviewMenu(storeId, which);
  const tab = (v: "draft" | "published", label: string) => (
    <Link
      href={`/stores/${storeId}/preview${v === "published" ? "?v=published" : ""}`}
      className={cn("rounded-md px-3 py-1 text-sm whitespace-nowrap", which === v ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}
    >
      {label}
    </Link>
  );

  return (
    <div className="h-full overflow-y-auto bg-muted/40">
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="inline-flex rounded-lg bg-muted p-1">
            {tab("draft", "Draft")}
            {tab("published", "Last published")}
          </div>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {which === "draft"
              ? "Includes unpublished changes"
              : data?.versionNumber
                ? `Version ${data.versionNumber} · ${data.publishedAt!.toLocaleString()}`
                : ""}
          </span>
        </div>
        {data ? <CustomerMenu menu={data.menu} /> : <p className="text-sm text-muted-foreground">Nothing published yet.</p>}
      </div>
    </div>
  );
}

export default function PreviewPage(props: PageProps<"/stores/[storeId]/preview">) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading preview…</div>}>
      <PreviewContent {...props} />
    </Suspense>
  );
}
