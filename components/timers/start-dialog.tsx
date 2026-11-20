"use client";
import { useState } from "react";
import { Dialog } from "@/components/dialog";
import { useTimerSettings, useTimers } from "./provider";
import { timerStore } from "@/lib/timers/store";
import { enableTimerSound } from "@/lib/timers/sound";
import { formatTimer } from "@/lib/timers/model";
export function StartTimerDialog({
  dish,
  onClose,
}: {
  dish: { id: string; name: string };
  onClose: () => void;
}) {
  const { config } = useTimerSettings();
  const state = useTimers();
  const setting = config.settings.find((s) => s.dish_id === dish.id);
  const preset = config.presets.find(
    (p) => p.id === setting?.preset_id && p.enabled,
  );
  const defaultDuration =
    setting?.default_duration_seconds ?? preset?.duration_seconds;
  const [minutes, setMinutes] = useState(() =>
    defaultDuration ? String(Math.floor(defaultDuration / 60)) : "",
  );
  const [seconds, setSeconds] = useState(() =>
    defaultDuration ? String(defaultDuration % 60) : "",
  );
  const [error, setError] = useState("");
  return (
    <Dialog title="Start Timer" onClose={onClose}>
      <form
        className="p-5 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            if (!setting?.timer_enabled)
              throw new Error("Timers are no longer enabled for this dish.");
            const duration = Number(minutes) * 60 + Number(seconds);
            void enableTimerSound();
            timerStore.start(dish.name.slice(0, 100), duration, dish.id);
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not start timer.");
          }
        }}
      >
        <h3 className="font-semibold text-xl">{dish.name}</h3>
        {setting?.default_duration_seconds ? (
          <p className="text-sm text-stone-600">
            Default duration:{" "}
            {formatTimer(setting.default_duration_seconds * 1000)}
          </p>
        ) : preset ? (
          <p className="text-sm text-stone-600">
            Preset: {preset.label} ·{" "}
            {formatTimer(preset.duration_seconds * 1000)}
          </p>
        ) : (
          <p className="text-sm text-stone-600">
            Enter the duration for this timer.
          </p>
        )}
        <div className="grid grid-cols-2 gap-4">
          <label className="field">
            Minutes
            <input
              type="number"
              min="0"
              max="1440"
              step="1"
              inputMode="numeric"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </label>
          <label className="field">
            Seconds
            <input
              type="number"
              min="0"
              max="59"
              step="1"
              inputMode="numeric"
              value={seconds}
              onChange={(e) => setSeconds(e.target.value)}
            />
          </label>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary w-full" disabled={!state.ready}>
          Start Timer
        </button>
      </form>
    </Dialog>
  );
}
