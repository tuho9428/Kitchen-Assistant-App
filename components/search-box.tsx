"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Clock3, Search, X } from "lucide-react";
import {
  clearRecentSearches,
  readRecentSearches,
  rememberSearch,
} from "@/lib/recent-searches";
export function SearchBox({
  value,
  onChange,
  onRecentSelect,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onRecentSelect: (value: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const [terms, setTerms] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const shown = open && terms.length > 0;
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
  function choose(term: string) {
    setTerms(rememberSearch(term));
    onRecentSelect(term);
    close();
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
          placeholder="Search a dish or ingredient…"
          value={value}
          maxLength={200}
          onFocus={focus}
          onClick={() => {
            if (!shown) focus();
          }}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(false);
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
            if (e.key === "ArrowDown" && terms.length) {
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
        <section className="recent-searches" aria-label="Recent searches">
          <header className="flex items-center justify-between gap-3 px-3">
            <h2 className="text-sm font-semibold text-stone-600">
              Recent searches
            </h2>
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
          </header>
          <ul className="pb-1">
            {terms.map((term, index) => (
              <li key={term.toLowerCase()}>
                <button
                  ref={(el) => {
                    buttons.current[index] = el;
                  }}
                  className="recent-search"
                  aria-label={"Search again: " + term}
                  onClick={() => choose(term)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      close();
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      buttons.current[
                        Math.min(index + 1, terms.length - 1)
                      ]?.focus();
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      if (index === 0) inputRef.current?.focus();
                      else buttons.current[index - 1]?.focus();
                    }
                  }}
                >
                  <Clock3
                    size={17}
                    className="shrink-0 text-stone-500"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 break-words text-left">{term}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
