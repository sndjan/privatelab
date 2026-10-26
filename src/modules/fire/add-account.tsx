"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
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
import { addAccount } from "./actions";
import { accountKinds } from "./calc";

export function AddAccount() {
  const [open, setOpen] = useState(false);

  async function save(formData: FormData) {
    await addAccount(formData);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-fit">
          <PlusIcon /> Konto hinzufügen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form action={save} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Konto hinzufügen</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="account-name">Name</Label>
            <Input id="account-name" name="name" required maxLength={80} placeholder="z. B. ETF-Depot" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-kind">Art</Label>
            <Select name="kind" defaultValue="investment">
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
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Abbrechen
              </Button>
            </DialogClose>
            <Button>Hinzufügen</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
