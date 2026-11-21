import { z } from "zod";
import { storedDishSchema } from "@/lib/dishes";
export const bookSchema = z.object({
  dishes: z.array(storedDishSchema).max(5000),
  favorites: z.array(z.string()).max(5000),
  hidden: z.array(z.string()).max(5000),
});
export type OfflineBook = z.infer<typeof bookSchema>;
export type SavedRecord<T> = {
  version: 1;
  savedAt: number;
  data: T;
  revision?: string | null;
};
let opening: Promise<IDBDatabase> | undefined;
function database() {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("kitchen-prep-offline", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("snapshots");
    req.onsuccess = () => {
      req.result.onversionchange = () => {
        req.result.close();
        opening = undefined;
      };
      resolve(req.result);
    };
    req.onerror = () => {
      opening = undefined;
      reject(req.error);
    };
    req.onblocked = () => {
      opening = undefined;
      reject(new Error("Offline storage is blocked."));
    };
  });
  return opening;
}
export async function readRecord<T>(
  key: string,
  schema: z.ZodType<T>,
): Promise<SavedRecord<T> | null> {
  const db = await database();
  const raw = await new Promise<unknown>((resolve, reject) => {
    const req = db.transaction("snapshots").objectStore("snapshots").get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (!raw) return null;
  const parsed = z
    .object({
      version: z.literal(1),
      savedAt: z.number().int().nonnegative(),
      data: schema,
      revision: z.string().nullable().optional(),
    })
    .safeParse(raw);
  return parsed.success ? parsed.data : null;
}
export async function saveRecord<T>(
  key: string,
  data: T,
  revision?: string | null,
): Promise<SavedRecord<T>> {
  const record: SavedRecord<T> = {
    version: 1,
    savedAt: Date.now(),
    data,
    ...(revision !== undefined ? { revision } : {}),
  };
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("snapshots", "readwrite");
    tx.objectStore("snapshots").put(record, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  return record;
}
