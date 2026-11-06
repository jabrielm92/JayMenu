/** Public, unauthenticated: latest published menu for a store (JAYMENU_PLAN.md 7.8). */
import { connection } from "next/server";
import { getPublishedMenu } from "@/lib/menu/queries";

export async function GET(_req: Request, ctx: RouteContext<"/api/public/stores/[storeId]/menu">) {
  await connection();
  const { storeId } = await ctx.params;
  const published = await getPublishedMenu(storeId);
  if (!published) return Response.json({ error: "No published menu for this store" }, { status: 404 });
  return Response.json(published, { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
}
