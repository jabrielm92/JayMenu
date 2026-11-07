/**
 * Authorization guard for admin pages and every server action.
 * Login is OFF unless REQUIRE_LOGIN=true — then every page and action needs the admin session.
 */
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./options";

export function loginRequired(): boolean {
  return process.env.REQUIRE_LOGIN === "true";
}

export async function getAdminSession() {
  return getServerSession(authOptions);
}

/** When login is required, redirects to /login if there is no signed-in admin. */
export async function requireAdmin(): Promise<void> {
  if (!loginRequired()) return;
  const session = await getAdminSession();
  if (!session?.user) redirect("/login");
}
