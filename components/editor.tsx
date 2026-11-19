"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog } from "./dialog";
import { dishSchema, inputOf, type Dish, type DishInput } from "@/lib/dishes";
import { saveDish } from "@/lib/actions";
export function Editor({
  dish,
  onClose,
  onSaved,
}: {
  dish: Dish | null;
  onClose: () => void;
  onSaved: (dish: Dish) => void;
}) {
  const [draft, setDraft] = useState<DishInput>(() =>
    dish
      ? inputOf(dish)
      : {
          id:
            typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : "dish-" +
                Array.from(crypto.getRandomValues(new Uint32Array(4)), (v) =>
                  v.toString(36),
                ).join("-"),
          name: "",
          category: "",
          groups: [{ label: "", size: "", ingredients: [""] }],
          notes: [],
          source_page: null,
        },
  );
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [discard, setDiscard] = useState(false);
  const [baseline] = useState(() => JSON.stringify(draft));
  const dirty = JSON.stringify(draft) !== baseline;
  useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function close() {
    if (pending) return;
    if (dirty) setDiscard(true);
    else onClose();
  }
  function group(
    index: number,
    key: "label" | "size" | "ingredients",
    value: string | string[],
  ) {
    setDraft((d) => ({
      ...d,
      groups: d.groups.map((g, i) =>
        i === index ? { ...g, [key]: value } : g,
      ),
    }));
  }
  return (
    <Dialog
      busy={pending}
      title={dish ? "Edit dish" : "Add dish"}
      onClose={close}
    >
      <form
        className="p-5 md:p-7"
        onSubmit={async (e) => {
          e.preventDefault();
          if (lock.current) return;
          const parsed = dishSchema.safeParse(draft);
          if (!parsed.success) {
            setError(
              parsed.error.issues
                .map((v) => `${v.path.join(".")}: ${v.message}`)
                .join("; "),
            );
            return;
          }
          lock.current = true;
          setPending(true);
          setError("");
          try {
            const r = await saveDish(parsed.data, dish?.updated_at ?? null);
            if (!r.ok) setError(r.error);
            else onSaved(r.data as Dish);
          } catch {
            setError(
              "Connection lost. Your draft is still here. Try saving again.",
            );
          } finally {
            lock.current = false;
            setPending(false);
          }
        }}
      >
        <fieldset disabled={pending} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-5">
            <label className="field">
              Dish name
              <input
                required
                maxLength={200}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label className="field">
              Category
              <input
                required
                maxLength={100}
                value={draft.category}
                onChange={(e) =>
                  setDraft({ ...draft, category: e.target.value })
                }
              />
            </label>
          </div>
          <p className="text-sm text-stone-600">
            Keep quantities and preparation wording exactly as intended. S, M,
            L, Bowl and Kit describe preparation groups.
          </p>
          {draft.groups.map((g, i) => (
            <section className="prepgroup p-4 space-y-4" key={i}>
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Ingredient group {i + 1}</h3>
                <button
                  type="button"
                  className="iconbutton"
                  aria-label={`Remove group ${i + 1}`}
                  onClick={() => {
                    if (
                      window.confirm("Remove this group and its ingredients?")
                    )
                      setDraft({
                        ...draft,
                        groups: draft.groups.filter((_, j) => j !== i),
                      });
                  }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <div className="grid grid-cols-[1fr_100px] gap-3">
                <label className="field">
                  Group label (optional)
                  <input
                    value={g.label ?? ""}
                    maxLength={100}
                    onChange={(e) => group(i, "label", e.target.value)}
                  />
                </label>
                <label className="field">
                  Group size
                  <input
                    value={g.size}
                    maxLength={100}
                    placeholder="e.g. Bowl"
                    onChange={(e) => group(i, "size", e.target.value)}
                  />
                </label>
              </div>
              <div className="space-y-3">
                {g.ingredients.map((v, j) => (
                  <div className="flex gap-2 items-end" key={j}>
                    <label className="field flex-1 min-w-0">
                      Ingredient {j + 1} · include quantity
                      <textarea
                        rows={2}
                        required
                        maxLength={2000}
                        value={v}
                        onChange={(e) =>
                          group(
                            i,
                            "ingredients",
                            g.ingredients.map((s, k) =>
                              j === k ? e.target.value : s,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      className="iconbutton"
                      type="button"
                      aria-label={`Remove ingredient ${j + 1} from group ${i + 1}`}
                      disabled={g.ingredients.length === 1}
                      onClick={() => {
                        if (window.confirm("Remove this ingredient?"))
                          group(
                            i,
                            "ingredients",
                            g.ingredients.filter((_, k) => k !== j),
                          );
                      }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="button small"
                onClick={() => group(i, "ingredients", [...g.ingredients, ""])}
              >
                <Plus size={16} />
                Add ingredient
              </button>
            </section>
          ))}
          <button
            type="button"
            className="button"
            onClick={() =>
              setDraft({
                ...draft,
                groups: [
                  ...draft.groups,
                  { label: "", size: "", ingredients: [""] },
                ],
              })
            }
          >
            <Plus size={18} />
            Add group
          </button>
          <section className="space-y-3">
            <h3 className="font-semibold">Preparation notes</h3>
            {draft.notes.map((n, i) => (
              <div className="flex gap-2 items-end" key={i}>
                <label className="field flex-1 min-w-0">
                  Note {i + 1}
                  <textarea
                    required
                    rows={2}
                    maxLength={2000}
                    value={n}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        notes: draft.notes.map((v, j) =>
                          j === i ? e.target.value : v,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  className="iconbutton"
                  type="button"
                  aria-label={`Remove note ${i + 1}`}
                  onClick={() => {
                    if (window.confirm("Remove this preparation note?"))
                      setDraft({
                        ...draft,
                        notes: draft.notes.filter((_, j) => j !== i),
                      });
                  }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="button small"
              onClick={() =>
                setDraft({ ...draft, notes: [...draft.notes, ""] })
              }
            >
              <Plus size={16} />
              Add note
            </button>
          </section>
          <label className="field max-w-56">
            Source PDF page (optional)
            <input
              type="number"
              min={1}
              value={draft.source_page ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  source_page: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </label>
        </fieldset>
        {error && (
          <p className="error mt-5" role="alert">
            {error}
          </p>
        )}
        {discard && (
          <div className="notice mt-5" role="alert">
            <p>Discard your unsaved changes?</p>
            <div className="flex gap-3 mt-3">
              <button type="button" className="button danger" onClick={onClose}>
                Discard changes
              </button>
              <button
                type="button"
                className="button"
                onClick={() => setDiscard(false)}
              >
                Keep editing
              </button>
            </div>
          </div>
        )}
        <div className="flex justify-end gap-3 pt-6">
          <button
            type="button"
            className="button"
            disabled={pending}
            onClick={close}
          >
            Cancel
          </button>
          <button className="button primary" disabled={pending}>
            {pending ? "Saving…" : "Save dish"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
