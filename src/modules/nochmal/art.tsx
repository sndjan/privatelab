"use client";

import { EraserIcon, ImageUpIcon, Loader2Icon, PencilIcon, Trash2Icon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { uploadSheetImage } from "./actions";
import { colors, type ArtSlot, type Sheet } from "./data";
import { sheetLayout } from "./sheet-svg";
import { Heading, Panel } from "./ui";

// Own pictures for a sheet: instead of the drawn star, golden die and
// diamond, and as the card's background. Each comes from a photo (cropped
// here) or is drawn by finger or mouse, then is stored in the bucket.

const slotInfo: Record<ArtSlot, { name: string; hint: string }> = {
  star: { name: "Stern", hint: "Steht auf den Sternfeldern. Am besten ein freigestelltes Motiv, das das Quadrat gut ausfüllt." },
  gold: { name: "Goldwürfel", hint: "Steht auf den goldenen Würfelfeldern und bei den Sonderwürfeln." },
  diamond: { name: "Diamant", hint: "Steht auf den Diamantfeldern." },
  background: { name: "Hintergrund", hint: "Füllt die Karte hinter den Kästchen. Ruhige, helle Bilder lassen die Schrift gut lesbar." },
};

const SYMBOL_SIZE = 320;
const BACKGROUND_WIDTH = 1600;

// The picture's pixel size: square for marks, the sheet's shape for the background.
function outputSize(slot: ArtSlot, aspect: number) {
  if (slot !== "background") return { width: SYMBOL_SIZE, height: SYMBOL_SIZE };
  return { width: BACKGROUND_WIDTH, height: Math.round(BACKGROUND_WIDTH / aspect) };
}

// WebP keeps transparency for marks and is small; older Safari falls back to
// PNG (marks) or JPEG (background).
async function canvasToBlob(canvas: HTMLCanvasElement, slot: ArtSlot): Promise<Blob> {
  const blob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  const webp = await blob("image/webp");
  if (webp?.type === "image/webp") return webp;
  const fallback = await blob(slot === "background" ? "image/jpeg" : "image/png");
  if (!fallback) throw new Error("Bild konnte nicht erstellt werden");
  return fallback;
}

async function cropToBlob(src: string, area: Area, slot: ArtSlot, aspect: number) {
  const image = new Image();
  image.src = src;
  await image.decode();
  const { width, height } = outputSize(slot, aspect);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  if (slot === "background") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
  }
  const scale = width / area.width;
  context.drawImage(image, -area.x * scale, -area.y * scale, image.naturalWidth * scale, image.naturalHeight * scale);
  return canvasToBlob(canvas, slot);
}

const checkerboard =
  "bg-[conic-gradient(#e7e9e6_25%,#ffffff_0_50%,#e7e9e6_0_75%,#ffffff_0)] bg-[length:20px_20px]";

// --- Panel in the editor ------------------------------------------------------------

export function ArtPanel({ sheet, slots, onChange }: { sheet: Sheet; slots: ArtSlot[]; onChange: (sheet: Sheet) => void }) {
  const [editing, setEditing] = useState<ArtSlot | null>(null);
  const layout = sheetLayout(sheet);
  const aspect = layout.width / layout.height;

  function set(slot: ArtSlot, url: string | null) {
    const art = { ...sheet.art };
    if (url) art[slot] = url;
    else delete art[slot];
    onChange({ ...sheet, art });
  }

  return (
    <Panel>
      <Heading className="mb-1">Eigene Bilder</Heading>
      <p className="mb-3 text-sm font-semibold text-(--nm-muted)">Foto hochladen und zuschneiden oder selbst zeichnen.</p>
      <ul className="flex flex-col gap-2">
        {slots.map((slot) => {
          const url = sheet.art[slot];
          return (
            <li key={slot} className="flex items-center gap-3 rounded-xl bg-(--nm-field) p-2">
              <span
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-(--nm-line)",
                  url && slot !== "background" ? checkerboard : "bg-(--nm-sunken)",
                )}
              >
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt="" className={cn("size-full", slot === "background" ? "object-cover" : "object-contain")} />
                ) : (
                  <span className="text-[11px] font-bold text-(--nm-faint)">Standard</span>
                )}
              </span>
              <span className="min-w-0 flex-1 text-sm font-extrabold">{slotInfo[slot].name}</span>
              <button
                type="button"
                onClick={() => setEditing(slot)}
                className="h-11 cursor-pointer rounded-full border border-(--nm-line-strong) bg-(--nm-panel) px-3.5 text-sm font-extrabold hover:bg-(--nm-hover)"
              >
                {url ? "Ändern" : "Eigenes"}
              </button>
              {url && (
                <button
                  type="button"
                  aria-label={`${slotInfo[slot].name}: zurück zum Standard`}
                  onClick={() => set(slot, null)}
                  className="flex size-11 cursor-pointer items-center justify-center rounded-full text-(--nm-danger) hover:bg-(--nm-hover) [&_svg]:size-4"
                >
                  <Trash2Icon />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <ArtDialog
        slot={editing}
        aspect={aspect}
        onClose={() => setEditing(null)}
        onDone={(slot, url) => {
          set(slot, url);
          setEditing(null);
        }}
      />
    </Panel>
  );
}

// --- Dialog: upload and crop, or draw --------------------------------------------------

function ArtDialog({
  slot,
  aspect,
  onClose,
  onDone,
}: {
  slot: ArtSlot | null;
  aspect: number;
  onClose: () => void;
  onDone: (slot: ArtSlot, url: string) => void;
}) {
  return (
    <Dialog open={slot !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        {slot && <ArtDialogBody key={slot} slot={slot} aspect={aspect} onCancel={onClose} onDone={(url) => onDone(slot, url)} />}
      </DialogContent>
    </Dialog>
  );
}

function ArtDialogBody({ slot, aspect, onCancel, onDone }: { slot: ArtSlot; aspect: number; onCancel: () => void; onDone: (url: string) => void }) {
  const [mode, setMode] = useState<"upload" | "draw">("upload");
  const [source, setSource] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const shape = slot === "background" ? aspect : 1;

  useEffect(() => () => void (source && URL.revokeObjectURL(source)), [source]);

  async function upload(blob: Blob) {
    setBusy(true);
    try {
      const data = new FormData();
      data.set("image", new File([blob], "bild", { type: blob.type }));
      const result = await uploadSheetImage(data);
      if ("error" in result) toast.error(result.error);
      else onDone(result.url);
    } catch {
      toast.error("Das Bild konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{slotInfo[slot].name}: eigenes Bild</DialogTitle>
        <DialogDescription>{slotInfo[slot].hint}</DialogDescription>
      </DialogHeader>

      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {(
          [
            { id: "upload", name: "Foto", icon: ImageUpIcon },
            { id: "draw", name: "Zeichnen", icon: PencilIcon },
          ] as const
        ).map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={mode === entry.id}
            onClick={() => setMode(entry.id)}
            className={cn(
              "flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium [&_svg]:size-4",
              mode === entry.id ? "bg-background shadow-xs" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <entry.icon /> {entry.name}
          </button>
        ))}
      </div>

      {mode === "upload" &&
        (source ? (
          <CropStep
            src={source}
            slot={slot}
            aspect={shape}
            busy={busy}
            onDone={upload}
            onBack={() => setSource(null)}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">Ein Foto oder Bild von deinem Gerät, danach schneidest du den Ausschnitt zu.</p>
            <Button type="button" onClick={() => fileInput.current?.click()}>
              <ImageUpIcon /> Bild auswählen
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) setSource(URL.createObjectURL(file));
              }}
            />
          </div>
        ))}

      {mode === "draw" && <DrawStep slot={slot} aspect={shape} busy={busy} onDone={upload} />}

      <div className="flex justify-end">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Abbrechen
        </Button>
      </div>
    </>
  );
}

function CropStep({
  src,
  slot,
  aspect,
  busy,
  onDone,
  onBack,
}: {
  src: string;
  slot: ArtSlot;
  aspect: number;
  busy: boolean;
  onDone: (blob: Blob) => void;
  onBack: () => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [working, setWorking] = useState(false);

  async function done() {
    if (!area) return;
    setWorking(true);
    try {
      onDone(await cropToBlob(src, area, slot, aspect));
    } catch {
      toast.error("Das Bild konnte nicht zugeschnitten werden.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className={cn("relative w-full overflow-hidden rounded-lg", slot === "background" ? "aspect-[4/3] bg-neutral-800" : cn("aspect-square", checkerboard))}>
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          minZoom={0.3}
          maxZoom={10}
          aspect={aspect}
          restrictPosition={false}
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_, pixels) => setArea(pixels)}
          style={{ containerStyle: { background: "transparent" } }}
        />
      </div>
      <div className="flex items-center gap-3">
        <ZoomOutIcon aria-hidden="true" className="size-4 text-muted-foreground" />
        <Slider aria-label="Zoom" min={0.3} max={10} step={0.05} value={[zoom]} onValueChange={([value]) => setZoom(value)} className="flex-1" />
        <ZoomInIcon aria-hidden="true" className="size-4 text-muted-foreground" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={done} disabled={!area || working || busy}>
          {(working || busy) && <Loader2Icon className="animate-spin" />}
          Übernehmen
        </Button>
        <Button type="button" variant="outline" onClick={onBack} disabled={working || busy}>
          Anderes Bild
        </Button>
      </div>
    </div>
  );
}

const pens = ["#16201c", "#ffffff", ...colors.map((color) => color.fill), "#e3a640", "#e5333b"];
const widths = [
  { id: "fein", name: "Fein", factor: 0.012 },
  { id: "mittel", name: "Mittel", factor: 0.03 },
  { id: "dick", name: "Dick", factor: 0.07 },
] as const;

// A drawing pad in the picture's shape. Marks are drawn on a transparent
// ground (the checkerboard), the background on white.
function DrawStep({ slot, aspect, busy, onDone }: { slot: ArtSlot; aspect: number; busy: boolean; onDone: (blob: Blob) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [pen, setPen] = useState<string>(pens[0]);
  const [width, setWidth] = useState<(typeof widths)[number]["id"]>("mittel");
  const [erasing, setErasing] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const [working, setWorking] = useState(false);
  const { width: pixelWidth, height: pixelHeight } = outputSize(slot, aspect);
  const isBackground = slot === "background";

  function clear() {
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, pixelWidth, pixelHeight);
    if (isBackground) {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, pixelWidth, pixelHeight);
    }
    setDrawn(false);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(clear, [pixelWidth, pixelHeight]);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: ((event.clientX - box.left) / box.width) * pixelWidth, y: ((event.clientY - box.top) / box.height) * pixelHeight };
  }

  function stroke(from: { x: number; y: number }, to: { x: number; y: number }) {
    const context = canvas.current!.getContext("2d")!;
    const erase = erasing && !isBackground;
    context.globalCompositeOperation = erase ? "destination-out" : "source-over";
    context.strokeStyle = erasing ? "#ffffff" : pen;
    context.fillStyle = context.strokeStyle;
    context.lineWidth = widths.find((entry) => entry.id === width)!.factor * Math.max(pixelWidth, pixelHeight);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x + 0.01, to.y);
    context.stroke();
  }

  async function done() {
    if (!canvas.current) return;
    setWorking(true);
    try {
      onDone(await canvasToBlob(canvas.current, slot));
    } catch {
      toast.error("Die Zeichnung konnte nicht gespeichert werden.");
    } finally {
      setWorking(false);
    }
  }

  const chip = (active: boolean) =>
    cn("flex h-10 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-sm font-medium [&_svg]:size-4", active ? "border-foreground bg-accent" : "hover:bg-accent");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Farbe">
        {pens.map((color) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={!erasing && pen === color}
            aria-label={`Farbe ${color}`}
            onClick={() => {
              setPen(color);
              setErasing(false);
            }}
            className={cn(
              "size-10 cursor-pointer rounded-full border-2 border-border",
              !erasing && pen === color && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
            )}
            style={{ background: color }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {widths.map((entry) => (
          <button key={entry.id} type="button" aria-pressed={width === entry.id} onClick={() => setWidth(entry.id)} className={chip(width === entry.id)}>
            {entry.name}
          </button>
        ))}
        <button type="button" aria-pressed={erasing} onClick={() => setErasing(!erasing)} className={chip(erasing)}>
          <EraserIcon /> Radierer
        </button>
        <button type="button" onClick={clear} className={chip(false)}>
          <Trash2Icon /> Leeren
        </button>
      </div>
      <canvas
        ref={canvas}
        width={pixelWidth}
        height={pixelHeight}
        aria-label="Zeichenfläche"
        className={cn(
          "mx-auto block w-full touch-none rounded-lg border",
          isBackground ? "bg-white" : cn("max-w-[360px]", checkerboard),
        )}
        style={{ aspectRatio: `${pixelWidth} / ${pixelHeight}` }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const at = point(event);
          last.current = at;
          stroke(at, at);
          setDrawn(true);
        }}
        onPointerMove={(event) => {
          if (!last.current) return;
          const at = point(event);
          stroke(last.current, at);
          last.current = at;
        }}
        onPointerUp={() => (last.current = null)}
        onPointerCancel={() => (last.current = null)}
      />
      <Button type="button" onClick={done} disabled={!drawn || working || busy}>
        {(working || busy) && <Loader2Icon className="animate-spin" />}
        Übernehmen
      </Button>
    </div>
  );
}
