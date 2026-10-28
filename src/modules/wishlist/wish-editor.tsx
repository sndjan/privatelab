"use client";

import { ChevronLeftIcon, CropIcon, HeartIcon, ImagePlusIcon, Loader2Icon, ScanIcon, SparklesIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { prefillFromLink, prefillFromScreenshot, saveWish, uploadWishImage } from "./actions";
import type { Wish, WishInput } from "./data";
import { ImageCropper } from "./image-cropper";
import type { ImageBox } from "./screenshot-import";
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

// Claude reads images up to about 1.15 megapixels; larger ones only cost
// upload time. Screenshots are tall, so the long side decides.
const AI_MAX_SIDE = 1568;
const AI_MAX_PIXELS = 1_150_000;

async function scaleForAi(file: File): Promise<Blob> {
  const image = new Image();
  const url = URL.createObjectURL(file);
  try {
    image.src = url;
    await image.decode();
  } finally {
    URL.revokeObjectURL(url);
  }
  const { naturalWidth: width, naturalHeight: height } = image;
  const scale = Math.min(1, AI_MAX_SIDE / Math.max(width, height), Math.sqrt(AI_MAX_PIXELS / (width * height)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("Der Screenshot konnte nicht gelesen werden.");
  return blob;
}

// The AI's box around the product as a square crop (in percent of the
// screenshot) with a little room around it.
async function squareArea(src: string, box: ImageBox): Promise<Area> {
  const image = new Image();
  image.src = src;
  await image.decode();
  const { naturalWidth: width, naturalHeight: height } = image;
  const side = Math.max(box.width * width, box.height * height) * 1.06;
  const centerX = (box.x + box.width / 2) * width;
  const centerY = (box.y + box.height / 2) * height;
  return {
    x: ((centerX - side / 2) / width) * 100,
    y: ((centerY - side / 2) / height) * 100,
    width: (side / width) * 100,
    height: (side / height) * 100,
  };
}

// The page for a new wish (paste a link or pick a screenshot, the AI fills in
// the rest) or for editing one. A page rather than a dialog, so it works well
// on phones. sharedText comes from the app's share target (Android).
export function WishEditor({ listId, wish, sharedText }: { listId: string; wish?: Wish; sharedText?: string }) {
  const [link, setLink] = useState(sharedText ?? "");
  const [fields, setFields] = useState<Fields>(toFields(wish ?? empty));
  // A new wish shows the form once a link was read or "ohne Link" was chosen.
  const [showForm, setShowForm] = useState(Boolean(wish));
  const [images, setImages] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cropSource, setCropSource] = useState<string | null>(null);
  // A screenshot stays around, so another part of it can be cropped later.
  const [screenshot, setScreenshot] = useState<{ src: string; area: Area | null } | null>(null);
  const [reading, startReading] = useTransition();
  const [uploading, startUploading] = useTransition();
  const [saving, startSaving] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const screenshotInput = useRef<HTMLInputElement>(null);

  // A picked photo is shown from memory until it's cropped; a screenshot
  // until the page is left or another one is picked.
  const screenshotSrc = screenshot?.src;
  useEffect(
    () => () => void (cropSource && cropSource !== screenshotSrc && URL.revokeObjectURL(cropSource)),
    [cropSource, screenshotSrc],
  );
  useEffect(() => () => void (screenshotSrc && URL.revokeObjectURL(screenshotSrc)), [screenshotSrc]);

  const set = (key: keyof Fields) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((current) => ({ ...current, [key]: event.target.value }));
  const setImage = (url: string) => setFields((current) => ({ ...current, imageUrl: url }));

  function read(event?: React.FormEvent) {
    event?.preventDefault();
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

  // Shared from another app: read it right away.
  const readShared = useRef(Boolean(sharedText));
  useEffect(() => {
    if (!readShared.current) return;
    readShared.current = false;
    read();
  });

  function pickScreenshot(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const src = URL.createObjectURL(file);
    setError(null);
    setNotice(null);
    setCropSource(null);
    setScreenshot({ src, area: null });
    startReading(async () => {
      const data = new FormData();
      try {
        data.append("screenshot", new File([await scaleForAi(file)], "screenshot.jpg", { type: "image/jpeg" }));
      } catch {
        setError("Der Screenshot konnte nicht gelesen werden.");
        return;
      }
      const result = await prefillFromScreenshot(data);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      // A link pasted before beats the AI's guess.
      const next = toFields(result.wish);
      setFields({ ...next, url: /^https?:\/\/\S+$/.test(link.trim()) ? link.trim() : next.url });
      setImages([]);
      setNotice(result.warning);
      setShowForm(true);
      const area = result.imageBox ? await squareArea(src, result.imageBox) : null;
      setScreenshot({ src, area });
      // Opens the cropper on the product; "Bild übernehmen" stores it.
      setCropSource(src);
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
                  required
                  inputMode="url"
                  autoComplete="off"
                  placeholder="https://… oder geteilter Text"
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
            <div className="space-y-1">
              <Button type="button" variant="outline" className="w-full" disabled={reading} onClick={() => screenshotInput.current?.click()}>
                {reading && screenshot ? <Loader2Icon className="animate-spin" /> : <ScanIcon />}
                Aus Screenshot ausfüllen
              </Button>
              <p className="text-xs text-muted-foreground">
                Z. B. von der Amazon-App oder Instagram: die KI liest Titel und Preis und schneidet das Produktbild aus.
              </p>
              <input ref={screenshotInput} type="file" accept="image/*" className="hidden" onChange={pickScreenshot} />
            </div>
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
                <ImageCropper
                  key={cropSource}
                  src={cropSource}
                  busy={uploading}
                  initialArea={cropSource === screenshot?.src ? (screenshot.area ?? undefined) : undefined}
                  onDone={upload}
                  onCancel={() => setCropSource(null)}
                />
              ) : (
                <div className="flex items-start gap-3">
                  <WishImage src={fields.imageUrl || null} alt="" className="size-32 shrink-0 rounded-lg border" />
                  <div className="flex flex-col items-start gap-2">
                    <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}>
                      <ImagePlusIcon /> {fields.imageUrl ? "Eigenes Bild" : "Bild hochladen"}
                    </Button>
                    {screenshot && (
                      <Button type="button" variant="outline" onClick={() => setCropSource(screenshot.src)}>
                        <CropIcon /> Aus dem Screenshot
                      </Button>
                    )}
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
