"use client";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { Clock3, Search, X } from "lucide-react";
import {
  clearRecentSearches,
  readRecentSearches,
  rememberSearch,
} from "@/lib/recent-searches";
import { suggestDishes } from "@/lib/search-suggestions";
import type { Dish } from "@/lib/dishes";
export function SearchBox({
  value,
  onChange,
  onRecentSelect,
  inputRef,
  dishes,
  onDishSelect,
}: {
  value: string;
  onChange: (value: string) => void;
  onRecentSelect: (value: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  dishes: Dish[];
  onDishSelect: (dish: Dish) => void;
}) {
  const [terms, setTerms] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const typed = value.trim().length > 0;
  const suggestions = suggestDishes(dishes, value);
  const count = typed ? suggestions.length : terms.length;
  const shown = open && count > 0;
  useEffect(() => {
    if (!shown) return;
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [shown]);
  function focus() {
    setTerms(readRecentSearches());
    setOpen(true);
  }
  function close() {
    inputRef.current?.focus();
    setOpen(false);
  }
  function chooseRecent(term: string) {
    setTerms(rememberSearch(term));
    onRecentSelect(term);
    close();
  }
  function chooseDish(dish: Dish) {
    setTerms(rememberSearch(dish.name));
    close();
    onDishSelect(dish);
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      buttons.current[Math.min(index + 1, count - 1)]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (index === 0) inputRef.current?.focus();
      else buttons.current[index - 1]?.focus();
    }
  }
  return (
    <div
      ref={root}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <div className="searchfield">
        <Search size={22} aria-hidden="true" />
        <input
          ref={inputRef}
          aria-label="Search dishes or ingredients"
          aria-autocomplete="list"
          aria-controls={shown ? "search-picks" : undefined}
          placeholder="Search a dish or ingredient…"
          value={value}
          maxLength={200}
          onFocus={focus}
          onClick={() => {
            if (!shown) focus();
          }}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          autoComplete="off"
          enterKeyHint="search"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              setTerms(rememberSearch(value));
              setOpen(false);
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
            }
            if (e.key === "ArrowDown" && count) {
              e.preventDefault();
              setOpen(true);
              requestAnimationFrame(() => buttons.current[0]?.focus());
            }
          }}
        />
        {value && (
          <button
            className="iconbutton"
            aria-label="Clear search"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
              focus();
            }}
          >
            <X size={20} />
          </button>
        )}
      </div>
      {shown && (
        <section
          id="search-picks"
          className="recent-searches"
          aria-label={typed ? "Suggested dishes" : "Recent searches"}
        >
          <header className="flex items-center justify-between gap-3 px-3">
            <h2 className="text-sm font-semibold text-stone-600">
              {typed ? "Suggested dishes" : "Recent searches"}
            </h2>
            {typed ? (
              <button
                className="iconbutton"
                aria-label="Close suggestions"
                onClick={close}
              >
                <X size={18} />
              </button>
            ) : (
              <button
                className="textbutton text-sm"
                aria-label="Clear search history"
                onClick={() => {
                  clearRecentSearches();
                  setTerms([]);
                  close();
                }}
              >
                Clear
              </button>
            )}
          </header>
          <ul className="pb-1">
            {typed
              ? suggestions.map((dish, index) => (
                  <li key={dish.id}>
                    <button
                      ref={(el) => {
                        buttons.current[index] = el;
                      }}
                      className="recent-search"
                      aria-label={"Open prep for " + dish.name}
                      onClick={() => chooseDish(dish)}
                      onKeyDown={(e) => navigate(e, index)}
                    >
                      <Search
                        size={17}
                        className="shrink-0 text-stone-500"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 text-left">
                        <span className="block font-semibold break-words">
                          {dish.name}
                        </span>
                        <span className="block text-sm text-stone-600">
                          {dish.category}
                        </span>
                      </span>
                    </button>
                  </li>
                ))
              : terms.map((term, index) => (
                  <li key={term.toLowerCase()}>
                    <button
                      ref={(el) => {
                        buttons.current[index] = el;
                      }}
                      className="recent-search"
                      aria-label={"Search again: " + term}
                      onClick={() => chooseRecent(term)}
                      onKeyDown={(e) => navigate(e, index)}
                    >
                      <Clock3
                        size={17}
                        className="shrink-0 text-stone-500"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 break-words text-left">
                        {term}
                      </span>
                    </button>
                  </li>
                ))}
          </ul>
        </section>
      )}
    </div>
  );
}
