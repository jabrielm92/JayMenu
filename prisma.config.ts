import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Fallback lets `prisma generate` run without a .env (e.g. in CI/build).
    url: process.env.DATABASE_URL ?? "postgresql://jaymenu:jaymenu@localhost:5432/jaymenu",
  },
});
