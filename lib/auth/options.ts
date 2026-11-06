import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";
import { getPrisma } from "@/lib/db";

const credentials = z.object({ email: z.email().max(200), password: z.string().min(1).max(200) });

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      async authorize(raw) {
        const parsed = credentials.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();
        const user = await getPrisma().user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        return ok ? { id: user.id, email: user.email, name: user.name } : null;
      },
    }),
  ],
};
