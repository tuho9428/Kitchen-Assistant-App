import { z } from "zod";

// Text is deliberately not normalized: source quantities and wording must survive round trips.
const text = z
  .string()
  .min(1)
  .max(2000)
  .refine((v) => v.trim().length > 0, "Cannot be blank");
export const groupSchema = z
  .object({
    label: z.string().max(100).optional(),
    size: z.string().max(100),
    ingredients: z.array(text).min(1).max(100),
  })
  .strict();
export const dishSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[\w-]+$/, "Use letters, numbers, underscores or hyphens"),
    name: text.max(200),
    category: text.max(100),
    groups: z.array(groupSchema).max(30),
    notes: z.array(text).max(100),
    source_page: z.number().int().positive().nullable(),
  })
  .strict();
export type DishInput = z.infer<typeof dishSchema>;
export type Dish = DishInput & {
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};
export const storedDishSchema = dishSchema
  .extend({
    created_at: z.iso.datetime({ offset: true }),
    updated_at: z.iso.datetime({ offset: true }),
    updated_by: z.uuid().nullable(),
  })
  .strict();
export const backupSchema = z
  .object({
    version: z.literal(1),
    exported_at: z.iso.datetime(),
    dishes: z.array(storedDishSchema).max(2000),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (new Set(v.dishes.map((d) => d.id)).size !== v.dishes.length)
      ctx.addIssue({ code: "custom", message: "Duplicate dish IDs" });
  });
export function inputOf(d: Dish | DishInput): DishInput {
  return {
    id: d.id,
    name: d.name,
    category: d.category,
    groups: d.groups,
    notes: d.notes,
    source_page: d.source_page,
  };
}
export function matches(d: DishInput, query: string) {
  const haystack = [
    d.name,
    d.category,
    ...d.groups.flatMap((g) => [g.label ?? "", g.size, ...g.ingredients]),
    ...d.notes,
  ]
    .join(" ")
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}
export function previewImport(current: Dish[], incoming: Dish[]) {
  return incoming.map((d) => {
    const old = current.find((c) => c.id === d.id);
    return {
      dish: d,
      status: !old
        ? ("new" as const)
        : JSON.stringify(inputOf(old)) === JSON.stringify(inputOf(d))
          ? ("unchanged" as const)
          : ("changed" as const),
      expected: old?.updated_at ?? null,
    };
  });
}
export function seedRows(value: unknown) {
  const source = z
    .array(
      dishSchema
        .omit({ source_page: true })
        .extend({ sourcePage: z.number().int().positive().nullable() }),
    )
    .length(56)
    .parse(value);
  const rows = source.map(({ sourcePage, ...dish }) => ({
    ...dish,
    source_page: sourcePage,
  }));
  if (new Set(rows.map((d) => d.id)).size !== 56)
    throw new Error("Seed must contain 56 unique IDs");
  return rows;
}
