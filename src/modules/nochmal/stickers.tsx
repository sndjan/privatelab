"use client";

import { CopyIcon, ImagePlusIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { uploadSheetImage } from "./actions";
import { MAX_STICKERS, type Sheet, type Sticker } from "./data";
import { sheetLayout } from "./sheet-svg";
import { Heading, Panel } from "./ui";

// Stickers: own pictures (PNGs with transparency work best) placed freely on
// the card, as many as wanted. Each is uploaded as it is (scaled down, no
// crop), then sized, turned, outlined and put behind or in front of the
// sheet here; it is moved by dragging its dashed frame on the sheet.

const MAX_SIDE = 900;

// The picture scaled to at most MAX_SIDE pixels, as WebP (keeps transparency)
// or PNG where the browser can't write WebP.
async function prepare(file: File): Promise<{ blob: Blob; ratio: number }> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")!.drawImage(image, 0, 0, width, height);
    const toBlob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
    const webp = await toBlob("image/webp");
    const blob = webp?.type === "image/webp" ? webp : await toBlob("image/png");
    if (!blob) throw new Error("Bild konnte nicht erstellt werden");
    return { blob, ratio: height / width };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function StickerPanel({
  sheet,
  selected,
  onSelect,
  onChange,
}: {
  sheet: Sheet;
  selected: number | null;
  onSelect: (index: number | null) => void;
  onChange: (stickers: Sticker[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const stickers = sheet.stickers;
  const layout = sheetLayout(sheet);
  const current = selected !== null ? stickers[selected] : undefined;

  const update = (patch: Partial<Sticker>) => {
    if (selected === null) return;
    onChange(stickers.map((sticker, i) => (i === selected ? { ...sticker, ...patch } : sticker)));
  };

  async function add(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    let next = [...stickers];
    try {
      for (const file of Array.from(files).slice(0, MAX_STICKERS - next.length)) {
        const { blob, ratio } = await prepare(file);
        const form = new FormData();
        form.append("image", new File([blob], `sticker.${blob.type === "image/webp" ? "webp" : "png"}`, { type: blob.type }));
        const result = await uploadSheetImage(form);
        if ("error" in result) {
          toast.error(result.error);
          break;
        }
        // New stickers start in the middle, a little apart, in front of the sheet.
        const offset = (next.length % 5) * 4;
        next = [
          ...next,
          {
            url: result.url,
            x: layout.width / 2 + offset,
            y: layout.height / 2 + offset,
            width: 24,
            ratio,
            rotate: 0,
            outline: true,
            outlineColor: "#ffffff",
            front: true,
          },
        ];
        onChange(next);
        onSelect(next.length - 1);
      }
    } catch {
      toast.error("Das Bild konnte nicht verarbeitet werden.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const small =
    "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-(--nm-line-strong) bg-(--nm-field) px-3 text-xs font-extrabold text-(--nm-text-soft) hover:bg-(--nm-hover) [&_svg]:size-3.5";

  return (
    <Panel>
      <Heading className="mb-1">Sticker</Heading>
      <p className="mb-3 text-sm font-semibold text-(--nm-muted)">
        Eigene Bilder frei auf dem Blatt, z. B. freigestellte PNGs. Den gewählten Sticker ziehst du im Blatt an seinem gestrichelten Rahmen.
      </p>

      {stickers.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {stickers.map((sticker, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Sticker ${i + 1}`}
              aria-pressed={selected === i}
              onClick={() => onSelect(selected === i ? null : i)}
              className={cn(
                "flex size-14 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 bg-(--nm-sunken) p-1",
                selected === i ? "border-[#ff9a2e]" : "border-(--nm-line)",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sticker.url} alt="" className="max-h-full max-w-full object-contain" />
            </button>
          ))}
        </div>
      )}

      {current && selected !== null && (
        <div className="mb-3 flex flex-col gap-3 rounded-xl bg-(--nm-field) p-3">
          <label className="flex flex-col gap-1 text-sm font-bold text-(--nm-muted)">
            Größe
            <input
              type="range"
              min={4}
              max={120}
              step={1}
              value={current.width}
              onChange={(event) => update({ width: Number(event.target.value) })}
              className="accent-[#ff9a2e]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-bold text-(--nm-muted)">
            Drehung · {Math.round(current.rotate)}°
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={current.rotate}
              onChange={(event) => update({ rotate: Number(event.target.value) })}
              className="accent-[#ff9a2e]"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-extrabold">
              <input type="checkbox" checked={current.outline} onChange={(event) => update({ outline: event.target.checked })} className="size-4 accent-[#ff9a2e]" />
              Umrandung
            </label>
            {current.outline && (
              <label className="flex items-center gap-2 text-sm font-bold text-(--nm-muted)">
                Farbe
                <input
                  type="color"
                  value={current.outlineColor}
                  onChange={(event) => update({ outlineColor: event.target.value })}
                  className="h-8 w-10 cursor-pointer rounded border border-(--nm-line-strong) bg-transparent"
                />
              </label>
            )}
            <label className="flex cursor-pointer items-center gap-2 text-sm font-extrabold">
              <input type="checkbox" checked={!current.front} onChange={(event) => update({ front: !event.target.checked })} className="size-4 accent-[#ff9a2e]" />
              Hinter dem Blatt
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {stickers.length < MAX_STICKERS && (
              <button
                type="button"
                className={small}
                onClick={() => {
                  onChange([...stickers, { ...current, x: current.x + 4, y: current.y + 4 }]);
                  onSelect(stickers.length);
                }}
              >
                <CopyIcon /> Kopie
              </button>
            )}
            <button
              type="button"
              className={cn(small, "text-(--nm-danger)")}
              onClick={() => {
                onChange(stickers.filter((_, i) => i !== selected));
                onSelect(null);
              }}
            >
              <Trash2Icon /> Entfernen
            </button>
          </div>
        </div>
      )}

      <input ref={input} type="file" accept="image/png,image/webp,image/jpeg" multiple hidden onChange={(event) => void add(event.target.files)} />
      <button
        type="button"
        disabled={busy || stickers.length >= MAX_STICKERS}
        onClick={() => input.current?.click()}
        className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-(--nm-line-strong) bg-(--nm-panel) px-4 text-sm font-extrabold hover:bg-(--nm-hover) disabled:cursor-default disabled:opacity-50 [&_svg]:size-4"
      >
        {busy ? <Loader2Icon className="animate-spin" /> : <ImagePlusIcon />}
        {busy ? "Lädt hoch …" : "PNG hinzufügen"}
      </button>
    </Panel>
  );
}
