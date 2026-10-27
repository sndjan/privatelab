"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addAccount, deleteAccount, setAccountArchived, updateAccount } from "./actions";
import { accountKinds, type AccountKind } from "./calc";

type Account = { id: string; name: string; kind: AccountKind; archived: boolean };

// Adds an account, or edits one when `account` is given: name, kind,
// archiving, and deleting archived accounts.
export function AccountDialog({ account }: { account?: Account }) {
  const [open, setOpen] = useState(false);

  function closingAfter(action: (formData: FormData) => Promise<void>) {
    return async (formData: FormData) => {
      await action(formData);
      setOpen(false);
    };
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {account ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`${account.name} bearbeiten`}
            className="text-muted-foreground"
          >
            <PencilIcon />
          </Button>
        ) : (
          <Button variant="outline" className="w-fit">
            <PlusIcon /> Konto hinzufügen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form action={closingAfter(account ? updateAccount : addAccount)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{account ? "Konto bearbeiten" : "Konto hinzufügen"}</DialogTitle>
          </DialogHeader>
          {account && (
            <>
              <input type="hidden" name="accountId" value={account.id} />
              <input type="hidden" name="archived" value={String(!account.archived)} />
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="account-name">Name</Label>
            <Input
              id="account-name"
              name="name"
              required
              maxLength={80}
              defaultValue={account?.name}
              placeholder="z. B. ETF-Depot"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-kind">Art</Label>
            <Select name="kind" defaultValue={account?.kind ?? "investment"}>
              <SelectTrigger id="account-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accountKinds.map((kind) => (
                  <SelectItem key={kind.value} value={kind.value}>
                    {kind.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {account && (
            <div className="flex flex-wrap gap-2 border-t pt-4">
              <SubmitButton
                variant="outline"
                formAction={closingAfter(setAccountArchived)}
                formNoValidate
                className="flex-1"
              >
                {account.archived ? "Wiederherstellen" : "Archivieren"}
              </SubmitButton>
              {account.archived && (
                <SubmitButton
                  variant="ghost"
                  formAction={closingAfter(deleteAccount)}
                  formNoValidate
                  className="flex-1 text-destructive hover:text-destructive"
                >
                  Endgültig löschen
                </SubmitButton>
              )}
            </div>
          )}
          {account && !account.archived && (
            <p className="text-xs text-muted-foreground">
              Archivierte Konten zählen nach ihrem letzten Monatsstand nicht mehr zum Vermögen. Löschen geht erst nach
              dem Archivieren.
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Abbrechen
              </Button>
            </DialogClose>
            <SubmitButton>{account ? "Speichern" : "Hinzufügen"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
