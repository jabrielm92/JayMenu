import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CategoriesView } from "@/components/categories/categories-view";
import { requireAdmin } from "@/lib/auth/guard";
import { getEditorData } from "@/lib/menu/queries";

async function CategoriesContent({ params }: PageProps<"/stores/[storeId]/categories">) {
  await connection();
  await requireAdmin();
  const { storeId } = await params;
  const data = await getEditorData(storeId);
  if (!data) notFound();
  return <CategoriesView storeId={storeId} categories={data.menu.categories} />;
}

export default function CategoriesPage(props: PageProps<"/stores/[storeId]/categories">) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading categories…</div>}>
      <CategoriesContent {...props} />
    </Suspense>
  );
}
