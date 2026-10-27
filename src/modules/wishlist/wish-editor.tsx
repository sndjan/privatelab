"use client";

import { ChevronLeftIcon, HeartIcon, ImagePlusIcon, Loader2Icon, SparklesIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { prefillFromLink, saveWish, uploadWishImage } from "./actions";
import type { Wish, WishInput } from "./data";
import { ImageCropper } from "./image-cropper";
import { WishImage } from "./wish-image";

const PATH = "/m/wishlist";

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

// The page for a new wish (paste a link, the AI fills in the rest) or for
// editing one. A page rather than a dialog, so it works well on phones.
export function WishEditor({ listId, wish }: { listId: string; wish?: Wish }) {
  const [link, setLink] = useState("");
  const [fields, setFields] = useState<Fields>(toFields(wish ?? empty));
  // A new wish shows the form once a link was read or "ohne Link" was chosen.
  const [showForm, setShowForm] = useState(Boolean(wish));
  const [images, setImages] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [reading, startReading] = useTransition();
  const [uploading, startUploading] = useTransition();
  const [saving, startSaving] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  // The picked photo is shown from memory until it's cropped.
  useEffect(() => () => void (cropSource && URL.revokeObjectURL(cropSource)), [cropSource]);

  const set = (key: keyof Fields) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((current) => ({ ...current, [key]: event.target.value }));
  const setImage = (url: string) => setFields((current) => ({ ...current, imageUrl: url }));

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

  function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) setCropSource(URL.createObjectURL(file));
  }

  function upload(image: Blob) {
    setError(null);
    startUploading(async () => {
      const data = new FormData();
      data.append("image", new File([image], "wish", { type: image.type }));
      const result = await uploadWishImage(data);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setImage(result.url);
      setCropSource(null);
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
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Speichern fehlgeschlagen.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="-ml-2 flex items-center gap-1">
        <Button asChild variant="ghost" size="icon" className="size-10 text-muted-foreground">
          <Link href={`${PATH}?list=${listId}`} aria-label="Zurück zur Liste">
            <ChevronLeftIcon className="size-5" />
          </Link>
        </Button>
        <h2 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight">
          {wish ? "Wunsch bearbeiten" : "Neuer Wunsch"}
        </h2>
      </div>

      {!wish && (
        <Card>
          <CardContent className="space-y-3">
            <form onSubmit={read} className="space-y-2">
              <Label htmlFor="wish-link">Link aus dem Shop</Label>
              <div className="flex gap-2">
                <Input
                  id="wish-link"
                  type="url"
                  required
                  inputMode="url"
                  placeholder="https://…"
                  value={link}
                  onChange={(event) => setLink(event.target.value)}
                  className="flex-1"
                />
                <Button type="submit" variant={showForm ? "outline" : "default"} disabled={reading || !link}>
                  {reading ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
                  Ausfüllen
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Titel, Preis und Bild füllt die KI aus; du prüfst alles vor dem Speichern.</p>
            </form>
            {!showForm && (
              <Button variant="link" className="h-auto p-0 text-muted-foreground" onClick={() => setShowForm(true)}>
                Ohne Link eintragen
              </Button>
            )}
            {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
          </CardContent>
        </Card>
      )}

      {showForm && (
        <form onSubmit={save} className="space-y-4">
          <Card>
            <CardContent className="space-y-3">
              <Label>Bild</Label>
              {cropSource ? (
                <ImageCropper src={cropSource} busy={uploading} onDone={upload} onCancel={() => setCropSource(null)} />
              ) : (
                <div className="flex items-start gap-3">
                  <WishImage src={fields.imageUrl || null} alt="" className="size-32 shrink-0 rounded-lg border" />
                  <div className="flex flex-col items-start gap-2">
                    <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}>
                      <ImagePlusIcon /> {fields.imageUrl ? "Eigenes Bild" : "Bild hochladen"}
                    </Button>
                    {fields.imageUrl && (
                      <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setImage("")}>
                        <XIcon /> Entfernen
                      </Button>
                    )}
                  </div>
                  <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={pick} />
                </div>
              )}
              {!cropSource && images.length > 1 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Bilder aus dem Shop</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {images.map((image) => (
                      <button
                        key={image}
                        type="button"
                        onClick={() => setImage(image)}
                        aria-label="Dieses Bild nehmen"
                        aria-pressed={fields.imageUrl === image}
                        className={cn("shrink-0 rounded-lg border-2", fields.imageUrl === image ? "border-brand" : "border-transparent")}
                      >
                        <WishImage src={image} alt="" className="size-14 rounded-md" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wish-title">Was wünschst du dir?</Label>
                <Input id="wish-title" required maxLength={200} value={fields.title} onChange={set("title")} />
              </div>

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

              <button
                type="button"
                aria-pressed={fields.favorite}
                onClick={() => setFields((current) => ({ ...current, favorite: !current.favorite }))}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                  fields.favorite ? "border-rose-500/40 bg-rose-500/5" : "hover:bg-accent",
                )}
              >
                <HeartIcon className={cn("size-5 shrink-0", fields.favorite ? "fill-rose-500 text-rose-500" : "text-muted-foreground")} />
                <span>
                  <span className="block text-sm font-medium">Herzenswunsch</span>
                  <span className="block text-xs text-muted-foreground">
                    Steht für deine Gäste ganz oben, unter „Darüber freue ich mich besonders“.
                  </span>
                </span>
              </button>
            </CardContent>
          </Card>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" size="lg" className="h-12 w-full" disabled={saving || uploading || cropSource !== null}>
            {saving && <Loader2Icon className="animate-spin" />}
            Speichern
          </Button>
        </form>
      )}

      {!showForm && error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
