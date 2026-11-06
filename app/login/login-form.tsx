"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Only allow same-site relative callback paths. */
function safeCallback(v: string | null) {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/";
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="grid gap-4 rounded-lg border p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        const res = await signIn("credentials", {
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
          redirect: false,
        });
        setBusy(false);
        if (res?.ok && !res.error) {
          router.replace(safeCallback(params.get("callbackUrl")));
          router.refresh();
        } else setError("Wrong email or password.");
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
