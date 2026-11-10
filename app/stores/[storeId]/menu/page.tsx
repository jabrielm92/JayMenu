import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { MenuEditor } from "@/components/menu/menu-editor";
import { requireAdmin } from "@/lib/auth/guard";
import { getEditorData } from "@/lib/menu/queries";

async function MenuContent({ params }: PageProps<"/stores/[storeId]/menu">) {
  await connection();
  await requireAdmin();
  const { storeId } = await params;
  const data = await getEditorData(storeId);
  if (!data) notFound();
  // Selection (?category=&item=) is read from the URL on the client.
  return <MenuEditor data={data} />;
}

export default function MenuPage(props: PageProps<"/stores/[storeId]/menu">) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading menu…</div>}>
      <MenuContent {...props} />
    </Suspense>
  );
}
