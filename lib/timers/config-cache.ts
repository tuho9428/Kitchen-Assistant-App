import { TIMER_CONFIG_CHANGE_KEY } from "./config";
export function configRevision(): string | null | undefined {
  try {
    return localStorage.getItem(TIMER_CONFIG_CHANGE_KEY);
  } catch {
    return undefined;
  }
}
export function isCurrentConfigRecord(record: { revision?: string | null }) {
  const revision = configRevision();
  return revision !== undefined && (record.revision ?? null) === revision;
}
