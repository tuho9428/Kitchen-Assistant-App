"use client";
import { Timer } from "lucide-react";
import { useTimerSettings } from "./provider";
export function DishTimerButton({
  dish,
}: {
  dish: { id: string; name: string };
}) {
  const { config, openDish } = useTimerSettings();
  if (
    !config.settings.some(
      (s) => s.dish_id === dish.id && s.timer_enabled === true,
    )
  )
    return null;
  return (
    <button
      className="button small mt-3"
      aria-label={"Start Timer for " + dish.name}
      onClick={() => openDish(dish)}
    >
      <Timer size={17} />
      Start Timer
    </button>
  );
}
