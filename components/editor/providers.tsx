"use client";

import { ConfirmProvider } from "./confirm";
import { ScopePromptProvider } from "./scope-prompt";

export function EditorProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmProvider>
      <ScopePromptProvider>{children}</ScopePromptProvider>
    </ConfirmProvider>
  );
}
