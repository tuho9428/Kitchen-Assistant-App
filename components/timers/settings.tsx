"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useOffline } from "@/components/offline/provider";
import { Pencil, Trash2 } from "lucide-react";
import {
  TIMER_CONFIG_CHANGE_KEY,
  type TimerPreset,
  type DishTimerSetting,
} from "@/lib/timers/config";
import { presetId } from "@/lib/timers/ids";
import { formatTimer } from "@/lib/timers/model";
import {
  saveTimerPreset,
  deleteTimerPreset,
  saveDishTimerSetting,
} from "@/lib/timers/actions";
type Setting = DishTimerSetting & { updated_at: string };
export function TimerSettings({
  initialPresets,
  initialSettings,
  dishes,
}: {
  initialPresets: TimerPreset[];
  initialSettings: Setting[];
  dishes: { id: string; name: string; category: string }[];
}) {
  const router = useRouter();
  const { offline } = useOffline();
  const [presets, setPresets] = useState(initialPresets);
  const [settings, setSettings] = useState(initialSettings);
  const [draftId, setDraftId] = useState(presetId);
  const [editing, setEditing] = useState<TimerPreset | null>(null);
  const [label, setLabel] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [dishId, setDishId] = useState(dishes[0]?.id ?? "");
  const current = settings.find((s) => s.dish_id === dishId);
  const [dishEnabled, setDishEnabled] = useState(
    current?.timer_enabled ?? false,
  );
  const [selectedPreset, setSelectedPreset] = useState(
    current?.preset_id ?? "",
  );
  const [durationMode, setDurationMode] = useState<
    "none" | "preset" | "duration"
  >(() =>
    current?.default_duration_seconds != null
      ? "duration"
      : current?.preset_id
        ? "preset"
        : "none",
  );
  const [defaultMinutes, setDefaultMinutes] = useState(() =>
    current?.default_duration_seconds != null
      ? String(Math.floor(current.default_duration_seconds / 60))
      : "",
  );
  const [defaultSeconds, setDefaultSeconds] = useState(() =>
    current?.default_duration_seconds != null
      ? String(current.default_duration_seconds % 60)
      : "",
  );
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const presetDirty = editing
    ? label !== editing.label ||
      Number(minutes) * 60 + Number(seconds) !== editing.duration_seconds ||
      enabled !== editing.enabled
    : !!label || !!minutes || !!seconds || !enabled;
  const dishDirty =
    dishEnabled !== (current?.timer_enabled ?? false) ||
    durationMode !==
      (current?.default_duration_seconds != null
        ? "duration"
        : current?.preset_id
          ? "preset"
          : "none") ||
    (durationMode === "preset" &&
      selectedPreset !== (current?.preset_id ?? "")) ||
    (durationMode === "duration" &&
      Number(defaultMinutes) * 60 + Number(defaultSeconds) !==
        current?.default_duration_seconds);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (presetDirty || dishDirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [presetDirty, dishDirty]);
  function notify() {
    try {
      localStorage.setItem(TIMER_CONFIG_CHANGE_KEY, presetId());
    } catch {}
    window.dispatchEvent(new Event("kitchen-timer-config-changed"));
  }
  async function run(action: () => Promise<void>) {
    if (!navigator.onLine) {
      setError("Connect to the internet to change shared timer settings.");
      return;
    }
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save settings.");
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  function reset() {
    setEditing(null);
    setDraftId(presetId());
    setLabel("");
    setMinutes("");
    setSeconds("");
    setEnabled(true);
  }
  function edit(preset: TimerPreset) {
    if (presetDirty && !window.confirm("Discard your unsaved preset changes?"))
      return;
    setEditing(preset);
    setDraftId(preset.id);
    setLabel(preset.label);
    setMinutes(String(Math.floor(preset.duration_seconds / 60)));
    setSeconds(String(preset.duration_seconds % 60));
    setEnabled(preset.enabled);
  }
  return (
    <main id="main" className="mx-auto max-w-3xl p-4 md:p-6">
      <header className="flex items-center justify-between gap-3 mb-5">
        <div>
          <Link href="/timers" className="textbutton text-sm">
            Back to timers
          </Link>
          <h1 className="text-2xl font-semibold">Timer settings</h1>
        </div>
      </header>
      <p className="text-sm text-stone-600 mb-5">
        Everyone can manage these shared settings. Durations are entered
        manually; prep notes never create timer durations.
      </p>
      {error && (
        <p role="alert" className="error mb-4">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="notice mb-4">
          {message}
        </p>
      )}
      <form
        className="paper p-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const r = await saveTimerPreset(
              {
                id: draftId,
                label,
                duration_seconds: Number(minutes) * 60 + Number(seconds),
                enabled,
              },
              editing?.updated_at ?? null,
            );
            if (!r.ok) throw new Error(r.error);
            setPresets((old) =>
              [...old.filter((p) => p.id !== r.data.id), r.data].sort((a, b) =>
                a.label.localeCompare(b.label),
              ),
            );
            reset();
            notify();
            setMessage("Preset saved.");
          });
        }}
      >
        <h2 className="font-semibold text-lg">
          {editing ? "Edit preset" : "New preset"}
        </h2>
        <fieldset disabled={pending || offline} className="space-y-4">
          <label className="field">
            Preset name
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              maxLength={100}
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="field">
              Preset minutes
              <input
                type="number"
                min="0"
                max="1440"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                inputMode="numeric"
              />
            </label>
            <label className="field">
              Preset seconds
              <input
                type="number"
                min="0"
                max="59"
                value={seconds}
                onChange={(e) => setSeconds(e.target.value)}
                inputMode="numeric"
              />
            </label>
          </div>
          <label className="flex gap-3 items-center min-h-11">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Preset available to everyone
          </label>
          <div className="flex gap-3">
            <button className="button primary">
              {pending ? "Saving…" : "Save preset"}
            </button>
            {editing && (
              <button
                type="button"
                className="button"
                onClick={() => {
                  if (
                    !presetDirty ||
                    window.confirm("Discard your unsaved preset changes?")
                  )
                    reset();
                }}
              >
                Cancel edit
              </button>
            )}
          </div>
        </fieldset>
      </form>
      <section aria-label="Saved timer presets" className="my-5 space-y-2">
        {presets.length === 0 ? (
          <p className="text-sm text-stone-600">No presets yet.</p>
        ) : (
          presets.map((p) => (
            <article
              key={p.id}
              className="paper p-3 flex gap-3 items-center justify-between"
            >
              <div className="min-w-0">
                <h3 className="font-semibold break-words">{p.label}</h3>
                <p className="text-sm text-stone-600">
                  {formatTimer(p.duration_seconds * 1000)} ·{" "}
                  {p.enabled ? "Enabled" : "Disabled"}
                </p>
              </div>
              <div className="flex">
                <button
                  className="iconbutton"
                  disabled={pending || offline}
                  aria-label={"Edit preset " + p.label}
                  onClick={() => edit(p)}
                >
                  <Pencil size={18} />
                </button>
                <button
                  className="iconbutton"
                  disabled={pending || offline}
                  aria-label={"Delete preset " + p.label}
                  onClick={() => {
                    if (
                      !window.confirm(
                        "Delete this reusable preset? Assigned dishes will require a custom duration.",
                      )
                    )
                      return;
                    void run(async () => {
                      const r = await deleteTimerPreset(p.id, p.updated_at);
                      if (!r.ok) throw new Error(r.error);
                      setPresets((old) => old.filter((v) => v.id !== p.id));
                      setSettings(r.data);
                      if (selectedPreset === p.id) {
                        setSelectedPreset("");
                        if (durationMode === "preset") setDurationMode("none");
                      }
                      if (editing?.id === p.id) reset();
                      notify();
                      setMessage(
                        "Preset deleted. Assigned dishes now use custom durations.",
                      );
                      router.refresh();
                    });
                  }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </article>
          ))
        )}
      </section>
      <form
        className="paper p-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const duration =
              durationMode === "duration"
                ? Number(defaultMinutes) * 60 + Number(defaultSeconds)
                : null;
            if (durationMode === "preset" && !selectedPreset)
              throw new Error("Choose a saved preset.");
            if (
              duration !== null &&
              (!Number.isInteger(duration) || duration < 1 || duration > 86400)
            )
              throw new Error(
                "Enter a default duration between 1 second and 24 hours.",
              );
            const r = await saveDishTimerSetting(
              {
                dish_id: dishId,
                timer_enabled: dishEnabled,
                preset_id:
                  durationMode === "preset" ? selectedPreset || null : null,
                default_duration_seconds: duration,
              },
              current?.updated_at ?? null,
            );
            if (!r.ok) throw new Error(r.error);
            setSettings((old) => [
              ...old.filter((s) => s.dish_id !== dishId),
              r.data,
            ]);
            setSelectedPreset(r.data.preset_id ?? "");
            setDurationMode(
              r.data.default_duration_seconds != null
                ? "duration"
                : r.data.preset_id
                  ? "preset"
                  : "none",
            );
            setDefaultMinutes(
              r.data.default_duration_seconds != null
                ? String(Math.floor(r.data.default_duration_seconds / 60))
                : "",
            );
            setDefaultSeconds(
              r.data.default_duration_seconds != null
                ? String(r.data.default_duration_seconds % 60)
                : "",
            );
            notify();
            setMessage("Dish timer setting saved.");
          });
        }}
      >
        <h2 className="font-semibold text-lg">Dish timers</h2>
        <fieldset
          disabled={pending || offline || dishes.length === 0}
          className="space-y-4"
        >
          <label className="field">
            Dish
            <select
              className="timer-select"
              aria-label="Dish"
              value={dishId}
              onChange={(e) => {
                if (
                  dishDirty &&
                  !window.confirm("Discard your unsaved dish timer changes?")
                )
                  return;
                const id = e.target.value;
                const s = settings.find((s) => s.dish_id === id);
                setDishId(id);
                setDishEnabled(s?.timer_enabled ?? false);
                setSelectedPreset(s?.preset_id ?? "");
                setDurationMode(
                  s?.default_duration_seconds != null
                    ? "duration"
                    : s?.preset_id
                      ? "preset"
                      : "none",
                );
                setDefaultMinutes(
                  s?.default_duration_seconds != null
                    ? String(Math.floor(s.default_duration_seconds / 60))
                    : "",
                );
                setDefaultSeconds(
                  s?.default_duration_seconds != null
                    ? String(s.default_duration_seconds % 60)
                    : "",
                );
              }}
            >
              {dishes.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · {d.category}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3 min-h-11">
            <input
              type="checkbox"
              checked={dishEnabled}
              onChange={(e) => setDishEnabled(e.target.checked)}
            />
            Enable Start Timer for this dish
          </label>
          {dishEnabled && (
            <fieldset className="space-y-3">
              <legend className="font-semibold mb-2">
                Default preset (optional)
              </legend>
              <label className="flex items-center gap-3 min-h-11">
                <input
                  type="radio"
                  name="dish-default-mode"
                  checked={durationMode === "none"}
                  onChange={() => setDurationMode("none")}
                />
                Enter a duration each time
              </label>
              <label className="flex items-center gap-3 min-h-11">
                <input
                  type="radio"
                  name="dish-default-mode"
                  checked={durationMode === "preset"}
                  onChange={() => setDurationMode("preset")}
                />
                Use a saved preset
              </label>
              {durationMode === "preset" && (
                <div className="pl-7">
                  <label className="field">
                    Default preset (optional)
                    <select
                      className="timer-select"
                      aria-label="Default preset (optional)"
                      value={selectedPreset}
                      onChange={(e) => setSelectedPreset(e.target.value)}
                    >
                      <option value="">Choose a saved preset</option>
                      {presets.map((p) => (
                        <option key={p.id} value={p.id} disabled={!p.enabled}>
                          {p.label} · {formatTimer(p.duration_seconds * 1000)}
                          {p.enabled ? "" : " (disabled)"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              <label className="flex items-center gap-3 min-h-11">
                <input
                  type="radio"
                  name="dish-default-mode"
                  checked={durationMode === "duration"}
                  onChange={() => setDurationMode("duration")}
                />
                Set a default duration for this dish
              </label>
              {durationMode === "duration" && (
                <div className="grid grid-cols-2 gap-4 pl-7">
                  <label className="field">
                    Default minutes
                    <input
                      type="number"
                      min="0"
                      max="1440"
                      step="1"
                      inputMode="numeric"
                      value={defaultMinutes}
                      onChange={(e) => setDefaultMinutes(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Default seconds
                    <input
                      type="number"
                      min="0"
                      max="59"
                      step="1"
                      inputMode="numeric"
                      value={defaultSeconds}
                      onChange={(e) => setDefaultSeconds(e.target.value)}
                    />
                  </label>
                  <p className="text-sm text-stone-600 col-span-2">
                    Saved for this dish. Shared presets stay unchanged.
                  </p>
                </div>
              )}
            </fieldset>
          )}
          <button className="button primary">
            {pending ? "Saving…" : "Save dish timer"}
          </button>
        </fieldset>
      </form>
    </main>
  );
}
