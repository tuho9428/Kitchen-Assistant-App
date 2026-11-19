import source from "@/data/dishes.json";
import { seedRows, type Dish } from "./dishes";
export const SOURCE_TIMESTAMP = "1970-01-01T00:00:00.000Z";
export function originalCatalog(): Dish[] {
  return seedRows(source)
    .map((d) => ({
      ...d,
      created_at: SOURCE_TIMESTAMP,
      updated_at: SOURCE_TIMESTAMP,
      updated_by: null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
