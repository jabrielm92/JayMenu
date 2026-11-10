"use client";

import { ConfirmProvider } from "./confirm";
import { DrillPickerProvider } from "./drill-picker";
import { ItemPickerProvider } from "./item-picker";
import { ScopePromptProvider } from "./scope-prompt";

export function EditorProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmProvider>
      <ScopePromptProvider>
        <ItemPickerProvider>
          <DrillPickerProvider>{children}</DrillPickerProvider>
        </ItemPickerProvider>
      </ScopePromptProvider>
    </ConfirmProvider>
  );
}
