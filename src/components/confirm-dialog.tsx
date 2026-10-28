"use client";

import { AlertDialog } from "radix-ui";
import { useSyncExternalStore } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// The app's own "are you sure?" instead of the browser's window.confirm:
//
//   if (!(await confirmDialog({ title: "„Urlaub“ löschen?" }))) return;
//
// One <ConfirmDialogHost /> in the root layout shows it.

type Options = {
  title: string;
  description?: string;
  // Text of the confirming button, "Löschen" by default.
  confirmLabel?: string;
  // Red confirming button; true by default, since it's mostly for deleting.
  destructive?: boolean;
};

type Request = Options & { resolve: (ok: boolean) => void };

let current: Request | null = null;
const listeners = new Set<() => void>();

function set(next: Request | null) {
  current = next;
  for (const listener of listeners) listener();
}

export function confirmDialog(options: Options) {
  // A new question answers an open one with "no".
  current?.resolve(false);
  return new Promise<boolean>((resolve) => set({ ...options, resolve }));
}

// For a submit button: asks first, and once confirmed clicks the button
// again, this time letting it submit (so its spinner shows as usual).
// Use as its onClick.
export function confirmSubmit(options: Options) {
  return (event: React.MouseEvent<HTMLButtonElement>) => {
    const button = event.currentTarget;
    if (button.dataset.confirmed) {
      delete button.dataset.confirmed;
      return;
    }
    event.preventDefault();
    void confirmDialog(options).then((ok) => {
      if (!ok) return;
      button.dataset.confirmed = "1";
      button.click();
    });
  };
}

export function ConfirmDialogHost() {
  const request = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => null,
  );

  function answer(ok: boolean) {
    request?.resolve(ok);
    set(null);
  }

  return (
    <AlertDialog.Root open={request !== null} onOpenChange={(open) => !open && answer(false)}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <AlertDialog.Content className="fixed top-[max(1rem,env(safe-area-inset-top))] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:top-[50%] sm:max-w-md sm:translate-y-[-50%]">
          <div className="space-y-2">
            <AlertDialog.Title className="text-lg leading-snug font-semibold">{request?.title}</AlertDialog.Title>
            <AlertDialog.Description className={cn("text-sm text-muted-foreground", !request?.description && "sr-only")}>
              {request?.description ?? request?.title}
            </AlertDialog.Description>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel className={buttonVariants({ variant: "ghost" })} onClick={() => answer(false)}>
              Abbrechen
            </AlertDialog.Cancel>
            <AlertDialog.Action
              className={buttonVariants({ variant: request?.destructive === false ? "default" : "destructive" })}
              onClick={() => answer(true)}
            >
              {request?.confirmLabel ?? "Löschen"}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
