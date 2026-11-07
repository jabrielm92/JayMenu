// Runs on every production start (after `prisma migrate deploy`):
//  1. creates/updates the admin user from ADMIN_EMAIL / ADMIN_PASSWORD (if set),
//  2. removes the retired "Demo Diner" store if it is still there,
//  3. adds Big Demo Diner if it doesn't exist yet. It is never wiped once created.
import "dotenv/config";
import { createPrismaClient } from "../lib/db";
import { seedAdminFromEnv } from "./admin";
import { BIG_DEMO_STORE_ID, seedBigDemo } from "./big-demo-data";

const RETIRED_STORE_IDS = ["demo-diner"];

const prisma = createPrismaClient();

async function main() {
  await seedAdminFromEnv(prisma);

  const removed = await prisma.store.deleteMany({ where: { id: { in: RETIRED_STORE_IDS } } });
  if (removed.count) console.log(`[bootstrap] removed retired store(s): ${RETIRED_STORE_IDS.join(", ")}`);

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
