// Runs on every production start (after `prisma migrate deploy`):
//  1. creates/updates the admin user from ADMIN_EMAIL / ADMIN_PASSWORD,
//  2. loads the Demo Diner seed only when the database has no stores yet (never wipes data).
import "dotenv/config";
import bcrypt from "bcryptjs";
import { createPrismaClient } from "../lib/db";
import { seedDemo } from "./demo-data";

const prisma = createPrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.upsert({ where: { email }, update: { passwordHash }, create: { email, name: "Admin", passwordHash } });
    console.log(`[bootstrap] admin user ready: ${email}`);
  } else {
    console.warn("[bootstrap] ADMIN_EMAIL / ADMIN_PASSWORD not set — no admin user created.");
  }

  if ((await prisma.store.count()) === 0) {
    await seedDemo(prisma);
    console.log("[bootstrap] empty database — loaded Demo Diner seed.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
