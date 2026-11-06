// `npm run db:seed` entry point — see prisma/demo-data.ts.
import "dotenv/config";
import { createPrismaClient } from "../lib/db";
import { seedDemo } from "./demo-data";

const prisma = createPrismaClient();

seedDemo(prisma)
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
