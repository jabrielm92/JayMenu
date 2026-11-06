/** Authorization guard for admin pages and every server action. */
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./options";

export async function getAdminSession() {
  return getServerSession(authOptions);
}

/** Redirects to /login when there is no signed-in admin. */
export async function requireAdmin(): Promise<void> {
  const session = await getAdminSession();
  if (!session?.user) redirect("/login");
}
