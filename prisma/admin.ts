// Creates/updates the admin user from ADMIN_EMAIL / ADMIN_PASSWORD (only used when REQUIRE_LOGIN=true).
import bcrypt from "bcryptjs";
import type { PrismaClient } from "../lib/generated/prisma/client";

export async function seedAdminFromEnv(prisma: PrismaClient) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({ where: { email }, update: { passwordHash }, create: { email, name: "Admin", passwordHash } });
  console.log(`[seed] admin user ready: ${email}`);
}
