// Browser only: prepares a photo from the camera or gallery. The AI gets it
// scaled to about 1.15 megapixels (Claude reads no more than that, and server
// actions take at most 1 MB); the history gets a small square thumbnail.

const AI_MAX_SIDE = 1568;
const AI_MAX_PIXELS = 1_150_000;
const THUMB = 240;

export type PreparedPhoto = { photo: Blob; thumb: Blob | null; previewUrl: string };

async function load(file: Blob) {
  const image = new Image();
  const url = URL.createObjectURL(file);
  try {
    image.src = url;
    await image.decode();
  } finally {
    URL.revokeObjectURL(url);
  }
  return image;
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const image = await load(file).catch(() => {
    throw new Error("Das Foto konnte nicht gelesen werden.");
  });
  const { naturalWidth: width, naturalHeight: height } = image;

  const scale = Math.min(1, AI_MAX_SIDE / Math.max(width, height), Math.sqrt(AI_MAX_PIXELS / (width * height)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  let photo = await toBlob(canvas, "image/jpeg", 0.85);
  if (photo && photo.size > 900_000) photo = await toBlob(canvas, "image/jpeg", 0.6);
  // Server actions take at most 1 MB per request, thumbnail included.
  if (!photo || photo.size > 900_000) throw new Error("Das Foto konnte nicht verarbeitet werden.");

  // Square from the middle. Browsers without WebP encoding (older Safari)
  // return PNG instead; then JPEG.
  const side = Math.min(width, height);
  const square = document.createElement("canvas");
  square.width = THUMB;
  square.height = THUMB;
  square.getContext("2d")!.drawImage(image, (width - side) / 2, (height - side) / 2, side, side, 0, 0, THUMB, THUMB);
  let thumb = await toBlob(square, "image/webp", 0.7);
  if (thumb?.type !== "image/webp") thumb = await toBlob(square, "image/jpeg", 0.7);

  return { photo, thumb, previewUrl: URL.createObjectURL(photo) };
}
