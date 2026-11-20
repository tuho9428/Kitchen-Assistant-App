import Link from "next/link";
import { notFound } from "next/navigation";
import { loadData } from "@/lib/actions";
import { originalCatalog } from "@/lib/catalog";
import { Prep } from "@/components/prep";
import { DishTimerButton } from "@/components/timers/dish-timer-button";
export const dynamic = "force-dynamic";
export default async function DishPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await loadData();
  const dish = (result.ok ? result.data.dishes : originalCatalog()).find(
    (d) => d.id === id,
  );
  if (!dish) notFound();
  return (
    <main id="main" className="mx-auto max-w-3xl px-5 py-8">
      <Link className="button mb-8" href="/">
        Back to lookup
      </Link>
      {!result.ok && (
        <p className="notice mb-6">Original reference. {result.error}</p>
      )}
      <Prep dish={dish} />
      <DishTimerButton dish={dish} />
    </main>
  );
}
