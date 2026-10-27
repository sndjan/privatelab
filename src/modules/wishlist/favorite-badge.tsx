import { HeartIcon } from "lucide-react";

// Marks a Herzenswunsch with a word, not just an icon, so guests who don't
// know the page understand it.
export function FavoriteBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-600 dark:text-rose-400">
      <HeartIcon aria-hidden="true" className="size-3 fill-current" /> Herzenswunsch
    </span>
  );
}
