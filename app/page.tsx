import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">JayMenu</h1>
      <p className="max-w-md text-muted-foreground">
        Restaurant menu editor with shared modifier templates and per-item
        overrides. Scaffold is up — the editor arrives in later build steps.
      </p>
      <Button disabled>Open Menu Editor (coming soon)</Button>
    </main>
  );
}
