"use client";
import Link from "next/link";
import { TAB_LEAVING_EVENT } from "@/lib/navigation/tabs";
import { useOffline, OfflineStatus } from "./offline/provider";
import { useEffect, useRef, useState } from "react";
import {
  Menu,
  X,
  Search,
  Star,
  BookOpen,
  Plus,
  EyeOff,
  DatabaseBackup,
  RefreshCw,
  Timer,
} from "lucide-react";
type View = "lookup" | "favorites" | "practice";
export function BookMenu({
  view,
  hiddenCount,
  showHidden,
  busy,
  onView,
  onAdd,
  onHidden,
  onBackup,
  onSync,
}: {
  view: View;
  hiddenCount: number;
  showHidden: boolean;
  busy: boolean;
  onView: (view: View) => void;
  onAdd: () => void;
  onHidden: () => void;
  onBackup: () => void;
  onSync: () => void;
}) {
  const { offline } = useOffline();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    }
    const closeMenu = () => setOpen(false);
    window.addEventListener(TAB_LEAVING_EVENT, closeMenu);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener(TAB_LEAVING_EVENT, closeMenu);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  function choose(action: () => void) {
    setOpen(false);
    action();
  }
  return (
    <div ref={container} className="relative">
      <button
        ref={toggle}
        className="button small"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="book-menu"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <X size={19} aria-hidden="true" />
        ) : (
          <Menu size={19} aria-hidden="true" />
        )}
        Menu
      </button>
      <nav
        id="book-menu"
        aria-label="Menu options"
        hidden={!open}
        className="book-menu"
      >
        <button
          className="navitem"
          aria-current={view === "lookup" && !showHidden ? "page" : undefined}
          onClick={() => choose(() => onView("lookup"))}
        >
          <Search size={18} />
          All dishes
        </button>
        <button
          className="navitem"
          aria-current={view === "favorites" ? "page" : undefined}
          onClick={() => choose(() => onView("favorites"))}
        >
          <Star size={18} />
          Favorites
        </button>
        <button
          className="navitem"
          aria-current={view === "practice" ? "page" : undefined}
          onClick={() => choose(() => onView("practice"))}
        >
          <BookOpen size={18} />
          Practice
        </button>
        <Link
          prefetch={true}
          className="navitem"
          href="/timers"
          onClick={() => setOpen(false)}
        >
          <Timer size={18} />
          Timers
        </Link>
        <div className="my-2 border-t border-[var(--line)]" />
        <button
          className="navitem"
          disabled={offline}
          onClick={() => choose(onAdd)}
        >
          <Plus size={18} />
          Add dish
        </button>
        <button className="navitem" onClick={() => choose(onHidden)}>
          <EyeOff size={18} />
          {showHidden
            ? "Back to dishes"
            : "Hidden dishes (" + hiddenCount + ")"}
        </button>
        <button
          className="navitem"
          disabled={offline}
          onClick={() => choose(onBackup)}
        >
          <DatabaseBackup size={18} />
          Backup and restore
        </button>
        <button
          className="navitem"
          disabled={busy || offline}
          onClick={() => choose(onSync)}
        >
          <RefreshCw size={18} />
          {busy ? "Syncing…" : "Sync"}
        </button>
        <OfflineStatus />
      </nav>
    </div>
  );
}
