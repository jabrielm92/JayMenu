"use client";

import { ConfirmProvider } from "./confirm";
import { ItemPickerProvider } from "./item-picker";
import { ScopePromptProvider } from "./scope-prompt";

export function EditorProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmProvider>
      <ScopePromptProvider>
        <ItemPickerProvider>{children}</ItemPickerProvider>
      </ScopePromptProvider>
    </ConfirmProvider>
  );
}
