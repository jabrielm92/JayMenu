import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · JayMenu" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">JayMenu</h1>
          <p className="text-sm text-muted-foreground">Sign in to edit your menu</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
