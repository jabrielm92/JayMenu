// `npm run db:seed` — wipes and recreates Big Demo Diner (see prisma/big-demo-data.ts).
import "dotenv/config";
import { createPrismaClient } from "../lib/db";
import { seedBigDemo } from "./big-demo-data";
import { seedAdminFromEnv } from "./admin";

const prisma = createPrismaClient();

async function main() {
  await seedAdminFromEnv(prisma);
  await seedBigDemo(prisma);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
