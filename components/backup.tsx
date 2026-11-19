"use client";
import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Dialog } from "./dialog";
import { Prep } from "./prep";
import { backupSchema, previewImport, type Dish } from "@/lib/dishes";
import { exportBackup, importBackup } from "@/lib/actions";
export function Backup({
  dishes,
  onClose,
  onImported,
}: {
  dishes: Dish[];
  onClose: () => void;
  onImported: () => Promise<void>;
}) {
  const [backup, setBackup] = useState<ReturnType<
    typeof backupSchema.parse
  > | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [baseline, setBaseline] = useState(dishes);
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const preview = backup ? previewImport(baseline, backup.dishes) : [];
  async function run(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Connection failed. Try again.",
      );
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <Dialog
      busy={pending}
      title="Backup & restore"
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <div className="p-5 md:p-7 space-y-6">
        <section>
          <h3 className="font-semibold text-lg">
            Keep a copy of the prep book
          </h3>
          <p className="text-stone-600 my-3">
            Export every dish, ingredient group and note as a versioned JSON
            backup.
          </p>
          <button
            className="button"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const r = await exportBackup();
                if (!r.ok) throw new Error(r.error);
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify(r.data, null, 2)], {
                    type: "application/json",
                  }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = `kitchen-prep-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                setMessage("Backup exported.");
              })
            }
          >
            <Download size={18} />
            Export JSON
          </button>
        </section>
        <section className="border-t border-[var(--line)] pt-6">
          <h3 className="font-semibold text-lg">Restore from a backup</h3>
          <p className="text-stone-600 my-3">
            Choose a Kitchen Prep JSON export. Preview changes before applying.
            Dishes absent from the backup are kept.
          </p>
          <label className="field">
            Backup file
            <input
              type="file"
              accept=".json,application/json"
              disabled={pending}
              onChange={async (e) => {
                setError("");
                setBackup(null);
                setOverwrite(false);
                setMessage("");
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  if (file.size > 750000)
                    throw new Error(
                      "Backup is larger than 750 KB. Split it into smaller versioned backups.",
                    );
                  setBackup(backupSchema.parse(JSON.parse(await file.text())));
                  setBaseline(dishes);
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "Invalid backup",
                  );
                }
              }}
            />
          </label>
        </section>
        {backup && (
          <section>
            <h3 className="font-semibold">Import preview</h3>
            <p className="text-sm text-stone-600 mt-2">
              Open a dish below to review its full contents. This preview stays
              fixed while you review it.
            </p>
            <button
              type="button"
              className="button small mt-3"
              disabled={pending}
              onClick={() => {
                setBaseline(dishes);
                setOverwrite(false);
                setError("");
              }}
            >
              Refresh preview
            </button>
            <p className="text-stone-600 mt-2">
              {preview.filter((v) => v.status === "new").length} new ·{" "}
              {preview.filter((v) => v.status === "changed").length} changed ·{" "}
              {preview.filter((v) => v.status === "unchanged").length} unchanged
            </p>
            <div className="max-h-64 overflow-y-auto my-4 border border-[var(--line)] rounded-lg">
              {preview.map((v) => (
                <details
                  key={v.dish.id}
                  className="p-3 text-sm border-b border-[var(--line)] last:border-b-0"
                >
                  <summary className="cursor-pointer min-h-11 py-3">
                    <span className="break-words">{v.dish.name}</span>
                    <span className="font-semibold ml-3">{v.status}</span>
                  </summary>
                  <div className="space-y-6 py-4">
                    {v.status === "changed" && (
                      <section>
                        <h4 className="font-semibold mb-3">Current prep</h4>
                        <Prep
                          dish={baseline.find((d) => d.id === v.dish.id)!}
                          compact
                        />
                      </section>
                    )}
                    <section>
                      <h4 className="font-semibold mb-3">
                        {v.status === "unchanged"
                          ? "Unchanged prep"
                          : "Backup prep to import"}
                      </h4>
                      <Prep dish={v.dish} compact />
                    </section>
                  </div>
                </details>
              ))}
            </div>
            <label className="flex gap-3 items-start text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={overwrite}
                disabled={pending}
                onChange={(e) => setOverwrite(e.target.checked)}
              />
              <span>
                Replace existing dishes with changed backup contents. I have
                reviewed the changes above.
              </span>
            </label>
            <p className="text-sm text-stone-600 mt-3">
              By default, only new IDs are added. Restored content receives a
              new update timestamp and is attributed to your account.
            </p>
            <button
              className="button primary mt-5"
              disabled={
                pending ||
                preview.every((v) => v.status === "unchanged") ||
                (!overwrite && !preview.some((v) => v.status === "new"))
              }
              onClick={() =>
                run(async () => {
                  const selected = preview.filter(
                    (v) =>
                      v.status === "new" ||
                      (overwrite && v.status === "changed"),
                  );
                  const r = await importBackup(
                    { ...backup, dishes: selected.map((v) => v.dish) },
                    Object.fromEntries(
                      selected.map((v) => [v.dish.id, v.expected]),
                    ),
                    overwrite,
                  );
                  if (!r.ok) throw new Error(r.error);
                  setBackup(null);
                  setOverwrite(false);
                  setMessage(
                    `Imported ${r.data} ${r.data === 1 ? "dish" : "dishes"}.`,
                  );
                  await onImported();
                })
              }
            >
              <Upload size={18} />
              {pending
                ? "Applying…"
                : overwrite
                  ? "Apply reviewed changes"
                  : "Import new dishes only"}
            </button>
          </section>
        )}
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="text-sm text-stone-600">
          Imports apply in one transaction. If a dish changed since preview, the
          whole import stops so you can review again.
        </p>
      </div>
    </Dialog>
  );
}
