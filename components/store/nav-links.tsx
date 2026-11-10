"use client";

import { LayersIcon, ListIcon, SlidersHorizontalIcon, UtensilsIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Same four sections as Foodhub's menu editor.
const LINKS = [
  { href: "/categories", label: "Categories", icon: ListIcon },
  { href: "/menu", label: "Items", icon: UtensilsIcon },
  { href: "/groups", label: "Modifier Groups", icon: LayersIcon },
  { href: "/modifiers", label: "Modifiers", icon: SlidersHorizontalIcon },
];

/** `/stores/{id}` from the current path. */
function useStoreBase() {
  const parts = usePathname().split("/");
  return { path: parts.join("/"), base: `/${parts[1]}/${parts[2]}` };
}

/** Desktop / tablet: tabs in the top bar. */
export function NavLinks() {
  const { path, base } = useStoreBase();
  return (
    <nav className="hidden gap-1 md:flex">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={base + l.href}
          className={cn("whitespace-nowrap rounded-md px-2 py-1 text-sm hover:bg-muted", path.startsWith(base + l.href) ? "bg-muted font-medium" : "text-muted-foreground")}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

/** Phones: app-style tab bar at the bottom of the screen. */
export function BottomNav() {
  const { path, base } = useStoreBase();
  return (
    <nav className="grid shrink-0 grid-cols-4 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
      {LINKS.map((l) => {
        const active = path.startsWith(base + l.href);
        return (
          <Link
            key={l.href}
            href={base + l.href}
            className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] leading-tight", active ? "font-medium text-foreground" : "text-muted-foreground")}
          >
            <l.icon className={cn("size-5", active && "text-primary")} />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
