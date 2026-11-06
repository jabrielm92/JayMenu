import { redirect } from "next/navigation";

export default async function StorePage({ params }: PageProps<"/stores/[storeId]">) {
  const { storeId } = await params;
  redirect(`/stores/${storeId}/menu`);
}
