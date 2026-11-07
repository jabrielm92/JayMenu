"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Same four sections as Foodhub's menu editor.
const LINKS = [
  { href: "/categories", label: "Categories" },
  { href: "/menu", label: "Items" },
  { href: "/groups", label: "Modifier Groups" },
  { href: "/modifiers", label: "Modifiers" },
];

export function NavLinks({ base }: { base: string }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={base + l.href}
          className={cn(
            "whitespace-nowrap rounded-md px-2 py-1 text-sm hover:bg-muted",
            path.startsWith(base + l.href) ? "bg-muted font-medium" : "text-muted-foreground",
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
