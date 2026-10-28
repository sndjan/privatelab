"use client";

import { useOptimistic, useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { setTodoDone } from "./actions";

// Done checkbox of a to-do, saved right away.
export function TodoToggle({ id, done, label }: { id: string; done: boolean; label: string }) {
  const [checked, setChecked] = useOptimistic(done);
  const [, startTransition] = useTransition();

  return (
    <Checkbox
      checked={checked}
      aria-label={label}
      onCheckedChange={(value) =>
        startTransition(async () => {
          setChecked(value === true);
          await setTodoDone(id, value === true);
        })
      }
      className="size-5"
    />
  );
}
