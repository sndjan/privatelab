"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setInventoryQuantity } from "./actions";

export function QuantityStepper({ id, name, quantity: saved }: { id: string; name: string; quantity: number }) {
  const [quantity, setQuantity] = useOptimistic(saved);
  const [, startTransition] = useTransition();

  function change(next: number) {
    if (next < 0 || next > 999) return;
    startTransition(async () => {
      setQuantity(next);
      await setInventoryQuantity(id, next);
    });
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        aria-label={`${name}: einer weniger`}
        disabled={quantity === 0}
        onClick={() => change(quantity - 1)}
      >
        <MinusIcon />
      </Button>
      <span aria-live="polite" className="w-8 text-center font-mono">
        {quantity}
      </span>
      <Button variant="outline" size="icon" aria-label={`${name}: einer mehr`} onClick={() => change(quantity + 1)}>
        <PlusIcon />
      </Button>
    </div>
  );
}
