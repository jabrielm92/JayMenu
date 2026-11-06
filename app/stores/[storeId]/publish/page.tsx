import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PublishView } from "@/components/publish/publish-view";
import { requireAdmin } from "@/lib/auth/guard";
import { getPublishData } from "@/lib/menu/queries";

async function PublishContent({ params }: PageProps<"/stores/[storeId]/publish">) {
  await connection();
  await requireAdmin();
  const { storeId } = await params;
  const data = await getPublishData(storeId);
  if (!data) notFound();
  return (
    <PublishView
      storeId={storeId}
      pending={data.pending.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
      versions={data.versions.map((v) => ({ ...v, publishedAt: v.publishedAt.toISOString() }))}
    />
  );
}

export default function PublishPage(props: PageProps<"/stores/[storeId]/publish">) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading…</div>}>
      <PublishContent {...props} />
    </Suspense>
  );
}
