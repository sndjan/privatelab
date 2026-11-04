"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cleanSheet, IMAGE_BUCKET } from "./data";

// All writes go through the user's own Supabase client, so RLS enforces
// ownership and access to the 'nochmal' module.

const PATH = "/m/nochmal";

async function db() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  return createClient();
}

function check<T>({ data, error }: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

const cleanName = (name: string) => name.trim().slice(0, 80) || "Neues Blatt";

export async function createSheet(name: string, data: unknown) {
  const supabase = await db();
  const row = check(
    await supabase.from("nochmal_sheets").insert({ name: cleanName(name), data: cleanSheet(data) }).select("id").single(),
  );
  revalidatePath(PATH);
  return row.id as string;
}

// Saved in the background while editing, so it does not revalidate the page
// (the editor keeps its own state; the list refreshes when it is opened).
export async function saveSheet(id: string, name: string, data: unknown) {
  const supabase = await db();
  check(
    await supabase
      .from("nochmal_sheets")
      .update({ name: cleanName(name), data: cleanSheet(data), updated_at: new Date().toISOString() })
      .eq("id", id),
  );
}

export async function duplicateSheet(id: string) {
  const supabase = await db();
  const source = check(await supabase.from("nochmal_sheets").select("name, data").eq("id", id).single());
  const row = check(
    await supabase
      .from("nochmal_sheets")
      .insert({ name: cleanName(`${source.name} (Kopie)`), data: cleanSheet(source.data) })
      .select("id")
      .single(),
  );
  revalidatePath(PATH);
  return row.id as string;
}

export async function deleteSheet(id: string) {
  const supabase = await db();
  check(await supabase.from("nochmal_sheets").delete().eq("id", id));
  revalidatePath(PATH);
}

const IMAGE_TYPES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

// Stores an own picture (cropped or drawn in the browser) in the user's
// folder and returns its public URL; the editor puts it into the sheet's art.
// Old pictures stay in the bucket: copies of a sheet share them.
export async function uploadSheetImage(formData: FormData): Promise<{ url: string } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte melde dich erneut an." };
  const file = formData.get("image");
  if (!(file instanceof File) || !IMAGE_TYPES[file.type] || file.size > 2_000_000) {
    return { error: "Das Bild konnte nicht verarbeitet werden." };
  }
  const supabase = await createClient();
  const path = `${user.id}/${crypto.randomUUID()}.${IMAGE_TYPES[file.type]}`;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) {
    console.error("Uploading a Noch-mal picture failed:", error);
    if (/bucket not found/i.test(error.message)) {
      return { error: "Der Bilder-Speicher fehlt in Supabase. Die Migration 20261122000000_nochmal_images.sql muss noch ausgeführt werden." };
    }
    return { error: `Hochladen fehlgeschlagen: ${error.message}` };
  }
  return { url: supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl };
}
