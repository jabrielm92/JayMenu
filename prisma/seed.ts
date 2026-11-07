// `npm run db:seed` — wipes and recreates both demo stores (and the admin user from env).
// See prisma/demo-data.ts (Demo Diner, used by the tests) and prisma/big-demo-data.ts.
import "dotenv/config";
import { createPrismaClient } from "../lib/db";
import { seedBigDemo } from "./big-demo-data";
import { seedDemo } from "./demo-data";

const prisma = createPrismaClient();

async function main() {
  await seedDemo(prisma);
  await seedBigDemo(prisma);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
