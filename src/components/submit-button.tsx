"use client";

import { CheckIcon, Loader2Icon } from "lucide-react";
import { Children, isValidElement, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Submit button for forms with a server action. While the action runs, every
// submit button in the form is disabled and the one that was pressed shows a
// spinner in place of its content (keeping its size, so nothing jumps).
// Afterwards it briefly shows a check mark, and `done` (e.g. "Gespeichert")
// pops up as a toast, for actions that change nothing visible on the page.
// An action that fails throws into the error page instead.
export function SubmitButton({
  children,
  className,
  disabled,
  onClick,
  done,
  ...props
}: React.ComponentProps<typeof Button> & { done?: string }) {
  const { pending } = useFormStatus();
  const [pressed, setPressed] = useState(false);
  const [finished, setFinished] = useState(false);
  const [wasPending, setWasPending] = useState(pending);
  if (pending !== wasPending) {
    setWasPending(pending);
    if (!pending) {
      if (pressed) setFinished(true);
      setPressed(false);
    }
  }
  const busy = pending && pressed;
  // The button's padding depends on whether it has an icon as a direct child,
  // so the spinner is only a direct child when the content had an icon too.
  const hasIcon = Children.toArray(children).some(isValidElement);

  useEffect(() => {
    if (!finished) return;
    const timer = setTimeout(() => setFinished(false), 1500);
    return () => clearTimeout(timer);
  }, [finished]);

  // The cleanup runs when the action is over: on the next render, or when the
  // action removed the button from the page (e.g. "Löschen" on a list item).
  // A failed action shows the error page instead of the toast.
  useEffect(() => {
    if (!busy || !done) return;
    return () => {
      setTimeout(() => {
        if (!document.querySelector("[data-error-page]")) toast.success(done);
      }, 50);
    };
  }, [busy, done]);

  const Overlay = busy ? Loader2Icon : finished ? CheckIcon : null;
  const overlayClass = busy ? "animate-spin" : "text-brand animate-in zoom-in-50 fade-in";

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
        setFinished(false);
      }}
    >
      {Overlay ? (
        <>
          <span className="invisible contents">{children}</span>
          {hasIcon ? (
            <Overlay className={cn("absolute", overlayClass)} />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center">
              <Overlay className={overlayClass} />
            </span>
          )}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
