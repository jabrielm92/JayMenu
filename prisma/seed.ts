// Seed for Demo Diner (JAYMENU_PLAN.md Section 8). Idempotent: wipes Demo Diner, then recreates it.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { createPrismaClient } from "../lib/db";

export const DEMO_STORE_ID = "demo-diner";

const prisma = createPrismaClient();

type GroupSpec = { name: string; min: number; max: number | null; options: [string, number][] };

const GROUPS: Record<string, GroupSpec> = {
  Protein: {
    name: "Protein",
    min: 1,
    max: 1,
    options: [
      ["Bacon", 0],
      ["Turkey Bacon", 0],
      ["Pork Sausage", 0],
      ["Turkey Sausage", 0],
      ["Scrapple", 0],
      ["Beef Sausage", 0],
    ],
  },
  Bread: { name: "Bread", min: 1, max: 1, options: [["White", 0], ["Wheat", 0], ["Rye", 0], ["Potato", 0]] },
  Side: { name: "Side", min: 1, max: 1, options: [["Home Fries", 0], ["Grits", 0]] },
  "Eggs Style": {
    name: "Eggs Style",
    min: 0,
    max: 1,
    options: [["Scrambled", 0], ["Over Easy", 0], ["Sunny Side Up", 0]],
  },
  "Drink Size": {
    name: "Drink Size",
    min: 1,
    max: 1,
    options: [["Small", 0], ["Medium", 50], ["Large", 100]],
  },
};

type ItemSpec = { name: string; price: number; description?: string; groups: string[] };

const MENU: { category: string; items: ItemSpec[] }[] = [
  {
    category: "Breakfast Platters",
    items: [
      { name: "Two Eggs w/ Meat", price: 899, description: "Two eggs any style with your choice of meat.", groups: ["Protein", "Eggs Style", "Side", "Bread"] },
      { name: "Meat Omelette", price: 1099, description: "Three-egg omelette with your choice of meat.", groups: ["Protein", "Side", "Bread"] },
      { name: "Waffle & Meat", price: 999, description: "Golden waffle with a side of meat.", groups: ["Protein"] },
      { name: "Steak & Eggs", price: 1699, description: "Grilled steak, two eggs, and a side of meat.", groups: ["Protein", "Eggs Style", "Side", "Bread"] },
      { name: "Pancake Stack", price: 799, description: "Three buttermilk pancakes.", groups: [] },
    ],
  },
  {
    category: "Sandwiches",
    items: [
      { name: "Meat & Egg Sandwich", price: 699, groups: ["Protein", "Eggs Style", "Bread"] },
      { name: "BLT", price: 799, groups: ["Bread"] },
      { name: "Grilled Cheese", price: 599, groups: ["Bread"] },
    ],
  },
  {
    category: "Lunch",
    items: [
      { name: "Cheeseburger", price: 1199, groups: ["Side"] },
      { name: "Chicken Tenders", price: 1099, groups: ["Side"] },
      { name: "Garden Salad", price: 899, groups: [] },
    ],
  },
  {
    category: "Beverages",
    items: [
      { name: "Coffee", price: 199, groups: ["Drink Size"] },
      { name: "Lemonade", price: 299, groups: ["Drink Size"] },
      { name: "Orange Juice", price: 349, groups: ["Drink Size"] },
    ],
  },
];

async function main() {
  // Wipe Demo Diner (cascades to everything it owns).
  await prisma.store.deleteMany({ where: { OR: [{ id: DEMO_STORE_ID }, { name: "Demo Diner" }] } });

  const store = await prisma.store.create({
    data: { id: DEMO_STORE_ID, name: "Demo Diner", taxRatePct: "8.00" },
  });

  // Shared groups.
  const groupIds: Record<string, string> = {};
  const modIds: Record<string, Record<string, string>> = {};
  for (const [key, g] of Object.entries(GROUPS)) {
    const group = await prisma.modifierGroup.create({
      data: {
        storeId: store.id,
        name: g.name,
        minSelect: g.min,
        maxSelect: g.max,
        modifiers: {
          create: g.options.map(([name, priceCents], i) => ({ name, priceCents, sortOrder: i })),
        },
      },
      include: { modifiers: true },
    });
    groupIds[key] = group.id;
    modIds[key] = Object.fromEntries(group.modifiers.map((m) => [m.name, m.id]));
  }

  // Categories, items, links.
  const linkIds: Record<string, Record<string, string>> = {};
  for (const [ci, cat] of MENU.entries()) {
    const category = await prisma.category.create({
      data: { storeId: store.id, name: cat.category, sortOrder: ci },
    });
    for (const [ii, spec] of cat.items.entries()) {
      const item = await prisma.item.create({
        data: {
          categoryId: category.id,
          name: spec.name,
          description: spec.description,
          priceCents: spec.price,
          sortOrder: ii,
          groupLinks: {
            create: spec.groups.map((g, gi) => ({ groupId: groupIds[g], sortOrder: gi })),
          },
        },
        include: { groupLinks: true },
      });
      linkIds[spec.name] = Object.fromEntries(
        item.groupLinks.map((l) => [spec.groups[l.sortOrder], l.id]),
      );
    }
  }

  // Pre-seeded overrides.
  const steakProtein = linkIds["Steak & Eggs"]["Protein"];
  await prisma.modifierOverride.create({
    data: { linkId: steakProtein, modifierId: modIds.Protein["Bacon"], priceCentsOverride: 150 },
  });
  await prisma.modifierOverride.create({
    data: { linkId: steakProtein, modifierId: modIds.Protein["Scrapple"], hidden: true },
  });
  await prisma.linkExtraModifier.create({
    data: { linkId: linkIds["Meat Omelette"]["Protein"], name: "Ham", priceCents: 100, sortOrder: 100 },
  });
  await prisma.modifierOverride.create({
    data: {
      linkId: linkIds["Lemonade"]["Drink Size"],
      modifierId: modIds["Drink Size"]["Small"],
      hidden: true,
    },
  });

  // Admin user.
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.upsert({
      where: { email },
      update: { passwordHash },
      create: { email, name: "Admin", passwordHash },
    });
    console.log(`Admin user ready: ${email}`);
  } else {
    console.warn("ADMIN_EMAIL / ADMIN_PASSWORD not set — skipped admin user.");
  }

  console.log(`Seeded "${store.name}" (id: ${store.id}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
