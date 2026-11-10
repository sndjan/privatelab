// Browser only: prepares a photo or PDF for reading. Photos are scaled so the
// small numbers stay readable but the upload stays well under the 4 MB that
// server actions take here; PDFs go as they are.

const MAX_SIDE = 2400;
const MAX_BYTES = 3_500_000;

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

export async function prepareFile(file: File): Promise<{ blob: Blob; name: string }> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    if (file.size > MAX_BYTES) throw new Error("Die PDF ist zu groß (höchstens 3,5 MB). Mach lieber ein Foto davon.");
    return { blob: new Blob([file], { type: "application/pdf" }), name: "dokument.pdf" };
  }
  const image = new Image();
  const url = URL.createObjectURL(file);
  try {
    image.src = url;
    await image.decode();
  } catch {
    throw new Error("Das Foto konnte nicht gelesen werden.");
  } finally {
    URL.revokeObjectURL(url);
  }
  const { naturalWidth: width, naturalHeight: height } = image;
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  let blob = await toBlob(canvas, 0.88);
  if (blob && blob.size > MAX_BYTES) blob = await toBlob(canvas, 0.7);
  if (!blob || blob.size > MAX_BYTES) throw new Error("Das Foto konnte nicht verarbeitet werden.");
  return { blob, name: "foto.jpg" };
}
