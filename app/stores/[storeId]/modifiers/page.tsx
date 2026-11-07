import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ModifiersView } from "@/components/modifiers/modifiers-view";
import { requireAdmin } from "@/lib/auth/guard";
import { getEditorData } from "@/lib/menu/queries";

async function ModifiersContent({ params }: PageProps<"/stores/[storeId]/modifiers">) {
  await connection();
  await requireAdmin();
  const { storeId } = await params;
  const data = await getEditorData(storeId);
  if (!data) notFound();
  return <ModifiersView data={data} />;
}

export default function ModifiersPage(props: PageProps<"/stores/[storeId]/modifiers">) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading modifiers…</div>}>
      <ModifiersContent {...props} />
    </Suspense>
  );
}
