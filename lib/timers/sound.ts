import { timerStore } from "./store";
let context: AudioContext | null = null;
let buffer: AudioBuffer | null = null;
let loading: Promise<AudioBuffer> | null = null;
let playing: AudioBufferSourceNode | null = null;
let playingAlarm = false;
async function loadSound(audio: AudioContext) {
  if (buffer) return buffer;
  loading ??= fetch("/sounds/sounds_1.mp3")
    .then(async (response) => {
      if (!response.ok) throw new Error("Alarm sound could not load.");
      return audio.decodeAudioData(await response.arrayBuffer());
    })
    .catch((error) => {
      loading = null;
      throw error;
    });
  buffer = await loading;
  return buffer;
}
let lastAlarm = 0;
const owner =
  typeof crypto !== "undefined"
    ? Array.from(crypto.getRandomValues(new Uint32Array(2))).join("-")
    : "tab";
export async function enableTimerSound() {
  try {
    const Audio =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Audio) return false;
    context ??= new Audio();
    context.onstatechange = () =>
      timerStore.setSoundReady(context?.state === "running" && buffer !== null);
    await context.resume();
    await loadSound(context);
    const ready = context.state === "running";
    timerStore.setSoundReady(ready);
    return ready;
  } catch {
    timerStore.setSoundReady(false);
    return false;
  }
}
export function stopTimerSound() {
  const source = playing;
  playing = null;
  playingAlarm = false;
  if (source) {
    try {
      source.stop();
    } catch {}
    source.disconnect();
  }
}
export function playTimerSound(alarm = false) {
  if (!context || context.state !== "running" || !buffer) return false;
  // Let the complete MP3 play before repeating an alarm.
  if (alarm && playing) return false;
  stopTimerSound();
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.onended = () => {
    source.disconnect();
    if (playing === source) {
      playing = null;
      playingAlarm = false;
    }
  };
  playing = source;
  playingAlarm = alarm;
  source.start();
  return true;
}
export async function alarmTick() {
  const pending = timerStore
    .getSnapshot()
    .timers.some((t) => t.status === "finished" && !t.acknowledged);
  if (!pending) {
    if (playingAlarm) stopTimerSound();
    lastAlarm = 0;
    return;
  }
  if (!context || context.state !== "running" || Date.now() - lastAlarm < 2400)
    return;
  const claim = () => {
    try {
      const now = Date.now();
      const raw = localStorage.getItem("kitchen-prep:timer-alarm-owner");
      const lease = raw ? JSON.parse(raw) : null;
      if (lease && lease.owner !== owner && lease.until > now) return;
      localStorage.setItem(
        "kitchen-prep:timer-alarm-owner",
        JSON.stringify({ owner, until: now + 3000 }),
      );
    } catch {
      /* Sound still works if persistence is unavailable. */
    }
    if (playTimerSound(true)) lastAlarm = Date.now();
  };
  if (navigator.locks)
    await navigator.locks.request(
      "kitchen-prep-timer-alarm",
      { ifAvailable: true },
      (lock) => {
        if (lock) claim();
      },
    );
  else claim();
}
