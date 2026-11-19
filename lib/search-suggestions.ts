import { matches, type Dish } from "./dishes";
export function suggestDishes(dishes: Dish[], query: string, limit = 5) {
  const text = query.trim().toLowerCase();
  if (!text) return [];
  const terms = text.split(/\s+/);
  function rank(dish: Dish) {
    const name = dish.name.toLowerCase();
    return name === text
      ? 0
      : name.startsWith(text)
        ? 1
        : terms.every((term) => name.includes(term))
          ? 2
          : 3;
  }
  return dishes
    .filter((dish) => matches(dish, text))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
    .slice(0, limit);
}
