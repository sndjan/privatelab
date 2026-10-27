"use client";

import { Loader2Icon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

const SIZE = 800;

// Draws the chosen square on a white canvas (zooming out leaves white space
// around the product) and returns it as a WebP, or JPEG where WebP isn't
// supported (older Safari).
async function cropToBlob(src: string, area: Area): Promise<Blob> {
  const image = new Image();
  image.src = src;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, SIZE, SIZE);
  const scale = SIZE / area.width;
  context.drawImage(image, -area.x * scale, -area.y * scale, image.naturalWidth * scale, image.naturalHeight * scale);
  const blob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  const webp = await blob("image/webp");
  if (webp?.type === "image/webp") return webp;
  const jpeg = await blob("image/jpeg");
  if (!jpeg) throw new Error("Bild konnte nicht erstellt werden");
  return jpeg;
}

// Square crop of a picked photo: drag to move, pinch or slider to zoom.
export function ImageCropper({
  src,
  busy,
  onDone,
  onCancel,
}: {
  src: string;
  busy: boolean;
  onDone: (image: Blob) => void;
  onCancel: () => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [working, setWorking] = useState(false);

  async function done() {
    if (!area) return;
    setWorking(true);
    try {
      onDone(await cropToBlob(src, area));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-white">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          minZoom={0.5}
          maxZoom={4}
          aspect={1}
          restrictPosition={false}
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_, pixels) => setArea(pixels)}
          style={{ containerStyle: { background: "#ffffff" } }}
        />
      </div>
      <div className="flex items-center gap-3">
        <ZoomOutIcon aria-hidden="true" className="size-4 text-muted-foreground" />
        <Slider
          aria-label="Zoom"
          min={0.5}
          max={4}
          step={0.05}
          value={[zoom]}
          onValueChange={([value]) => setZoom(value)}
          className="flex-1"
        />
        <ZoomInIcon aria-hidden="true" className="size-4 text-muted-foreground" />
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={done} disabled={!area || working || busy}>
          {(working || busy) && <Loader2Icon className="animate-spin" />}
          Bild übernehmen
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={working || busy}>
          Abbrechen
        </Button>
      </div>
    </div>
  );
}
