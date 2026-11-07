# JayMenu — Claude Code Rules

`JAYMENU_PLAN.md` is the source of truth. Build in the order of its Section 9, one step at a time.

## Rules (from JAYMENU_PLAN.md Section 10)

1. Money is **integer cents** everywhere. Format only in the UI.
2. **All menu writes go through `lib/menu/changes.ts`.** No direct Prisma writes from components or routes.
3. **All reads that show menu data go through `lib/menu/resolve.ts`.**
4. A "This item only" change must **never** modify `ModifierGroup` or `Modifier` rows.
5. Stock status (`inStock`) is global; hiding is per item. Don't mix them.
6. Every change writes one `ChangeLog` row with a clear human summary.
7. Delete overrides that equal the template value.
8. Destructive actions (delete template modifier/group/item/category) need a confirm dialog.
9. Keep components small; server actions in `app/**/actions.ts`; Zod-validate all inputs.
10. Finish one build step at a time and report what to check.

## Project notes

- Prisma 7: the connection URL is in `prisma.config.ts` (not the schema). The client is generated to `lib/generated/prisma` (gitignored; `npm install` runs `prisma generate`).
- Next.js 16: see `AGENTS.md` — read `node_modules/next/dist/docs/` before using unfamiliar APIs. Cache Components is on: pages that read the DB wrap their content in `<Suspense>` and call `await connection()`.
- shadcn/ui uses the Base UI flavour: compose with the `render` prop (not `asChild`).
- Auth: login is OFF unless `REQUIRE_LOGIN=true` (owner's choice). Keep calling `requireAdmin()` (lib/auth/guard.ts) at the top of every page content component and server action so it works when turned on. `/api/public/*` always stays open.
- The app ships one store, Big Demo Diner (`prisma/big-demo-data.ts`); `/` redirects to it. Demo Diner exists only as a test fixture (`test/fixtures/demo-diner.ts`).
- Tests: `npm test` needs Postgres with the `jaymenu_test` database (`TEST_DATABASE_URL`).

@AGENTS.md
