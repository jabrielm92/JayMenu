import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { MenuEditor } from "@/components/menu/menu-editor";
import { requireAdmin } from "@/lib/auth/guard";
import { getEditorData } from "@/lib/menu/queries";

async function MenuContent({ params, searchParams }: PageProps<"/stores/[storeId]/menu">) {
  await connection();
  await requireAdmin();
  const [{ storeId }, sp] = await Promise.all([params, searchParams]);
  const data = await getEditorData(storeId);
  if (!data) notFound();
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return <MenuEditor data={data} initialCategory={one(sp.category)} initialItem={one(sp.item)} />;
}

export default function MenuPage(props: PageProps<"/stores/[storeId]/menu">) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading menu…</div>}>
      <MenuContent {...props} />
    </Suspense>
  );
}
