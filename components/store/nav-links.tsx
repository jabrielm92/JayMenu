"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/menu", label: "Menu" },
  { href: "/groups", label: "Groups" },
];

export function NavLinks({ base }: { base: string }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={base + l.href}
          className={cn("rounded-md px-2 py-1 text-sm hover:bg-muted", path.startsWith(base + l.href) ? "bg-muted font-medium" : "text-muted-foreground")}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
