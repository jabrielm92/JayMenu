// Runs on every production start (after `prisma migrate deploy`):
//  1. creates/updates the admin user from ADMIN_EMAIL / ADMIN_PASSWORD,
//  2. adds any demo store that doesn't exist yet. Existing stores are never touched or wiped.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { createPrismaClient } from "../lib/db";
import { BIG_DEMO_STORE_ID, seedBigDemo } from "./big-demo-data";
import { DEMO_STORE_ID, seedDemo } from "./demo-data";

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

  if (!(await prisma.store.findUnique({ where: { id: DEMO_STORE_ID } }))) {
    await seedDemo(prisma);
    console.log("[bootstrap] added Demo Diner.");
  }
  if (!(await prisma.store.findUnique({ where: { id: BIG_DEMO_STORE_ID } }))) {
    await seedBigDemo(prisma);
    console.log("[bootstrap] added Big Demo Diner.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
