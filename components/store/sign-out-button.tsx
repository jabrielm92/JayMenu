"use client";

import { LogOutIcon } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button variant="ghost" size="icon-sm" aria-label="Sign out" title="Sign out" onClick={() => signOut({ callbackUrl: "/login" })}>
      <LogOutIcon />
    </Button>
  );
}
