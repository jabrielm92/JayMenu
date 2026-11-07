/**
 * Optimistic auth check, only when REQUIRE_LOGIN=true: signed-out visitors are sent to /login.
 * The public menu API, NextAuth routes and the login page stay open.
 * Pages and server actions also verify the session themselves (lib/auth/guard.ts).
 */
import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(req: NextRequest) {
  if (process.env.REQUIRE_LOGIN !== "true") return NextResponse.next();
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (token) return NextResponse.next();
  const login = new URL("/login", req.url);
  const target = req.nextUrl.pathname + req.nextUrl.search;
  if (target !== "/") login.searchParams.set("callbackUrl", target);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!login|api/auth|api/public|_next/static|_next/image|favicon.ico).*)"],
};
