# JayMenu

Restaurant menu editor: shared modifier-group templates, plus per-item overrides. See `JAYMENU_PLAN.md`.

## Local setup

1. Copy the env file: `cp .env.example .env`
2. Start Postgres: `docker compose up -d`
3. Install packages: `npm install`
4. Run the app: `npm run dev` → http://localhost:3000

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Generate the Prisma client and build for production |
| `npm test` | Run the Vitest tests |
| `npm run db:migrate` | Create/apply migrations (`prisma migrate dev`) |
| `npm run db:seed` | Seed Demo Diner (`prisma/seed.ts`) |
| `npm run db:studio` | Open Prisma Studio |
