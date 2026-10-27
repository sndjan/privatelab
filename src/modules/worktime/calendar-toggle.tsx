"use client";

import { useOptimistic, useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { setVacationInCalendar } from "./actions";

// "Im Kalender" checkbox of a vacation block, saved right away.
export function CalendarToggle({ id, inCalendar, label }: { id: string; inCalendar: boolean; label: string }) {
  const [checked, setChecked] = useOptimistic(inCalendar);
  const [, startTransition] = useTransition();

  return (
    <Checkbox
      checked={checked}
      aria-label={label}
      onCheckedChange={(value) =>
        startTransition(async () => {
          setChecked(value === true);
          await setVacationInCalendar(id, value === true);
        })
      }
      className="size-5"
    />
  );
}
