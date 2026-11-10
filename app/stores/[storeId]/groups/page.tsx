import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { GroupLibrary } from "@/components/groups/group-library";
import { requireAdmin } from "@/lib/auth/guard";
import { getEditorData } from "@/lib/menu/queries";

async function GroupsContent({ params }: PageProps<"/stores/[storeId]/groups">) {
  await connection();
  await requireAdmin();
  const { storeId } = await params;
  const data = await getEditorData(storeId);
  if (!data) notFound();
  // Selection (?group=) is read from the URL on the client.
  return <GroupLibrary data={data} />;
}

export default function GroupsPage(props: PageProps<"/stores/[storeId]/groups">) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading groups…</div>}>
      <GroupsContent {...props} />
    </Suspense>
  );
}
