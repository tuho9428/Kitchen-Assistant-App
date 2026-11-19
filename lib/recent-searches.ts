export const RECENT_SEARCH_KEY = "kitchen-prep:recent-searches:v1";
export const RECENT_SEARCH_LIMIT = 6;
export function cleanSearch(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 200);
}
export function recentTerms(value: unknown): string[] {
  if (
    !value ||
    typeof value !== "object" ||
    !("version" in value) ||
    value.version !== 1 ||
    !("terms" in value) ||
    !Array.isArray(value.terms)
  )
    return [];
  const result: string[] = [];
  for (const item of value.terms) {
    if (typeof item !== "string") continue;
    const term = cleanSearch(item);
    if (term && !result.some((v) => v.toLowerCase() === term.toLowerCase()))
      result.push(term);
    if (result.length === RECENT_SEARCH_LIMIT) break;
  }
  return result;
}
export function addRecent(terms: string[], query: string) {
  const term = cleanSearch(query);
  if (!term) return terms;
  return [
    term,
    ...terms.filter((v) => v.toLowerCase() !== term.toLowerCase()),
  ].slice(0, RECENT_SEARCH_LIMIT);
}
export function readRecentSearches() {
  try {
    return recentTerms(
      JSON.parse(localStorage.getItem(RECENT_SEARCH_KEY) ?? "null"),
    );
  } catch {
    return [];
  }
}
export function rememberSearch(query: string) {
  const terms = addRecent(readRecentSearches(), query);
  try {
    localStorage.setItem(
      RECENT_SEARCH_KEY,
      JSON.stringify({ version: 1, terms }),
    );
  } catch {
    /* Search remains usable when browser storage is unavailable. */
  }
  return terms;
}
export function clearRecentSearches() {
  try {
    localStorage.removeItem(RECENT_SEARCH_KEY);
  } catch {
    /* Browser storage may be blocked. */
  }
}
