"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChefHat,
  Pencil,
  Search,
  Shuffle,
  Star,
  Trash2,
} from "lucide-react";
import { deleteDish, favorite, loadData, setDishHidden } from "@/lib/actions";
import { matches, type Dish } from "@/lib/dishes";
import { Prep } from "./prep";
import { DishCard } from "./dish-card";
import { BookMenu } from "./book-menu";
import { SearchBox } from "./search-box";
import { rememberSearch } from "@/lib/recent-searches";
import { Dialog } from "./dialog";
import { Editor } from "./editor";
import { Backup } from "./backup";
type Data = { dishes: Dish[]; favorites: string[]; hidden: string[] };
type View = "lookup" | "favorites" | "practice";
export function Kitchen({
  initial,
  initialError,
}: {
  initial: Data | null;
  initialError: string;
}) {
  const [data, setData] = useState<Data>(
    initial ?? { dishes: [], favorites: [], hidden: [] },
  );
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<View>("lookup");
  const [query, setQuery] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<Dish | null>(null);
  const [editing, setEditing] = useState<{ dish: Dish | null } | null>(null);
  const [backup, setBackup] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteExpected, setDeleteExpected] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [practice, setPractice] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const refresh = useCallback(async () => {
    try {
      const r = await loadData();
      if (!r.ok) setError(r.error);
      else {
        setData(r.data as Data);
        setError("");
      }
    } catch {
      setError(
        "Unable to sync. Your current dishes are still available. Check your connection and retry.",
      );
    }
  }, []);
  useEffect(() => {
    function focus() {
      void refresh();
    }
    window.addEventListener("focus", focus);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30000);
    return () => {
      window.removeEventListener("focus", focus);
      clearInterval(timer);
    };
  }, [refresh]);
  const categories = [...new Set(data.dishes.map((d) => d.category))].sort();
  const hiddenDishIds = new Set(data.hidden ?? []);
  const filtered = data.dishes.filter(
    (d) =>
      (showHidden ? hiddenDishIds.has(d.id) : !hiddenDishIds.has(d.id)) &&
      (category === "All" || d.category === category) &&
      matches(d, query) &&
      (view !== "favorites" || data.favorites.includes(d.id)),
  );
  async function toggleDishHidden(dish: Dish) {
    await perform(async () => {
      const hidden = !hiddenDishIds.has(dish.id);
      const result = await setDishHidden(dish.id, hidden);
      if (!result.ok) throw new Error(result.error);
      setData((old) => ({
        ...old,
        hidden: hidden
          ? [...(old.hidden ?? []).filter((id) => id !== dish.id), dish.id]
          : (old.hidden ?? []).filter((id) => id !== dish.id),
      }));
      setNotice(
        hidden
          ? "Dish hidden. Its data is kept."
          : "Dish restored to the list.",
      );
    });
  }
  const practiceDish = data.dishes.find(
    (d) => d.id === practice && !hiddenDishIds.has(d.id),
  );
  function nextPractice() {
    const choices = data.dishes.filter(
      (d) => d.id !== practice && !hiddenDishIds.has(d.id),
    );
    const pool = choices.length
      ? choices
      : data.dishes.filter((d) => !hiddenDishIds.has(d.id));
    const random = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
    setPractice(pool[Math.floor(random * pool.length)]?.id ?? null);
    setRevealed(false);
  }
  function changeView(v: View) {
    setView(v);
    setShowHidden(false);
    setCategory("All");
    setQuery("");
    if (v === "practice") nextPractice();
    else requestAnimationFrame(() => search.current?.focus());
  }
  async function perform(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Network request failed. Please retry.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const current = selected
    ? (data.dishes.find((d) => d.id === selected.id) ?? selected)
    : null;
  async function toggleFavorite(d: Dish) {
    await perform(async () => {
      const on = !data.favorites.includes(d.id);
      const r = await favorite(d.id, on);
      if (!r.ok) throw new Error(r.error);
      setData((old) => ({
        ...old,
        favorites: on
          ? [...old.favorites, d.id]
          : old.favorites.filter((id) => id !== d.id),
      }));
      setNotice(on ? "Added to favorites." : "Removed from favorites.");
    });
  }
  return (
    <div className="min-h-dvh pb-4">
      <header className="brandbar prep-header">
        <span className="brandicon">
          <ChefHat size={21} aria-hidden="true" />
        </span>
        <span className="font-bold tracking-tight text-lg">Kitchen Prep</span>
        <div className="ml-auto">
          <BookMenu
            view={view}
            hiddenCount={hiddenDishIds.size}
            showHidden={showHidden}
            busy={busy}
            onView={changeView}
            onAdd={() => setEditing({ dish: null })}
            onHidden={() => {
              setShowHidden(!showHidden);
              setView("lookup");
              setCategory("All");
              setQuery("");
            }}
            onBackup={() => setBackup(true)}
            onSync={() => {
              void perform(refresh);
            }}
          />
        </div>
      </header>
      <div className="mx-auto w-full max-w-[1440px] px-3 md:px-5">
        <main id="main" className="min-w-0">
          <h1 className="sr-only">
            {view === "practice"
              ? "Practice"
              : showHidden
                ? "Hidden dishes"
                : view === "favorites"
                  ? "Favorites"
                  : "All dishes"}
          </h1>
          {error && (
            <div className="error mt-5" role="alert">
              <p>{error}</p>
              <button
                className="button small mt-3"
                disabled={busy}
                onClick={() => perform(refresh)}
              >
                Retry sync
              </button>
            </div>
          )}
          {notice && (
            <p className="sr-only" role="status">
              {notice}
            </p>
          )}
          {view !== "practice" ? (
            <>
              <div className="searchdock">
                <SearchBox
                  dishes={filtered}
                  onDishSelect={(dish) => {
                    setQuery(dish.name);
                    setSelected(dish);
                    setDeleting(false);
                  }}
                  value={query}
                  onChange={setQuery}
                  inputRef={search}
                  onRecentSelect={(term) => {
                    setQuery(term);
                    setCategory("All");
                    setShowHidden(false);
                    setView("lookup");
                  }}
                />
                <div className="categories" aria-label="Filter by category">
                  {["All", ...categories].map((c) => (
                    <button
                      key={c}
                      aria-pressed={category === c}
                      className={`category ${category === c ? "selected" : ""}`}
                      onClick={() => setCategory(c)}
                    >
                      {c === "All" ? "All dishes" : c}
                    </button>
                  ))}
                </div>
              </div>
              <p role="status" className="text-sm text-stone-600 py-2">
                {showHidden
                  ? "Hidden · "
                  : view === "favorites"
                    ? "Favorites · "
                    : ""}
                {filtered.length} {filtered.length === 1 ? "dish" : "dishes"}
              </p>
              {filtered.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
                  {filtered.map((d) => (
                    <DishCard
                      key={d.id}
                      dish={d}
                      favorite={data.favorites.includes(d.id)}
                      busy={busy}
                      hidden={hiddenDishIds.has(d.id)}
                      onOpen={() => {
                        rememberSearch(query);
                        setSelected(d);
                        setDeleting(false);
                      }}
                      onFavorite={() => {
                        void toggleFavorite(d);
                      }}
                      onToggleHidden={() => {
                        void toggleDishHidden(d);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <section className="empty">
                  <Search
                    size={29}
                    className="text-stone-500 mx-auto mb-4"
                    aria-hidden="true"
                  />
                  <h2 className="text-xl font-semibold">
                    {showHidden
                      ? "No hidden dishes"
                      : data.dishes.length === 0
                        ? "Your prep book is ready for its dishes"
                        : view === "favorites" && !query
                          ? "Keep your regulars close"
                          : "No dishes match yet"}
                  </h2>
                  <p className="text-stone-600 mt-3 max-w-md mx-auto">
                    {showHidden
                      ? "Hidden dishes stay saved here. Restore a dish to put it back in the list."
                      : data.dishes.length === 0
                        ? "Add a dish to start the shared prep book."
                        : view === "favorites" && !query
                          ? "Tap the star on a dish to save it here."
                          : "Try a shorter search, another ingredient, or a different category."}
                  </p>
                  {(query || category !== "All") && (
                    <button
                      className="button mt-5"
                      onClick={() => {
                        setQuery("");
                        setCategory("All");
                        search.current?.focus();
                      }}
                    >
                      Clear filters
                    </button>
                  )}
                </section>
              )}
            </>
          ) : (
            <section className="paper p-6 md:p-8 mt-8">
              <div className="flex justify-between items-center mb-7">
                <span className="eyebrow">Recall, then reveal</span>
                <BookOpen
                  className="text-stone-500"
                  size={23}
                  aria-hidden="true"
                />
              </div>
              {practiceDish ? (
                <>
                  <p className="text-stone-600 mb-2">{practiceDish.category}</p>
                  <h2 className="text-3xl font-semibold tracking-tight">
                    {practiceDish.name}
                  </h2>
                  <p className="mt-4 text-stone-600">
                    Which ingredients would you hand to the chef?
                  </p>
                  {revealed && (
                    <div className="mt-8">
                      <Prep dish={practiceDish} compact />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3 mt-8">
                    <button
                      className="button primary"
                      onClick={() => setRevealed(!revealed)}
                    >
                      {revealed ? "Hide ingredients" : "Reveal ingredients"}
                    </button>
                    <button className="button" onClick={nextPractice}>
                      <Shuffle size={18} />
                      Another dish
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-semibold">
                    No dishes to practice yet
                  </h2>
                  <p className="text-stone-600 mt-3">
                    Once the prep book has dishes, you can practice here.
                  </p>
                </>
              )}
            </section>
          )}
        </main>
      </div>
      {current && !editing && (
        <Dialog
          busy={busy}
          title="Dish preparation"
          onClose={() => {
            if (!busy) {
              setSelected(null);
              setDeleting(false);
              setDeleteConfirm("");
            }
          }}
        >
          <div className="p-5 md:p-7">
            <Prep dish={current} />
            <div className="flex flex-wrap gap-3 mt-7">
              <button
                className="button"
                disabled={busy}
                onClick={() => toggleFavorite(current)}
              >
                <Star size={18} />
                {data.favorites.includes(current.id)
                  ? "Remove favorite"
                  : "Save favorite"}
              </button>
              <Link className="button" href={`/dishes/${current.id}`}>
                Open dish page
              </Link>
              {
                <>
                  <button
                    className="button"
                    onClick={() => {
                      setEditing({ dish: current });
                      setSelected(null);
                    }}
                  >
                    <Pencil size={18} />
                    Edit
                  </button>
                  <button
                    className="button danger"
                    disabled={busy}
                    onClick={() => {
                      setDeleting(true);
                      setDeleteExpected(current.updated_at);
                      setDeleteConfirm("");
                    }}
                  >
                    <Trash2 size={18} />
                    Delete
                  </button>
                </>
              }
            </div>
            {deleting && (
              <div className="notice mt-5">
                <h3 className="font-semibold">Delete {current.name}?</h3>
                <p className="text-sm mt-2">
                  This permanently removes the dish and its favorites. Export a
                  backup first if you may need it.
                </p>
                <label className="field mt-4">
                  Type the dish name to confirm
                  <input
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    autoComplete="off"
                  />
                </label>
                <div className="flex gap-3 mt-4">
                  <button
                    className="button danger"
                    disabled={busy || deleteConfirm !== current.name}
                    onClick={() =>
                      perform(async () => {
                        const r = await deleteDish(current.id, deleteExpected);
                        if (!r.ok) throw new Error(r.error);
                        setData((old) => ({
                          ...old,
                          dishes: old.dishes.filter((d) => d.id !== current.id),
                          favorites: old.favorites.filter(
                            (id) => id !== current.id,
                          ),
                        }));
                        setSelected(null);
                        setDeleting(false);
                        setNotice("Dish deleted.");
                        await refresh();
                      })
                    }
                  >
                    {busy ? "Deleting…" : "Delete permanently"}
                  </button>
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => setDeleting(false)}
                  >
                    Keep dish
                  </button>
                </div>
              </div>
            )}
            {error && (
              <p className="error mt-5" role="alert">
                {error}
              </p>
            )}
          </div>
        </Dialog>
      )}
      {editing && (
        <Editor
          dish={editing.dish}
          onClose={() => setEditing(null)}
          onSaved={(d) => {
            setData((old) => ({
              ...old,
              dishes: [...old.dishes.filter((v) => v.id !== d.id), d].sort(
                (a, b) => a.name.localeCompare(b.name),
              ),
            }));
            setEditing(null);
            setSelected(d);
            setNotice("Dish saved.");
            void refresh();
          }}
        />
      )}
      {backup && (
        <Backup
          dishes={data.dishes}
          onClose={() => setBackup(false)}
          onImported={refresh}
        />
      )}
    </div>
  );
}
