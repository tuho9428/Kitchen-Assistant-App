import { StickyNote, FileText } from "lucide-react";
import type { Dish } from "@/lib/dishes";
const SOURCE_TIMESTAMP = "1970-01-01T00:00:00.000Z";
export function Prep({
  dish,
  compact = false,
}: {
  dish: Dish;
  compact?: boolean;
}) {
  return (
    <article>
      <p className="eyebrow">{dish.category}</p>
      <h2
        className={`${compact ? "text-2xl" : "text-3xl md:text-4xl"} font-semibold tracking-tight mt-2 break-words`}
      >
        {dish.name}
      </h2>
      <p className="text-stone-600 text-sm mt-3">
        Preparation groups · Labels refer to prep containers, not servings.
      </p>
      {dish.groups.length === 0 && (
        <p className="notice mt-6">
          No ingredient groups recorded. Check the prep notes with the chef.
        </p>
      )}
      <div className="space-y-4 mt-7">
        {dish.groups.map((g, i) => (
          <section key={i} className="prepgroup">
            <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
              <h3 className="font-semibold text-lg break-words min-w-0">
                {g.label || `Prep group ${i + 1}`}
              </h3>
              {g.size && <span className="size">{g.size}</span>}
            </header>
            <ul className="p-5 space-y-3">
              {g.ingredients.map((v, j) => (
                <li className="ingredient" key={j}>
                  <span className="ingredient-marker" aria-hidden="true" />
                  <span className="whitespace-pre-wrap break-words">{v}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {dish.notes.length > 0 && (
        <section className="notice mt-6">
          <h3 className="font-semibold flex gap-2 items-center">
            <StickyNote size={18} aria-hidden="true" />
            Prep notes
          </h3>
          <ul className="mt-3 space-y-3">
            {dish.notes.map((n, i) => (
              <li className="whitespace-pre-wrap break-words" key={i}>
                {n}
              </li>
            ))}
          </ul>
        </section>
      )}
      <footer className="text-sm text-stone-600 flex flex-wrap gap-x-5 gap-y-2 mt-7">
        {dish.source_page !== null && (
          <span className="flex gap-1 items-center">
            <FileText size={15} aria-hidden="true" />
            Source PDF · page {dish.source_page}
          </span>
        )}
        <span>
          {dish.updated_at === SOURCE_TIMESTAMP ? (
            "Original reference · not synced"
          ) : (
            <>
              Updated{" "}
              <time dateTime={dish.updated_at}>
                {new Date(dish.updated_at)
                  .toISOString()
                  .slice(0, 16)
                  .replace("T", " ")}{" "}
                UTC
              </time>
            </>
          )}
        </span>
      </footer>
    </article>
  );
}
