import { Suspense } from "react";
import { EditorProviders } from "@/components/editor/providers";
import { BottomNav } from "@/components/store/nav-links";
import { TopBar } from "@/components/store/top-bar";

export default function StoreLayout({ children, params }: LayoutProps<"/stores/[storeId]">) {
  return (
    <EditorProviders>
      <div className="flex h-dvh flex-col">
        <Suspense fallback={<div className="h-14 border-b" />}>
          <TopBar params={params} />
        </Suspense>
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
        <Suspense fallback={<div className="h-14 shrink-0 border-t md:hidden" />}>
          <BottomNav />
        </Suspense>
      </div>
    </EditorProviders>
  );
}
