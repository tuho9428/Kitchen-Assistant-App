"use client";
import { ChevronRight, Eye, EyeOff, Star } from "lucide-react";
import type { Dish } from "@/lib/dishes";
import { DishTimerButton } from "./timers/dish-timer-button";
export function DishCard({
  dish,
  favorite,
  busy,
  hidden,
  onOpen,
  onFavorite,
  onToggleHidden,
}: {
  dish: Dish;
  favorite: boolean;
  busy: boolean;
  hidden: boolean;
  onOpen: () => void;
  onFavorite: () => void;
  onToggleHidden: () => void;
}) {
  return (
    <article className="dishcard" aria-labelledby={"card-" + dish.id}>
      <div className="flex gap-3 justify-between items-start">
        <button className="text-left min-w-0 flex-1" onClick={onOpen}>
          <span className="eyebrow text-xs">{dish.category}</span>
          <h2
            id={"card-" + dish.id}
            className="text-xl font-semibold tracking-tight mt-1 break-words"
          >
            {dish.name}
          </h2>
        </button>
        <button
          className={"iconbutton " + (favorite ? "isfavorite" : "")}
          aria-label={(favorite ? "Unfavorite " : "Favorite ") + dish.name}
          aria-pressed={favorite}
          disabled={busy}
          onClick={onFavorite}
        >
          <Star size={21} fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>
      <div id={"items-" + dish.id} className="mt-2 space-y-1.5">
        {dish.groups.map((group, index) => (
          <section
            key={index}
            aria-label={"Prep group " + (index + 1) + " for " + dish.name}
            className="rounded-lg border border-[var(--line)] px-3 py-2"
          >
            <header className="flex justify-between items-center gap-3">
              <h3 className="text-sm font-semibold min-w-0 break-words">
                {group.label || "Prep group " + (index + 1)}
              </h3>
              {group.size && (
                <span className="smallsize shrink-0 max-w-1/2">
                  {group.size}
                </span>
              )}
            </header>
            {
              <ul className="mt-3 space-y-2">
                {group.ingredients.map((item, i) => (
                  <li
                    key={i}
                    className="flex gap-3 items-baseline text-[17px] leading-relaxed"
                  >
                    <span className="ingredient-marker" aria-hidden="true" />
                    <span className="min-w-0 whitespace-pre-wrap break-words">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            }
          </section>
        ))}
        {dish.notes.length > 0 && (
          <section className="rounded-lg bg-[var(--soft)] px-3 py-2">
            <h3 className="font-semibold text-sm">Prep notes</h3>
            <ul className="mt-2 space-y-2">
              {dish.notes.map((note, i) => (
                <li
                  key={i}
                  className="whitespace-pre-wrap break-words leading-relaxed"
                >
                  {note}
                </li>
              ))}
            </ul>
          </section>
        )}
        {dish.groups.length === 0 && (
          <p className="text-sm text-stone-600">
            No ingredient groups recorded.
          </p>
        )}
      </div>
      <DishTimerButton dish={dish} />
      <footer className="flex items-center justify-between gap-3 border-t border-[var(--line)] mt-3 pt-1">
        <button
          className="textbutton text-sm text-stone-600"
          aria-label={(hidden ? "Restore " : "Hide ") + dish.name}
          disabled={busy}
          onClick={onToggleHidden}
        >
          {hidden ? (
            <Eye size={16} aria-hidden="true" />
          ) : (
            <EyeOff size={16} aria-hidden="true" />
          )}
          {hidden ? "Restore dish" : "Hide dish"}
        </button>
        <button
          className="textbutton text-sm font-semibold"
          onClick={onOpen}
          aria-label={"View prep for " + dish.name}
        >
          View prep
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </footer>
    </article>
  );
}
