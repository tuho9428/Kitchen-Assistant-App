"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Timer,
  Pause,
  Play,
  X,
  BellRing,
  Volume2,
  Settings,
} from "lucide-react";
import { useTimers, useTimerSettings } from "./provider";
import { timerStore } from "@/lib/timers/store";
import { remainingTime, formatTimer } from "@/lib/timers/model";
import { enableTimerSound, playTimerSound } from "@/lib/timers/sound";
export function TimersPage() {
  const state = useTimers();
  const { config, error: configError } = useTimerSettings();
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [error, setError] = useState("");
  const [soundMessage, setSoundMessage] = useState("");
  function start(label: string, duration: number) {
    try {
      setError("");
      void enableTimerSound();
      timerStore.start(label, duration);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start timer.");
      return false;
    }
  }
  return (
    <main id="main" className="mx-auto max-w-3xl p-4 md:p-6">
      <header className="flex items-center justify-between gap-3 mb-5">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Timer size={25} />
          Timers
        </h1>
        <Link href="/timers/settings" className="button small">
          <Settings size={17} />
          Timer settings
        </Link>
      </header>
      <form
        className="paper p-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (
            start(
              name.trim() || "Custom timer",
              Number(minutes) * 60 + Number(seconds),
            )
          ) {
            setName("");
            setMinutes("");
            setSeconds("");
          }
        }}
      >
        <h2 className="font-semibold">Custom timer</h2>
        <label className="field">
          Timer name (optional)
          <input
            maxLength={100}
            value={name}
            placeholder="e.g. Rice"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
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
        <button className="button primary w-full" disabled={!state.ready}>
          Start custom timer
        </button>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3 my-4">
        <button
          className="button small"
          onClick={async () => {
            if (await enableTimerSound()) {
              playTimerSound();
              setSoundMessage("Alarm sound enabled.");
            } else
              setSoundMessage(
                "Sound is unavailable. Your timers will still show when ready.",
              );
          }}
        >
          <Volume2 size={17} />
          {state.soundReady ? "Test sound" : "Enable sound"}
        </button>
        {state.timers.some((t) => t.status === "finished") && (
          <button
            className="textbutton text-sm"
            onClick={() => timerStore.clearFinished()}
          >
            Clear finished
          </button>
        )}
      </div>
      {soundMessage && (
        <p className="text-sm text-stone-600 mb-3" role="status">
          {soundMessage}
        </p>
      )}
      {state.storageError && (
        <p className="error mb-4" role="alert">
          {state.storageError}
        </p>
      )}
      <section aria-label="Running timers" className="space-y-3">
        {state.timers.length === 0 ? (
          <p className="py-6 text-center text-stone-600">No timers yet.</p>
        ) : (
          state.timers.map((timer) => (
            <article
              key={timer.id}
              className={
                "paper p-4 " +
                (timer.status === "finished" && !timer.acknowledged
                  ? "timer-alarm"
                  : "")
              }
              aria-label={timer.label + " timer"}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold text-lg break-words">
                    {timer.label}
                  </h2>
                  <p className="text-sm text-stone-600">
                    {timer.status === "finished"
                      ? "Time’s up"
                      : timer.status === "paused"
                        ? "Paused"
                        : "Running"}
                  </p>
                </div>
                <p
                  className="text-3xl font-semibold tabular-nums shrink-0"
                  aria-label={"Time remaining for " + timer.label}
                >
                  {formatTimer(remainingTime(timer, state.now))}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {timer.status === "running" && (
                  <button
                    className="button small"
                    aria-label={"Pause " + timer.label}
                    onClick={() => timerStore.pause(timer.id)}
                  >
                    <Pause size={17} />
                    Pause
                  </button>
                )}
                {timer.status === "paused" && (
                  <button
                    className="button small"
                    aria-label={"Resume " + timer.label}
                    onClick={() => {
                      void enableTimerSound();
                      timerStore.resume(timer.id);
                    }}
                  >
                    <Play size={17} />
                    Resume
                  </button>
                )}
                {timer.status === "finished" && !timer.acknowledged && (
                  <button
                    className="button small primary"
                    aria-label={"Silence " + timer.label}
                    onClick={() => timerStore.acknowledge(timer.id)}
                  >
                    <BellRing size={17} />
                    Silence
                  </button>
                )}
                <button
                  className="button small"
                  aria-label={
                    (timer.status === "finished" ? "Dismiss " : "Cancel ") +
                    timer.label
                  }
                  onClick={() => timerStore.cancel(timer.id)}
                >
                  <X size={17} />
                  {timer.status === "finished" ? "Dismiss" : "Cancel"}
                </button>
              </div>
            </article>
          ))
        )}
      </section>
      <section className="mt-7">
        <h2 className="font-semibold mb-3">Shared presets</h2>
        {configError && <p className="notice mb-3">{configError}</p>}
        {!config.configured ? (
          <p className="text-sm text-stone-600">
            Shared presets are not connected yet. Custom timers work without
            them.
          </p>
        ) : config.presets.filter((p) => p.enabled).length === 0 ? (
          <p className="text-sm text-stone-600">No shared presets yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {config.presets
              .filter((p) => p.enabled)
              .map((p) => (
                <button
                  key={p.id}
                  className="button justify-between"
                  disabled={!state.ready}
                  onClick={() => start(p.label, p.duration_seconds)}
                >
                  <span className="break-words text-left">{p.label}</span>
                  <span className="tabular-nums shrink-0">
                    {formatTimer(p.duration_seconds * 1000)}
                  </span>
                </button>
              ))}
          </div>
        )}
      </section>
      <p className="text-sm text-stone-600 mt-6">
        Timers stay on this browser. Keep the app open for sound alarms; a
        suspended or closed browser may delay sound.
      </p>
    </main>
  );
}
