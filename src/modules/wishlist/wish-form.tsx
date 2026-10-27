"use client";

import { Loader2Icon, PencilIcon, PlusIcon, SparklesIcon, StarIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { prefillFromLink, saveWish } from "./actions";
import type { Wish, WishInput } from "./data";
import { WishImage } from "./wish-image";

const empty: WishInput = {
  title: "",
  url: null,
  imageUrl: null,
  price: null,
  currency: "EUR",
  note: "",
  quantity: 1,
  favorite: false,
};

type Fields = {
  title: string;
  url: string;
  imageUrl: string;
  price: string;
  currency: string;
  note: string;
  quantity: string;
  favorite: boolean;
};

function toFields(wish: WishInput): Fields {
  return {
    title: wish.title,
    url: wish.url ?? "",
    imageUrl: wish.imageUrl ?? "",
    price: wish.price === null ? "" : wish.price.toFixed(2).replace(".", ","),
    currency: wish.currency,
    note: wish.note,
    quantity: String(wish.quantity),
    favorite: wish.favorite,
  };
}

// Adds a wish (paste a link, the AI fills in the rest) or edits one.
export function WishDialog({ listId, wish }: { listId: string; wish?: Wish }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [fields, setFields] = useState<Fields>(toFields(wish ?? empty));
  // A new wish shows the form once a link was read or "ohne Link" was chosen.
  const [showForm, setShowForm] = useState(Boolean(wish));
  const [images, setImages] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, startReading] = useTransition();
  const [saving, startSaving] = useTransition();

  function reset() {
    setLink("");
    setFields(toFields(wish ?? empty));
    setShowForm(Boolean(wish));
    setImages([]);
    setNotice(null);
    setError(null);
  }

  const set = (key: keyof Fields) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((current) => ({ ...current, [key]: event.target.value }));

  function read(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    startReading(async () => {
      const result = await prefillFromLink(link);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setFields(toFields(result.wish));
      setImages(result.images);
      setNotice(result.warning);
      setShowForm(true);
    });
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startSaving(async () => {
      try {
        await saveWish(listId, wish?.id ?? null, {
          title: fields.title,
          url: fields.url || null,
          imageUrl: fields.imageUrl || null,
          price: fields.price,
          currency: fields.currency,
          note: fields.note,
          quantity: Number(fields.quantity) || 1,
          favorite: fields.favorite,
        });
        setOpen(false);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Speichern fehlgeschlagen.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        // Starts from the saved wish every time it opens.
        if (value) reset();
        setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        {wish ? (
          <Button variant="ghost" size="icon" aria-label={`${wish.title} bearbeiten`} className="text-muted-foreground">
            <PencilIcon />
          </Button>
        ) : (
          <Button size="lg" className="h-12 w-full">
            <PlusIcon /> Wunsch hinzufügen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{wish ? "Wunsch bearbeiten" : "Neuer Wunsch"}</DialogTitle>
          {!wish && (
            <DialogDescription>Link aus dem Shop einfügen: Titel, Preis und Bild füllt die KI aus.</DialogDescription>
          )}
        </DialogHeader>

        {!wish && (
          <form onSubmit={read} className="flex gap-2">
            <Input
              type="url"
              required
              inputMode="url"
              aria-label="Link zum Produkt"
              placeholder="https://…"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              className="flex-1"
            />
            <Button type="submit" variant={showForm ? "outline" : "default"} disabled={reading || !link}>
              {reading ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
              Ausfüllen
            </Button>
          </form>
        )}
        {!wish && !showForm && (
          <Button variant="link" className="-mt-2 h-auto justify-start p-0 text-muted-foreground" onClick={() => setShowForm(true)}>
            Ohne Link eintragen
          </Button>
        )}
        {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

        {showForm && (
          <form id="wish-form" onSubmit={save} className="space-y-4">
            <div className="flex gap-3">
              <WishImage src={fields.imageUrl || null} alt="" className="size-20 shrink-0 rounded-lg border" />
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="wish-title">Was wünschst du dir?</Label>
                <Input id="wish-title" required maxLength={200} value={fields.title} onChange={set("title")} />
              </div>
            </div>

            {images.length > 1 && (
              <div className="space-y-2">
                <Label>Bild</Label>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((image) => (
                    <button
                      key={image}
                      type="button"
                      onClick={() => setFields((current) => ({ ...current, imageUrl: image }))}
                      aria-label="Dieses Bild nehmen"
                      aria-pressed={fields.imageUrl === image}
                      className={cn(
                        "shrink-0 rounded-lg border-2",
                        fields.imageUrl === image ? "border-brand" : "border-transparent",
                      )}
                    >
                      <WishImage src={image} alt="" className="size-14 rounded-md" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-[1fr_5rem_5rem] gap-2">
              <div className="space-y-2">
                <Label htmlFor="wish-price">Preis</Label>
                <Input id="wish-price" inputMode="decimal" placeholder="z. B. 29,99" value={fields.price} onChange={set("price")} className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wish-currency">Währung</Label>
                <Input id="wish-currency" maxLength={3} value={fields.currency} onChange={set("currency")} className="font-mono uppercase" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wish-quantity">Anzahl</Label>
                <Input id="wish-quantity" type="number" min={1} max={99} value={fields.quantity} onChange={set("quantity")} className="font-mono" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wish-url">Link</Label>
              <Input id="wish-url" type="url" placeholder="https://…" value={fields.url} onChange={set("url")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wish-image">Bild-Link</Label>
              <Input id="wish-image" type="url" placeholder="https://…" value={fields.imageUrl} onChange={set("imageUrl")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wish-note">Notiz</Label>
              <Textarea
                id="wish-note"
                rows={2}
                maxLength={1000}
                placeholder="z. B. Größe M, am liebsten in Grün"
                value={fields.note}
                onChange={set("note")}
              />
            </div>

            <Button
              type="button"
              variant="outline"
              aria-pressed={fields.favorite}
              onClick={() => setFields((current) => ({ ...current, favorite: !current.favorite }))}
            >
              <StarIcon className={cn(fields.favorite && "fill-amber-400 text-amber-500")} />
              Herzenswunsch
            </Button>
          </form>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {showForm && (
          <DialogFooter>
            <Button type="submit" form="wish-form" disabled={saving}>
              {saving && <Loader2Icon className="animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
