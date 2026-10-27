"use client";

import { Loader2Icon } from "lucide-react";
import { Children, isValidElement, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Submit button for forms with a server action. While the action runs, every
// submit button in the form is disabled and the one that was pressed shows a
// spinner in place of its content (keeping its size, so nothing jumps).
export function SubmitButton({ children, className, disabled, onClick, ...props }: React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  const [pressed, setPressed] = useState(false);
  const [wasPending, setWasPending] = useState(pending);
  if (pending !== wasPending) {
    setWasPending(pending);
    if (!pending) setPressed(false);
  }
  const busy = pending && pressed;
  // The button's padding depends on whether it has an icon as a direct child,
  // so the spinner is only a direct child when the content had an icon too.
  const hasIcon = Children.toArray(children).some(isValidElement);

  return (
    <Button
      type="submit"
      {...props}
      className={cn("relative", busy && "disabled:opacity-100", className)}
      disabled={disabled || pending}
      aria-busy={busy || undefined}
      onClick={(event) => {
        onClick?.(event);
        const form = event.currentTarget.form;
        // A form that fails validation never submits, so it never turns pending.
        const submits = !event.defaultPrevented && (!form || props.formNoValidate || form.noValidate || form.checkValidity());
        setPressed(Boolean(submits));
      }}
    >
      {busy ? (
        <>
          <span className="invisible contents">{children}</span>
          {hasIcon ? (
            <Loader2Icon className="absolute animate-spin" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center">
              <Loader2Icon className="animate-spin" />
            </span>
          )}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
