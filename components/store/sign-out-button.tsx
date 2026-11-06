"use client";

import { LogOutIcon } from "lucide-react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Sign out"
      title="Sign out"
      onClick={async () => {
        // Navigate ourselves so sign-out works whatever host the app is served from.
        await signOut({ redirect: false });
        router.replace("/login");
        router.refresh();
      }}
    >
      <LogOutIcon />
    </Button>
  );
}
