"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { switchTab } from "@/lib/navigation/tabs";
import { isCurrentConfigRecord } from "@/lib/timers/config-cache";
import {
  TIMER_CONFIG_CHANGE_KEY,
  timerConfigSchema,
} from "@/lib/timers/config";
import {
  bookSchema,
  readRecord,
  saveRecord,
  type OfflineBook,
  type SavedRecord,
} from "@/lib/offline/storage";
const Context = createContext({
  offline: false,
  cachedBook: null as SavedRecord<OfflineBook> | null,
  loaded: false,
  ready: false,
  storageError: "",
  saveBook: async (book: OfflineBook) => {
    void book;
  },
});
export const useOffline = () => useContext(Context);
export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [offline, setOffline] = useState(false);
  const [cachedBook, setCachedBook] = useState<SavedRecord<OfflineBook> | null>(
    null,
  );
  const [loaded, setLoaded] = useState(false);
  const [shellReady, setShellReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [configReady, setConfigReady] = useState(false);
  const saveBook = useCallback(async (book: OfflineBook) => {
    try {
      const record = await saveRecord("book", bookSchema.parse(book));
      setCachedBook(record);
      setStorageError("");
    } catch {
      setStorageError(
        "This browser could not save the prep book for offline use.",
      );
    }
  }, []);
  useEffect(() => {
    let active = true;
    const connectivity = () => {
      setOffline(!navigator.onLine);
      if (navigator.onLine && "serviceWorker" in navigator)
        void navigator.serviceWorker
          .getRegistration()
          .then((reg) =>
            reg?.active?.postMessage({ type: "PREPARE_KITCHEN_OFFLINE" }),
          )
          .catch(() => {});
    };
    const configSaved = () => setConfigReady(true);
    const configChanged = () => setConfigReady(false);
    const revisionChanged = (event: StorageEvent) => {
      if (event.key === TIMER_CONFIG_CHANGE_KEY) configChanged();
    };
    window.addEventListener("kitchen-timer-config-changed", configChanged);
    window.addEventListener("storage", revisionChanged);
    window.addEventListener("kitchen-offline-config-saved", configSaved);
    void readRecord("timer-config", timerConfigSchema)
      .then((record) => {
        if (active) setConfigReady(!!record && isCurrentConfigRecord(record));
      })
      .catch(() => {});
    const initial = setTimeout(connectivity, 0);
    window.addEventListener("online", connectivity);
    window.addEventListener("offline", connectivity);
    void readRecord("book", bookSchema)
      .then((book) => {
        if (active) setCachedBook(book);
      })
      .catch(() => {
        if (active)
          setStorageError("Offline storage is unavailable in this browser.");
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    const navigate = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const a = (event.target as Element).closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        !a ||
        a.target ||
        a.download ||
        a.origin !== location.origin ||
        (a.pathname === location.pathname && a.hash)
      )
        return;
      const mainTab = a.pathname === "/" || a.pathname === "/timers";
      const canSwitchLocally =
        mainTab &&
        (!navigator.onLine ||
          Array.from(document.querySelectorAll("[data-kitchen-tabs]")).some(
            (element) => element.getClientRects().length > 0,
          ));
      if (canSwitchLocally) {
        event.preventDefault();
        event.stopPropagation();
        switchTab(new URL(a.href));
        return;
      }
      if (!navigator.onLine) {
        event.preventDefault();
        event.stopPropagation();
        location.assign(a.href);
      }
    };
    document.addEventListener("click", navigate, true);
    const message = (event: MessageEvent) => {
      if (event.data?.type === "KITCHEN_OFFLINE_READY" && active)
        setShellReady(true);
    };
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.addEventListener("message", message);
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then(() => navigator.serviceWorker.ready)
        .then((reg) => {
          reg.active?.postMessage({ type: "PREPARE_KITCHEN_OFFLINE" });
        })
        .catch(() => {
          if (active)
            setStorageError(
              "Offline pages could not be saved. Reconnect and reload to retry.",
            );
        });
    }
    return () => {
      active = false;
      clearTimeout(initial);
      window.removeEventListener("kitchen-offline-config-saved", configSaved);
      window.removeEventListener("kitchen-timer-config-changed", configChanged);
      window.removeEventListener("storage", revisionChanged);
      window.removeEventListener("online", connectivity);
      window.removeEventListener("offline", connectivity);
      document.removeEventListener("click", navigate, true);
      navigator.serviceWorker?.removeEventListener("message", message);
    };
  }, []);
  const value = useMemo(
    () => ({
      offline,
      cachedBook,
      loaded,
      ready: shellReady && !!cachedBook && configReady,
      storageError,
      saveBook,
    }),
    [
      offline,
      cachedBook,
      loaded,
      shellReady,
      configReady,
      storageError,
      saveBook,
    ],
  );
  return (
    <Context.Provider value={value}>
      {offline && (
        <div role="status" className="offline-notice">
          Offline · Lookup and timers available. Changes need internet.
          <span className="block text-xs">
            {cachedBook
              ? "Last sync: " + new Date(cachedBook.savedAt).toLocaleString()
              : "No saved prep book on this device."}
          </span>
        </div>
      )}
      {children}
    </Context.Provider>
  );
}
export function OfflineStatus() {
  const { ready, cachedBook, storageError } = useOffline();
  return (
    <p className="px-3 py-2 text-xs text-stone-600" role="status">
      {storageError || (ready ? "Offline ready" : "Preparing offline copy…")}
      {cachedBook && (
        <span className="block">
          Last sync: {new Date(cachedBook.savedAt).toLocaleString()}
        </span>
      )}
    </p>
  );
}
