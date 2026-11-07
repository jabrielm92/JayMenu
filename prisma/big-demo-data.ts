// "Big Demo Diner": a large, Foodhub-style menu for stress-testing shared group modifiers.
// Generic diner data — not any real restaurant's menu. Prices are integer cents.
import type { PrismaClient } from "../lib/generated/prisma/client";
import { seedStore, type StoreSpec } from "./seed-store";

export const BIG_DEMO_STORE_ID = "big-demo-diner";

const PLATTER = "Make it a Platter";

export const BIG_DEMO: StoreSpec = {
  id: BIG_DEMO_STORE_ID,
  name: "Big Demo Diner",
  taxRatePct: "8.00",
  groups: [
    { name: "Choice of Meat", min: 1, max: 1, options: [["Bacon", 0], ["Turkey Bacon", 0], ["Pork Sausage", 0], ["Turkey Sausage", 0], ["Scrapple", 0], ["Beef Sausage", 0], ["Pork Roll", 0]] },
    { name: "Eggs Style", min: 1, max: 1, options: [["Scrambled", 0], ["Over Easy", 0], ["Over Medium", 0], ["Over Hard", 0], ["Sunny Side Up", 0], ["Poached", 50]] },
    { name: "Choice of Toast", min: 1, max: 1, options: [["White", 0], ["Wheat", 0], ["Rye", 0], ["Potato", 0], ["English Muffin", 0], ["Bagel", 75], ["Biscuit", 50]] },
    { name: "Breakfast Side", min: 1, max: 1, options: [["Home Fries", 0], ["Grits", 0], ["Hash Browns", 50], ["Fruit Cup", 150]] },
    { name: "Add Cheese", min: 0, max: 1, options: [["American", 75], ["Provolone", 75], ["Swiss", 75], ["Cheddar", 75], ["Pepper Jack", 75], ["Feta", 100]] },
    { name: "Extra Toppings", min: 0, max: null, options: [["Peppers", 50], ["Onions", 50], ["Mushrooms", 50], ["Tomato", 50], ["Spinach", 50], ["Jalapeños", 50], ["Avocado", 150]] },
    { name: "Choice of Roll", min: 1, max: 1, options: [["Kaiser Roll", 0], ["Long Roll", 0], ["Wrap", 0], ["Croissant", 100], ["Bagel", 75]] },
    { name: "Sandwich Toppings", min: 0, max: null, options: [["Lettuce", 0], ["Tomato", 0], ["Onion", 0], ["Pickles", 0], ["Mayo", 0], ["Ketchup", 0], ["Mustard", 0], ["Hot Peppers", 0], ["Sweet Peppers", 0], ["Oil & Vinegar", 0]] },
    { name: "Cheesesteak Extras", min: 0, max: null, options: [["Fried Onions", 0], ["Mushrooms", 75], ["Sweet Peppers", 50], ["Hot Peppers", 50], ["Extra Meat", 300], ["Extra Cheese", 100]] },
    { name: "Cheesesteak Cheese", min: 1, max: 1, options: [["American", 0], ["Provolone", 0], ["Cheez Whiz", 0], ["No Cheese", 0]] },
    { name: "Burger Temperature", min: 1, max: 1, options: [["Medium Rare", 0], ["Medium", 0], ["Medium Well", 0], ["Well Done", 0]] },
    { name: "Lunch Side", min: 1, max: 1, options: [["French Fries", 0], ["Coleslaw", 0], ["Onion Rings", 100], ["Side Salad", 150], ["Sweet Potato Fries", 150]] },
    { name: PLATTER, min: 0, max: 1, options: [["Platter (Fries & Coleslaw)", 350]] },
    { name: "Pancake Add-ins", min: 0, max: null, options: [["Chocolate Chips", 100], ["Blueberries", 100], ["Strawberries", 125], ["Bananas", 100], ["Whipped Cream", 50]] },
    { name: "Syrup", min: 0, max: 1, options: [["Pancake Syrup", 0], ["Sugar-Free Syrup", 0], ["Real Maple Syrup", 150, { inStock: false }]] },
    { name: "Salad Dressing", min: 1, max: 1, options: [["Ranch", 0], ["Italian", 0], ["Balsamic", 0], ["Blue Cheese", 0], ["Honey Mustard", 0], ["Thousand Island", 0]] },
    { name: "Add Protein", min: 0, max: 1, options: [["Grilled Chicken", 400], ["Crispy Chicken", 400], ["Shrimp", 600], ["Salmon", 700]] },
    { name: "Wing Sauce", min: 1, max: 2, options: [["Buffalo Mild", 0], ["Buffalo Hot", 0], ["BBQ", 0], ["Honey Garlic", 0], ["Old Bay Dry Rub", 0]] },
    { name: "Dipping Sauce", min: 0, max: 2, options: [["Ranch", 0], ["Blue Cheese", 0], ["Honey Mustard", 0], ["BBQ", 0], ["Ketchup", 0]] },
    { name: "Drink Size", min: 1, max: 1, options: [["Small", 0], ["Medium", 50], ["Large", 100]] },
    { name: "Milk Choice", min: 0, max: 1, options: [["Whole Milk", 0], ["Skim Milk", 0], ["Oat Milk", 75], ["Almond Milk", 75]] },
    { name: "Coffee Extras", min: 0, max: null, options: [["Extra Shot", 100], ["Vanilla", 50], ["Caramel", 50], ["Hazelnut", 50]] },
    { name: "Soda Flavor", min: 1, max: 1, options: [["Coke", 0], ["Diet Coke", 0], ["Sprite", 0], ["Ginger Ale", 0], ["Root Beer", 0]] },
    { name: "Juice Flavor", min: 1, max: 1, options: [["Orange", 0], ["Apple", 0], ["Cranberry", 0], ["Grapefruit", 0]] },
    { name: "Shake Flavor", min: 1, max: 1, options: [["Vanilla", 0], ["Chocolate", 0], ["Strawberry", 0], ["Cookies & Cream", 50]] },
    { name: "Kids Drink", min: 1, max: 1, options: [["Apple Juice", 0], ["Milk", 0], ["Chocolate Milk", 0], ["Lemonade", 0]] },
  ],
  categories: [
    {
      name: "Breakfast Platters",
      items: [
        { name: "Two Eggs Any Style", price: 699, description: "Two eggs with toast and a side.", groups: ["Eggs Style", "Choice of Toast", "Breakfast Side"] },
        { name: "Two Eggs w/ Meat", price: 899, description: "Two eggs, your choice of meat, toast and a side.", groups: ["Eggs Style", "Choice of Meat", "Choice of Toast", "Breakfast Side"] },
        { name: "Three Egg Breakfast", price: 999, groups: ["Eggs Style", "Choice of Meat", "Choice of Toast", "Breakfast Side"] },
        { name: "Steak & Eggs", price: 1699, description: "Grilled steak, two eggs, meat, toast and a side.", groups: ["Eggs Style", "Choice of Meat", "Choice of Toast", "Breakfast Side"] },
        { name: "Country Fried Steak & Eggs", price: 1499, groups: ["Eggs Style", "Choice of Toast", "Breakfast Side"] },
        { name: "Corned Beef Hash & Eggs", price: 1199, groups: ["Eggs Style", "Choice of Toast", "Breakfast Side"] },
        { name: "Biscuits & Gravy", price: 899, description: "Two biscuits with sausage gravy.", groups: ["Eggs Style", "Choice of Meat"] },
        { name: "Breakfast Burrito", price: 1049, description: "Scrambled eggs, meat and cheese in a flour tortilla.", groups: ["Choice of Meat", "Add Cheese", "Extra Toppings", "Breakfast Side"] },
      ],
    },
    {
      name: "Omelettes",
      description: "Three-egg omelettes served with toast and a side.",
      items: [
        { name: "Cheese Omelette", price: 899, groups: ["Add Cheese", "Extra Toppings", "Choice of Toast", "Breakfast Side"] },
        { name: "Meat Omelette", price: 1099, groups: ["Choice of Meat", "Add Cheese", "Extra Toppings", "Choice of Toast", "Breakfast Side"] },
        { name: "Western Omelette", price: 1099, description: "Ham, peppers and onions.", groups: ["Add Cheese", "Extra Toppings", "Choice of Toast", "Breakfast Side"] },
        { name: "Veggie Omelette", price: 1049, groups: ["Add Cheese", "Extra Toppings", "Choice of Toast", "Breakfast Side"] },
        { name: "Greek Omelette", price: 1099, description: "Spinach, tomato and feta.", groups: ["Extra Toppings", "Choice of Toast", "Breakfast Side"] },
        { name: "Steak & Cheese Omelette", price: 1249, groups: ["Add Cheese", "Extra Toppings", "Choice of Toast", "Breakfast Side"] },
        { name: "Build Your Own Omelette", price: 999, groups: ["Choice of Meat", "Add Cheese", "Extra Toppings", "Choice of Toast", "Breakfast Side"] },
      ],
    },
    {
      name: "Pancakes, Waffles & French Toast",
      items: [
        { name: "Pancake Stack", price: 799, description: "Three buttermilk pancakes.", groups: ["Pancake Add-ins", "Syrup"] },
        { name: "Pancakes w/ Meat", price: 1049, groups: ["Choice of Meat", "Eggs Style", "Pancake Add-ins", "Syrup"] },
        { name: "Belgian Waffle", price: 849, groups: ["Pancake Add-ins", "Syrup"] },
        { name: "Waffle & Meat", price: 999, groups: ["Choice of Meat", "Pancake Add-ins", "Syrup"] },
        { name: "Chicken & Waffles", price: 1399, groups: ["Syrup", "Dipping Sauce"] },
        { name: "French Toast", price: 849, groups: ["Pancake Add-ins", "Syrup"] },
        { name: "French Toast w/ Meat", price: 1099, groups: ["Choice of Meat", "Eggs Style", "Pancake Add-ins", "Syrup"] },
      ],
    },
    {
      name: "Breakfast Sandwiches",
      items: [
        { name: "Egg & Cheese Sandwich", price: 549, groups: ["Eggs Style", "Add Cheese", "Choice of Roll"] },
        { name: "Meat, Egg & Cheese Sandwich", price: 699, groups: ["Choice of Meat", "Eggs Style", "Add Cheese", "Choice of Roll"] },
        { name: "Breakfast Croissant", price: 799, groups: ["Choice of Meat", "Eggs Style", "Add Cheese"] },
        { name: "Breakfast Wrap", price: 849, groups: ["Choice of Meat", "Eggs Style", "Add Cheese", "Extra Toppings"] },
        { name: "Bagel w/ Cream Cheese", price: 399, groups: [] },
        { name: "Breakfast Quesadilla", price: 949, groups: ["Choice of Meat", "Add Cheese", "Extra Toppings"] },
      ],
    },
    {
      name: "Hoagies & Cheesesteaks",
      items: [
        { name: "Cheesesteak", price: 1199, groups: ["Cheesesteak Cheese", "Cheesesteak Extras", PLATTER] },
        { name: "Chicken Cheesesteak", price: 1199, groups: ["Cheesesteak Cheese", "Cheesesteak Extras", PLATTER] },
        { name: "Pizza Steak", price: 1249, description: "Cheesesteak with pizza sauce and provolone.", groups: ["Cheesesteak Cheese", "Cheesesteak Extras", PLATTER] },
        { name: "Italian Hoagie", price: 1099, groups: ["Choice of Roll", "Add Cheese", "Sandwich Toppings", PLATTER] },
        { name: "Turkey Hoagie", price: 1049, groups: ["Choice of Roll", "Add Cheese", "Sandwich Toppings", PLATTER] },
        { name: "Tuna Hoagie", price: 1049, groups: ["Choice of Roll", "Add Cheese", "Sandwich Toppings", PLATTER] },
        { name: "Veggie Hoagie", price: 949, groups: ["Choice of Roll", "Add Cheese", "Sandwich Toppings", PLATTER] },
      ],
    },
    {
      name: "Burgers",
      description: "Half-pound burgers served with a side.",
      items: [
        { name: "Hamburger", price: 1099, groups: ["Burger Temperature", "Add Cheese", "Sandwich Toppings", "Lunch Side"] },
        { name: "Cheeseburger", price: 1199, groups: ["Burger Temperature", "Add Cheese", "Sandwich Toppings", "Lunch Side"] },
        { name: "Bacon Cheeseburger", price: 1349, groups: ["Burger Temperature", "Add Cheese", "Sandwich Toppings", "Lunch Side"] },
        { name: "Mushroom Swiss Burger", price: 1299, groups: ["Burger Temperature", "Sandwich Toppings", "Lunch Side"] },
        { name: "Turkey Burger", price: 1199, groups: ["Add Cheese", "Sandwich Toppings", "Lunch Side"] },
        { name: "Veggie Burger", price: 1149, groups: ["Add Cheese", "Sandwich Toppings", "Lunch Side"] },
      ],
    },
    {
      name: "Clubs & Wraps",
      items: [
        { name: "Turkey Club", price: 1199, groups: ["Choice of Toast", "Sandwich Toppings", "Lunch Side"] },
        { name: "BLT", price: 899, groups: ["Choice of Toast", "Sandwich Toppings", "Lunch Side"] },
        { name: "Tuna Melt", price: 1049, groups: ["Choice of Toast", "Add Cheese", "Lunch Side"] },
        { name: "Grilled Cheese", price: 749, groups: ["Choice of Toast", "Add Cheese", "Lunch Side"] },
        { name: "Chicken Caesar Wrap", price: 1099, groups: ["Sandwich Toppings", "Lunch Side"] },
        { name: "Buffalo Chicken Wrap", price: 1099, groups: ["Sandwich Toppings", "Dipping Sauce", "Lunch Side"] },
      ],
    },
    {
      name: "Salads",
      items: [
        { name: "Garden Salad", price: 899, groups: ["Salad Dressing", "Add Protein"] },
        { name: "Chef Salad", price: 1199, groups: ["Salad Dressing", "Add Protein"] },
        { name: "Caesar Salad", price: 949, groups: ["Salad Dressing", "Add Protein"] },
        { name: "Greek Salad", price: 1049, groups: ["Salad Dressing", "Add Protein"] },
      ],
    },
    {
      name: "Wings & Baskets",
      items: [
        { name: "Wings (6 pc)", price: 899, groups: ["Wing Sauce", "Dipping Sauce"] },
        { name: "Wings (12 pc)", price: 1599, groups: ["Wing Sauce", "Dipping Sauce"] },
        { name: "Chicken Tenders Basket", price: 1099, groups: ["Dipping Sauce", "Lunch Side"] },
        { name: "Fish & Chips", price: 1399, groups: ["Dipping Sauce", "Lunch Side"], available: false },
      ],
    },
    {
      name: "Sides",
      items: [
        { name: "French Fries", price: 399, groups: [] },
        { name: "Cheese Fries", price: 549, groups: ["Add Cheese"] },
        { name: "Onion Rings", price: 499, groups: ["Dipping Sauce"] },
        { name: "Home Fries", price: 349, groups: [] },
        { name: "Side of Meat", price: 399, groups: ["Choice of Meat"] },
        { name: "Toast", price: 249, groups: ["Choice of Toast"] },
      ],
    },
    {
      name: "Beverages",
      items: [
        { name: "Coffee", price: 199, groups: ["Drink Size", "Milk Choice", "Coffee Extras"] },
        { name: "Iced Coffee", price: 299, groups: ["Drink Size", "Milk Choice", "Coffee Extras"] },
        { name: "Hot Tea", price: 199, groups: [] },
        { name: "Fountain Soda", price: 249, groups: ["Drink Size", "Soda Flavor"] },
        { name: "Lemonade", price: 299, groups: ["Drink Size"] },
        { name: "Fresh Juice", price: 399, groups: ["Drink Size", "Juice Flavor"] },
        { name: "Milkshake", price: 599, groups: ["Shake Flavor"] },
      ],
    },
    {
      name: "Kids Menu",
      description: "For kids 10 and under. Includes a drink.",
      items: [
        { name: "Kids Pancakes", price: 599, groups: ["Syrup", "Kids Drink"] },
        { name: "Kids Chicken Tenders", price: 699, groups: ["Dipping Sauce", "Kids Drink"] },
        { name: "Kids Grilled Cheese", price: 599, groups: ["Kids Drink"] },
        { name: "Kids Burger", price: 699, groups: ["Add Cheese", "Kids Drink"] },
      ],
    },
  ],
  // Item-only customizations — the edits that force duplicate groups in Foodhub today.
  overrides: [
    { kind: "modifier", item: "Steak & Eggs", group: "Choice of Meat", modifier: "Bacon", price: 150 },
    { kind: "modifier", item: "Steak & Eggs", group: "Choice of Meat", modifier: "Scrapple", hidden: true },
    { kind: "extra", item: "Meat Omelette", group: "Choice of Meat", name: "Ham", price: 100 },
    { kind: "extra", item: "Breakfast Burrito", group: "Choice of Meat", name: "Chorizo", price: 150 },
    { kind: "modifier", item: "Breakfast Burrito", group: "Choice of Meat", modifier: "Scrapple", hidden: true },
    { kind: "group", item: "Biscuits & Gravy", group: "Choice of Meat", name: "Add a Side of Meat", min: 0 },
    { kind: "group", item: "Biscuits & Gravy", group: "Eggs Style", name: "Add Eggs", min: 0 },
    { kind: "group", item: "Build Your Own Omelette", group: "Extra Toppings", name: "Pick Your Fillings", max: 4 },
    { kind: "modifier", item: "Greek Omelette", group: "Extra Toppings", modifier: "Spinach", hidden: true },
    { kind: "modifier", item: "Greek Omelette", group: "Extra Toppings", modifier: "Tomato", hidden: true },
    { kind: "modifier", item: "Breakfast Croissant", group: "Choice of Meat", modifier: "Scrapple", hidden: true },
    { kind: "modifier", item: "Pizza Steak", group: "Cheesesteak Cheese", modifier: "Cheez Whiz", hidden: true },
    { kind: "extra", item: "Pizza Steak", group: "Cheesesteak Extras", name: "Extra Pizza Sauce", price: 50 },
    { kind: "modifier", item: "Chicken Cheesesteak", group: "Cheesesteak Extras", modifier: "Extra Meat", name: "Extra Chicken", price: 350 },
    { kind: "modifier", item: "Turkey Burger", group: "Lunch Side", modifier: "Sweet Potato Fries", price: 0 },
    { kind: "modifier", item: "Chicken Caesar Wrap", group: "Sandwich Toppings", modifier: "Pickles", hidden: true },
    { kind: "modifier", item: "Chicken Caesar Wrap", group: "Sandwich Toppings", modifier: "Ketchup", hidden: true },
    { kind: "modifier", item: "Chicken Caesar Wrap", group: "Sandwich Toppings", modifier: "Mustard", hidden: true },
    { kind: "extra", item: "Greek Salad", group: "Salad Dressing", name: "Greek Vinaigrette", price: 0 },
    { kind: "modifier", item: "Wings (12 pc)", group: "Wing Sauce", modifier: "Old Bay Dry Rub", price: 100 },
    { kind: "group", item: "Wings (12 pc)", group: "Wing Sauce", max: 3 },
    { kind: "modifier", item: "Lemonade", group: "Drink Size", modifier: "Small", hidden: true },
    { kind: "modifier", item: "Iced Coffee", group: "Drink Size", modifier: "Small", hidden: true },
    { kind: "modifier", item: "Iced Coffee", group: "Drink Size", modifier: "Large", price: 150 },
    { kind: "modifier", item: "Kids Pancakes", group: "Syrup", modifier: "Real Maple Syrup", hidden: true },
  ],
};

/** Idempotent: wipes Big Demo Diner, then recreates it. */
export async function seedBigDemo(prisma: PrismaClient, opts: { quiet?: boolean } = {}) {
  const store = await seedStore(prisma, BIG_DEMO);
  if (!opts.quiet) console.log(`Seeded "${store.name}" (id: ${store.id}).`);
  return store;
}
