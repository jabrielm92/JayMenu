import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/guard";
import { listStores } from "@/lib/menu/queries";

async function StoreList() {
  await connection();
  await requireAdmin();
  const stores = await listStores();
  if (!stores.length) return <p className="text-muted-foreground">No stores yet — run <code>npm run db:seed</code>.</p>;
  return (
    <ul className="w-full max-w-sm divide-y rounded-lg border">
      {stores.map((s) => (
        <li key={s.id}>
          <Link href={`/stores/${s.id}/menu`} className="block px-4 py-3 font-medium hover:bg-muted">
            {s.name} →
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">JayMenu</h1>
      <p className="max-w-md text-muted-foreground">Shared modifier groups, with per-item overrides. Pick a store to edit its menu.</p>
      <Suspense fallback={<p className="text-muted-foreground">Loading stores…</p>}>
        <StoreList />
      </Suspense>
    </main>
  );
}
