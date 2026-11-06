# JayMenu — Build Plan

> **For Claude Code:** This file is the source of truth for the project. Read it fully before writing code. Build in the order of **Section 9 (Build Steps)**, one step at a time, and stop after each step so the owner can verify its "Done when" check.

---

## 1. What JayMenu Is

A restaurant menu editor (categories → items → modifier groups → modifiers) built to fix the main problem with Foodhub's BOB CRM editor:

**Problem:** In BOB CRM a modifier group is one shared object. Editing it from one item changes it on every item it's linked to. The only workaround is duplicating groups per item ("French Toast – Protein", "Waffle – Protein", "Omelette – Protein"…), which clutters the menu and makes global changes painful.

**JayMenu's fix:** Groups are **shared templates**, and every item can carry its **own overrides** on top. Every edit to something linked to more than one item asks:

> **Apply to:** ◉ This item only ○ All linked items (5) ○ Choose items…

### Goals
- Edit a modifier group on one item **without affecting any other item**, even when the group is shared.
- Still be able to change a shared group once and have it update everywhere (except where an item has its own value).
- Always show what's shared vs customized, and allow one-click reset.
- Nothing goes live until **Publish**. Every change can be undone.
- Fast and fluid: side-panel editing, no full-page reloads, no hunting for the right duplicate group.

### Non-goals (for now)
- No connection to BOB CRM / Foodhub. JayMenu is standalone.
- No ordering, payments, or POS features.

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (latest, App Router, TypeScript) |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | NextAuth (credentials, single admin user to start) |
| UI | Tailwind CSS + shadcn/ui |
| Drag & drop (Phase 2) | dnd-kit |
| Validation | Zod |
| Tests | Vitest (logic), Playwright (optional, later) |
| Hosting | Railway (app + Postgres) |

---

## 3. Core Concept: Templates + Overrides

```
ModifierGroup (shared template)          ← edited with "All linked items"
   └─ Modifier rows (Bacon, Sausage…)

ItemGroupLink (one per item ↔ group)     ← edited with "This item only"
   ├─ group-level overrides (name, min, max)
   ├─ ModifierOverride rows (price / name / hidden / order per option)
   └─ LinkExtraModifier rows (options only this item has)
```

**Effective (resolved) group for an item = template, then the item's overrides on top.**

Rules:
1. An override field that is `null` means "use the template value."
2. Changing the template updates every item **except** fields that item has overridden.
3. If an override is set to the same value as the template, delete the override (keeps data clean).
4. **Stock status is always global.** If a modifier is out of stock on the template, it's out on every item. (An item can still *hide* an option, which is different from stock.)
5. **Detach** = turn an item's resolved group into a brand-new independent group used only by that item (escape hatch for full separation).

### Worked example
Template **"Protein"**: Bacon $0, Sausage $0, Scrapple $0, Turkey Bacon $0. Linked to Waffle & Meat, Meat Omelette, Steak & Eggs.

| Action | Scope | Result |
|---|---|---|
| Steak & Eggs: Bacon → $1.50 | This item only | Override on Steak & Eggs link. Others still $0. |
| Steak & Eggs: hide Scrapple | This item only | `hidden=true` override. Others still show it. |
| Template: Sausage → $0.50 | All linked items | All 3 items show $0.50 (none had overridden Sausage). |
| Template: Bacon → $0.75 | All linked items | Waffle & Omelette → $0.75. Steak & Eggs **keeps $1.50**. UI warns: "1 item has its own price for Bacon — also reset it?" |
| Meat Omelette: add "Ham +$1" | This item only | `LinkExtraModifier` on Meat Omelette only. |
| Waffle & Meat: Detach | — | New group "Protein (Waffle & Meat)" created with resolved values; the link now points to it. |

---

## 4. Data Model (Prisma)

Money is stored as **integer cents**. All IDs are `cuid()`.

```prisma
model Store {
  id          String          @id @default(cuid())
  name        String
  taxRatePct  Decimal?        @db.Decimal(5, 2)
  categories  Category[]
  groups      ModifierGroup[]
  versions    MenuVersion[]
  changes     ChangeLog[]
  createdAt   DateTime        @default(now())
}

model Category {
  id          String   @id @default(cuid())
  storeId     String
  store       Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  name        String
  description String?
  sortOrder   Int      @default(0)
  isActive    Boolean  @default(true)
  items       Item[]
}

model Item {
  id          String          @id @default(cuid())
  categoryId  String
  category    Category        @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  name        String
  description String?
  priceCents  Int
  taxable     Boolean         @default(true)
  isAvailable Boolean         @default(true)
  imageUrl    String?
  sortOrder   Int             @default(0)
  groupLinks  ItemGroupLink[]
}

model ModifierGroup {
  id          String          @id @default(cuid())
  storeId     String
  store       Store           @relation(fields: [storeId], references: [id], onDelete: Cascade)
  name        String
  minSelect   Int             @default(0)
  maxSelect   Int?            // null = no limit
  modifiers   Modifier[]
  links       ItemGroupLink[]
}

model Modifier {
  id          String             @id @default(cuid())
  groupId     String
  group       ModifierGroup      @relation(fields: [groupId], references: [id], onDelete: Cascade)
  name        String
  priceCents  Int                @default(0)
  inStock     Boolean            @default(true)   // global
  sortOrder   Int                @default(0)
  overrides   ModifierOverride[]
}

model ItemGroupLink {
  id            String              @id @default(cuid())
  itemId        String
  item          Item                @relation(fields: [itemId], references: [id], onDelete: Cascade)
  groupId       String
  group         ModifierGroup       @relation(fields: [groupId], references: [id], onDelete: Cascade)
  sortOrder     Int                 @default(0)
  nameOverride  String?
  minOverride   Int?
  maxOverride   Int?
  maxOverrideSet Boolean            @default(false) // true when override explicitly sets max (incl. "no limit")
  modOverrides  ModifierOverride[]
  extras        LinkExtraModifier[]

  @@unique([itemId, groupId])
}

model ModifierOverride {
  id                 String        @id @default(cuid())
  linkId             String
  link               ItemGroupLink @relation(fields: [linkId], references: [id], onDelete: Cascade)
  modifierId         String
  modifier           Modifier      @relation(fields: [modifierId], references: [id], onDelete: Cascade)
  nameOverride       String?
  priceCentsOverride Int?
  hidden             Boolean       @default(false)
  sortOrderOverride  Int?

  @@unique([linkId, modifierId])
}

model LinkExtraModifier {
  id          String        @id @default(cuid())
  linkId      String
  link        ItemGroupLink @relation(fields: [linkId], references: [id], onDelete: Cascade)
  name        String
  priceCents  Int           @default(0)
  inStock     Boolean       @default(true)
  sortOrder   Int           @default(0)
}

model ChangeLog {
  id          String   @id @default(cuid())
  storeId     String
  store       Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  summary     String   // human-readable, e.g. "Bacon price → $1.50 on Steak & Eggs only"
  scope       String   // "item" | "items" | "all" | "none"
  before      Json     // rows as they were (for undo)
  after       Json     // rows as they became
  undone      Boolean  @default(false)
  versionId   String?  // set when included in a publish
  createdAt   DateTime @default(now())
}

model MenuVersion {
  id               String   @id @default(cuid())
  storeId          String
  store            Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  versionNumber    Int
  note             String?
  rawSnapshot      Json     // all tables for this store (for restore)
  resolvedSnapshot Json     // final customer-facing menu
  publishedAt      DateTime @default(now())

  @@unique([storeId, versionNumber])
}
```

Plus NextAuth's standard `User` / `Account` / `Session` models (credentials provider, one admin seeded from env vars).

---

## 5. Resolution Logic (`lib/menu/resolve.ts`)

**Single source of truth.** Every screen, the preview, the publish snapshot and the public API use this. Pure functions, no DB calls inside.

```ts
type ResolvedModifier = {
  source: "template" | "extra";
  modifierId?: string;      // when source = template
  extraId?: string;         // when source = extra
  name: string;
  priceCents: number;
  inStock: boolean;
  sortOrder: number;
  overridden: Array<"name" | "price" | "sortOrder">;
};

type ResolvedGroup = {
  linkId: string;
  groupId: string;
  name: string;
  minSelect: number;
  maxSelect: number | null;
  isCustomized: boolean;    // any override or extra exists on this link
  sharedWithCount: number;  // number of OTHER items linked to this template
  modifiers: ResolvedModifier[]; // hidden ones removed
  hiddenModifierIds: string[];
};

resolveGroup(link, template, overrides, extras, sharedWithCount): ResolvedGroup
resolveItem(item, linksWithData): ResolvedItem
resolveMenu(store): ResolvedMenu
```

Algorithm for `resolveGroup`:
1. Start from template `name`, `minSelect`, `maxSelect`.
2. Apply `nameOverride`, `minOverride`, and (if `maxOverrideSet`) `maxOverride`.
3. For each template modifier: apply its `ModifierOverride` (name, price, sort). Skip if `hidden`.
4. Append `LinkExtraModifier` rows.
5. Sort by effective `sortOrder`, then name.
6. Clamp: if `minSelect` > number of visible modifiers, flag a validation warning (don't crash).

---

## 6. Change Engine (`lib/menu/changes.ts`)

**All writes go through this module.** UI never writes to Prisma directly. Each function runs in one transaction, writes a `ChangeLog` row with `before`/`after`, and returns `{ ok, summary, conflicts? }`.

```ts
type Scope =
  | { type: "item"; itemId: string }
  | { type: "items"; itemIds: string[] }
  | { type: "all" };
```

| Function | `item` / `items` scope | `all` scope |
|---|---|---|
| `setGroupField(groupId, field, value, scope)` (name/min/max) | upsert override on each link | update template; return `conflicts` = links with an override on that field |
| `setModifierField(modifierId, field, value, scope)` (name/price/sortOrder) | upsert `ModifierOverride` | update template modifier; return conflicts |
| `hideModifier(modifierId, scope)` | `hidden=true` override | delete template modifier (UI must confirm) |
| `addModifier(groupId, data, scope)` | create `LinkExtraModifier` on each link | create template `Modifier` |
| `setModifierStock(modifierId, inStock)` | — | always global |
| `resetOverrides(linkId, fields?)` | delete overrides (all or listed) | — |
| `detachGroup(linkId)` | create new group from resolved values, relink, remove old link | — |
| `linkGroup(itemIds, groupId)` / `unlinkGroup(linkId)` | — | — |
| Item / category CRUD | plain updates (items are never shared) | — |

Rules:
- An override equal to the template value is deleted, not stored.
- `items` scope where the selection = every linked item → treat as `all`.
- `all` scope with conflicts: the UI asks "N items have their own value — also reset them?" If yes, call `resetOverrides` for those links in the same transaction.
- `undo(changeId)`: restore `before` rows, delete rows created in `after`, mark `undone=true`. Only allow undoing the most recent non-undone change first (stack order).

---

## 7. Screens

All under `/stores/[storeId]`. Desktop first, usable on tablet.

**7.1 Menu Editor — `/menu`** (main screen, 3 panes)
- **Left:** category list with search; click to filter; add category.
- **Center:** items in the selected category: name, price, availability toggle, small badges ("2 groups · 1 customized").
- **Right:** editor side panel (opens on item click, no page change).
- **Top bar:** store name · "**4 unpublished changes**" · Undo · Review & Publish · Preview.

**7.2 Item Editor (right panel)**
- Basics: name, price, description, taxable, available, image URL.
- **Modifier Groups** section — one card per linked group:
  - Header: group name, min/max, badge **"Shared · 4 other items"** or **"Customized for this item"** (amber).
  - Option rows: name · price · stock dot · hide/show eye icon. Overridden values shown in **amber** with a small "↺" reset icon.
  - Actions: Add option · Compare with shared · Reset all · Detach · Unlink.
  - Inline edits save on blur/Enter and trigger the **Scope Prompt** if the group is shared.
- "+ Link group" (search existing groups or create new).

**7.3 Scope Prompt (modal)**
```
Change "Bacon" price to $1.50

Apply to:
 ◉ This item only (Steak & Eggs)
 ○ All linked items (4)
 ○ Choose items…  [checklist of linked items]

 ☐ Remember my choice for this session
              [Cancel]  [Apply]
```
- Default when editing from an item: **This item only**.
- Default when editing from the Group Library: **All linked items**.
- If "All" has conflicts → follow-up: "1 item has its own price for Bacon (Steak & Eggs: $1.50). Keep theirs / Reset them too".
- If the group is linked to only one item, skip the prompt.

**7.4 Compare Drawer**
Side-by-side: Shared value | This item. Each differing row has "Reset". Footer: "Reset all to shared".

**7.5 Group Library — `/groups`**
- All groups: name, min/max, option count, **used by N items**, **N customized**.
- Click → group editor (template) + "Where used" list showing each item and whether it's customized (link to that item).
- Find duplicates helper (Phase 2): groups with identical options → offer merge.

**7.6 Review & Publish — `/publish`**
- List of unpublished `ChangeLog` summaries (newest first), each with Undo.
- Note field + **Publish** button → creates `MenuVersion`.
- Version history list (Phase 2: view diff, restore as draft).

**7.7 Preview — `/preview`**
Customer-style rendering of the **draft** resolved menu (toggle: Draft / Last published). Clicking an item shows its modifier choices exactly as a customer would see them.

**7.8 Public API**
`GET /api/public/stores/[storeId]/menu` → latest published `resolvedSnapshot` (JSON). No auth. Used by future integrations.

---

## 8. Sample Data (`prisma/seed.ts`)

Store **"Demo Diner"** (tax 8%). Generic data, no real client menus.

- **Categories:** Breakfast Platters, Sandwiches, Lunch, Beverages
- **Shared groups:**
  - **Protein** (min 1, max 1): Bacon, Turkey Bacon, Pork Sausage, Turkey Sausage, Scrapple, Beef Sausage — all $0
  - **Bread** (min 1, max 1): White, Wheat, Rye, Potato
  - **Side** (min 1, max 1): Home Fries, Grits
  - **Eggs Style** (min 0, max 1): Scrambled, Over Easy, Sunny Side Up
  - **Drink Size** (min 1, max 1): Small $0, Medium +$0.50, Large +$1.00
- **Items (~14)** with Protein linked to at least 4 items (Two Eggs w/ Meat, Meat Omelette, Waffle & Meat, Steak & Eggs, Meat & Egg Sandwich).
- **Pre-seeded overrides** (so the feature is visible immediately):
  - Steak & Eggs → Protein: Bacon $1.50, Scrapple hidden
  - Meat Omelette → Protein: extra option "Ham +$1.00"
  - Lemonade → Drink Size: Small hidden
- One admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars.
- Seed is idempotent (wipe Demo Diner, then recreate).

---

## 9. Build Steps (paste into Claude Code one at a time)

Each step ends with a **Done when** check. Don't start the next step until it passes.

**Step 0 — Setup (you, not Claude Code)**
1. Create an empty folder `jaymenu`, open it in your terminal.
2. Put this file in it as `JAYMENU_PLAN.md`.
3. Start Claude Code in that folder.

**Step 1 — Scaffold**
> Read JAYMENU_PLAN.md. Do Step 1: scaffold a Next.js App Router TypeScript project with Tailwind, shadcn/ui, Prisma (PostgreSQL), Zod and Vitest. Add a `.env.example` (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, ADMIN_EMAIL, ADMIN_PASSWORD), a `docker-compose.yml` for local Postgres, and a CLAUDE.md that copies the Section 10 rules. Add npm scripts: dev, build, test, db:migrate, db:seed, db:studio.

✅ Done when: `docker compose up -d` + `npm run dev` shows a placeholder home page, and `npm test` runs (0 tests OK).

**Step 2 — Schema + seed**
> Do Step 2: add the Prisma schema from Section 4 (plus NextAuth models), run the migration, and write the seed from Section 8.

✅ Done when: `npm run db:seed` succeeds and Prisma Studio shows Demo Diner with the 3 pre-seeded overrides.

**Step 3 — Resolver + tests**
> Do Step 3: build `lib/menu/resolve.ts` per Section 5, with Vitest tests covering every row of the Section 3 worked example, hidden options, extras, min/max overrides, and "no limit" max.

✅ Done when: `npm test` passes; tests prove an override on one link never changes another link's result.

**Step 4 — Change engine + tests**
> Do Step 4: build `lib/menu/changes.ts` per Section 6, including ChangeLog writes, conflicts on "all" scope, override cleanup when equal to template, detach, and undo. Write tests against a test database.

✅ Done when: tests pass for these must-haves:
- Edit Protein → Bacon price with scope "item" on Steak & Eggs → all other items unchanged.
- Edit template Bacon price with scope "all" → every item changes except ones with a Bacon override, which are returned as conflicts.
- Detach creates an independent group; later template edits don't affect it.
- Undo restores the exact previous state.

**Step 5 — Menu editor (read-only)**
> Do Step 5: build the 3-pane Menu Editor (Section 7.1) using the resolver. Read-only for now; the item panel shows group cards with Shared/Customized badges and amber overridden values.

✅ Done when: Steak & Eggs shows "Customized", Bacon $1.50 in amber, and Scrapple missing; Waffle & Meat shows plain shared Protein.

**Step 6 — Editing + Scope Prompt**
> Do Step 6: make item basics and group cards editable through server actions that call the change engine. Add the Scope Prompt (7.3) with its defaults, the conflict follow-up, and "remember for session." Show the unpublished-changes counter and Undo in the top bar.

✅ Done when: you can change Bacon on Meat Omelette "This item only" and confirm on screen that the other items didn't change; Undo reverts it.

**Step 7 — Compare, reset, detach, link/unlink**
> Do Step 7: build the Compare Drawer (7.4), per-field reset, Reset all, Detach, Link group, Unlink.

✅ Done when: Steak & Eggs → Reset all makes it match shared Protein again and the badge returns to "Shared."

**Step 8 — Group Library**
> Do Step 8: build `/groups` (7.5) with usage counts, customized counts, the template editor (defaults to "All linked items"), and the Where-used list.

✅ Done when: Protein shows "used by 5 · 2 customized" and each row links to the item.

**Step 9 — Publish + Preview + Public API**
> Do Step 9: build Review & Publish (7.6), MenuVersion snapshots, Preview (7.7) with Draft/Published toggle, and the public JSON endpoint (7.8).

✅ Done when: an edit shows in Draft preview but not in Published until you publish; the API returns the new version after publishing.

**Step 10 — Auth + deploy**
> Do Step 10: add NextAuth credentials login (admin from env), protect every `/stores` route and server action (public API stays open), then prepare for Railway (build/start scripts, `prisma migrate deploy` on start, README deploy steps).

✅ Done when: logged-out users are redirected to /login, and the app runs on Railway with the seed loaded.

---

## 10. Rules for Claude Code (copy into CLAUDE.md)

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

---

## 11. Phase 2+ Backlog (not in MVP)

- Drag-and-drop reorder (categories, items, groups, options) with dnd-kit
- Bulk edit: select items → link/unlink group, change prices by % or $, toggle availability
- Version history: diff between versions, restore a version as the draft
- Find & merge duplicate groups
- CSV import/export of a full menu
- Multiple stores + copy a menu between stores
- Item schedules (breakfast-only hours), images upload, allergens/calories
- Category-level default groups (auto-link to new items in that category)

---

## 12. Testing Checklist (manual, before calling MVP done)

- [ ] Item-only edit on a shared group leaves every other item untouched
- [ ] "All linked items" updates everyone except overridden fields, with the conflict prompt shown
- [ ] "Choose items" only changes the checked items
- [ ] Hidden option disappears for that item only; out-of-stock disappears everywhere
- [ ] Extra option appears on that item only
- [ ] Reset field / Reset all / Detach all behave as described
- [ ] Undo works for each change type, in order
- [ ] Draft changes don't appear in Published preview or the public API until Publish
- [ ] Unpublished counter is accurate
- [ ] Logged-out access is blocked (except public API)
- [ ] Works on a tablet-width screen
