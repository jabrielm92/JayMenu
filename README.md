# JayMenu

A restaurant menu editor where modifier groups are **shared templates** and every item can carry its **own overrides**. Edit "Protein" on one item without touching the others, or change it once for everyone. See `JAYMENU_PLAN.md` for the full design.

## Local setup

1. Copy the env file and fill in values (generate a secret with `openssl rand -base64 32`):
   ```bash
   cp .env.example .env
   ```
2. Start Postgres (this also creates the `jaymenu_test` database used by the tests):
   ```bash
   docker compose up -d
   ```
3. Install packages, apply migrations and load the demo data:
   ```bash
   npm install
   npm run db:migrate
   npm run db:seed
   ```
4. Run the app and open http://localhost:3000. Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`.
   ```bash
   npm run dev
   ```

> If your Postgres volume existed before `docker/initdb` was added, create the test DB once:
> `docker compose exec db psql -U jaymenu -c "CREATE DATABASE jaymenu_test;"`

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Generate the Prisma client and build for production |
| `npm run start:prod` | `prisma migrate deploy` → create/update admin user → add any **missing** demo store (never wipes) → `next start` |
| `npm test` | Vitest: resolver unit tests + change-engine tests against `TEST_DATABASE_URL` |
| `npm run db:migrate` | Create/apply migrations in development |
| `npm run db:seed` | Wipe and recreate both demo stores (Demo Diner + Big Demo Diner) |
| `npm run db:studio` | Prisma Studio |

## Deploy to Railway

1. **Create a project** at railway.com → *New Project* → *Deploy from GitHub repo* → pick this repo/branch.
2. **Add Postgres**: in the project, *New* → *Database* → *PostgreSQL*.
3. **Set variables** on the app service (*Variables* tab):
   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference the Postgres service) |
   | `NEXTAUTH_SECRET` | output of `openssl rand -base64 32` |
   | `NEXTAUTH_URL` | your public URL, e.g. `https://jaymenu-production.up.railway.app` |
   | `ADMIN_EMAIL` | the admin login email |
   | `ADMIN_PASSWORD` | the admin password |
4. **Generate a domain**: app service → *Settings* → *Networking* → *Generate Domain*. Put that URL in `NEXTAUTH_URL` and redeploy.
5. Deploy. `railway.json` sets the build (`npm run build`) and start (`npm run start:prod`) commands. On first start the migrations run, the admin user is created and Demo Diner is seeded. Later deploys never wipe data; changing `ADMIN_PASSWORD` updates the admin's password on the next start.

To reset the demo data on Railway, run `npm run db:seed` from a Railway shell (this wipes and recreates both demo stores).

## Demo stores

- **Demo Diner** (`demo-diner`): the small menu from the plan (4 categories, 14 items, 5 group modifiers). The automated tests use it.
- **Big Demo Diner** (`big-demo-diner`): a large Foodhub-style menu (12 categories, 72 items, 26 group modifiers; Add Cheese is shared by 25 items, Choice of Toast by 18, Choice of Meat by 15), with ~25 item-only customizations already applied. Defined in `prisma/big-demo-data.ts`.

## Public API

`GET /api/public/stores/{storeId}/menu` returns the latest **published** menu (no auth). Draft edits never appear here until you Publish. The demo store id is `demo-diner`.

## Architecture

- `lib/menu/resolve.ts` — pure resolution: template + item overrides → what the item offers. Every screen, the preview, publish snapshots and the API use it.
- `lib/menu/changes.ts` — the change engine. **All menu writes** go through it: one transaction, one `ChangeLog` row with before/after rows, scope handling (`item` / `items` / `all`), conflicts, detach, undo, publish.
- `app/stores/[storeId]/actions.ts` — Zod-validated, auth-checked server actions that call the engine.
- `proxy.ts` + `lib/auth/guard.ts` — every page and action requires the admin session; `/api/public/*` stays open.
