import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { GroupLibrary } from "@/components/groups/group-library";
import { requireAdmin } from "@/lib/auth/guard";
import { getEditorData } from "@/lib/menu/queries";

async function GroupsContent({ params, searchParams }: PageProps<"/stores/[storeId]/groups">) {
  await connection();
  await requireAdmin();
  const [{ storeId }, sp] = await Promise.all([params, searchParams]);
  const data = await getEditorData(storeId);
  if (!data) notFound();
  const group = Array.isArray(sp.group) ? sp.group[0] : sp.group;
  return <GroupLibrary data={data} initialGroup={group} />;
}

export default function GroupsPage(props: PageProps<"/stores/[storeId]/groups">) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading groups…</div>}>
      <GroupsContent {...props} />
    </Suspense>
  );
}
