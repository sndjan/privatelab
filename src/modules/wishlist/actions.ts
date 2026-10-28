"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { claimNames, deleteClaims } from "./claims";
import { cleanWish, newShareToken, toRow, type WishFields } from "./data";
import { analyzeLink, type LinkResult } from "./link-import";
import { analyzeScreenshot, SCREENSHOT_TYPES, type ScreenshotResult } from "./screenshot-import";

// Lists and wishes are written with the user's own Supabase client, so RLS
// enforces ownership and access to the 'wishlist' module. Reservations need
// the secret key (see claims.ts): those actions first read the wish with the
// user's client, which only works for the owner.

const PATH = "/m/wishlist";

async function db() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  return createClient();
}

function text(formData: FormData, key: string, max: number) {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

function check<T>({ data, error }: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

function refresh(shareToken?: string) {
  revalidatePath(PATH);
  if (shareToken) revalidatePath(`/w/${shareToken}`);
}

// Returns the wish with its list's share token, or throws if it isn't the user's.
async function ownWish(supabase: Awaited<ReturnType<typeof db>>, id: string) {
  const wish = check(
    await supabase
      .from("wishlist_items")
      .select("id, list_id, image_url, wishlist_lists (share_token)")
      .eq("id", id)
      .maybeSingle<{ id: string; list_id: string; image_url: string | null; wishlist_lists: { share_token: string } }>(),
  );
  if (!wish) throw new Error("Not found");
  return { id: wish.id, listId: wish.list_id, imageUrl: wish.image_url, shareToken: wish.wishlist_lists.share_token };
}

// --- Lists ----------------------------------------------------------------------

export async function createList(formData: FormData) {
  const name = text(formData, "name", 80);
  if (!name) return;
  const supabase = await db();
  const created = check(await supabase.from("wishlist_lists").insert({ name }).select("id").single());
  revalidatePath(PATH);
  redirect(`${PATH}?list=${created.id}`);
}

export async function updateList(formData: FormData) {
  const id = String(formData.get("listId"));
  const name = text(formData, "name", 80);
  const date = text(formData, "occasionDate", 10);
  if (!name) return;
  const supabase = await db();
  const list = check(
    await supabase
      .from("wishlist_lists")
      .update({ name, occasion_date: isDate(date) ? date : null })
      .eq("id", id)
      .select("share_token")
      .single(),
  );
  refresh(list.share_token);
}

// A new token: the old link stops working, reservations stay.
export async function renewShareLink(formData: FormData) {
  const id = String(formData.get("listId"));
  const supabase = await db();
  const old = check(await supabase.from("wishlist_lists").select("share_token").eq("id", id).single());
  check(await supabase.from("wishlist_lists").update({ share_token: newShareToken() }).eq("id", id));
  refresh(old.share_token);
}

export async function deleteList(formData: FormData) {
  const supabase = await db();
  const id = String(formData.get("listId"));
  const items = check(await supabase.from("wishlist_items").select("image_url").eq("list_id", id));
  check(await supabase.from("wishlist_lists").delete().eq("id", id));
  await removeImages(supabase, items.map((item) => item.image_url));
  revalidatePath(PATH);
  redirect(PATH);
}

// --- Wishes ---------------------------------------------------------------------

// The AI costs money, so it is only for users with access to the module.
async function assertModuleAccess() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  if (user.isAdmin) return;
  const supabase = await createClient();
  const access = check(
    await supabase.from("module_access").select("module_id").eq("user_id", user.id).eq("module_id", "wishlist").maybeSingle(),
  );
  if (!access) throw new Error("No access");
}

// Fills in a wish from a shop link (or text shared with one), for the owner
// to check before saving.
export async function prefillFromLink(input: string): Promise<LinkResult | { error: string }> {
  await assertModuleAccess();
  try {
    return await analyzeLink(input.slice(0, 3000));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Der Link konnte nicht gelesen werden." };
  }
}

// Same from a screenshot, which the browser has already scaled down.
export async function prefillFromScreenshot(formData: FormData): Promise<ScreenshotResult | { error: string }> {
  await assertModuleAccess();
  const file = formData.get("screenshot");
  if (!(file instanceof File) || !(SCREENSHOT_TYPES as readonly string[]).includes(file.type) || file.size > 4_000_000) {
    return { error: "Der Screenshot konnte nicht verarbeitet werden." };
  }
  try {
    return await analyzeScreenshot(file);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Der Screenshot konnte nicht gelesen werden." };
  }
}

// --- Images -------------------------------------------------------------------

const BUCKET = "wishlist-images";
const IMAGE_TYPES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

// The storage path of an image in our bucket, or null for shop images.
function storedPath(url: string | null) {
  const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
  return url?.startsWith(prefix) ? decodeURIComponent(url.slice(prefix.length)) : null;
}

async function removeImages(supabase: Awaited<ReturnType<typeof db>>, urls: (string | null)[]) {
  const paths = urls.map(storedPath).filter((path): path is string => path !== null);
  // A file left behind is harmless, so a failed cleanup doesn't fail the action.
  if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths);
}

// Stores a cropped image (made in the browser) in the user's folder and
// returns its public URL. Storage policies check the folder and module access.
export async function uploadWishImage(formData: FormData): Promise<{ url: string } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  const file = formData.get("image");
  if (!(file instanceof File) || !IMAGE_TYPES[file.type] || file.size > 2_000_000) {
    return { error: "Das Bild konnte nicht verarbeitet werden." };
  }
  const supabase = await createClient();
  const path = `${user.id}/${crypto.randomUUID()}.${IMAGE_TYPES[file.type]}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) return { error: `Hochladen fehlgeschlagen: ${error.message}` };
  return { url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
}

// --- Saving -------------------------------------------------------------------

// input comes straight from the form (price as typed, e.g. "29,99").
// Goes back to the list afterwards.
export async function saveWish(listId: string, id: string | null, input: WishFields) {
  const wish = cleanWish(input);
  if (!wish) throw new Error("Titel fehlt");
  const supabase = await db();
  if (id) {
    const own = await ownWish(supabase, id);
    check(await supabase.from("wishlist_items").update(toRow(wish)).eq("id", id));
    if (own.imageUrl !== wish.imageUrl) await removeImages(supabase, [own.imageUrl]);
    refresh(own.shareToken);
  } else {
    check(await supabase.from("wishlist_items").insert({ ...toRow(wish), list_id: listId }));
    const list = check(await supabase.from("wishlist_lists").select("share_token").eq("id", listId).single());
    refresh(list.share_token);
  }
  redirect(`${PATH}?list=${listId}`);
}

export async function setFavorite(id: string, favorite: boolean) {
  const supabase = await db();
  const own = await ownWish(supabase, id);
  check(await supabase.from("wishlist_items").update({ favorite }).eq("id", id));
  refresh(own.shareToken);
}

// Reservations go with it; the owner isn't told about them.
export async function deleteWish(formData: FormData) {
  const supabase = await db();
  const own = await ownWish(supabase, String(formData.get("wishId")));
  check(await supabase.from("wishlist_items").delete().eq("id", own.id));
  await removeImages(supabase, [own.imageUrl]);
  refresh(own.shareToken);
}

// Archives the wish and reveals who reserved it.
export async function markReceived(formData: FormData) {
  const supabase = await db();
  const own = await ownWish(supabase, String(formData.get("wishId")));
  const names = await claimNames(own.id);
  check(
    await supabase
      .from("wishlist_items")
      .update({ received_at: new Date().toISOString(), received_from: names })
      .eq("id", own.id),
  );
  await deleteClaims(own.id);
  refresh(own.shareToken);
}

// Back onto the list (without its old reservations).
export async function unmarkReceived(formData: FormData) {
  const supabase = await db();
  const own = await ownWish(supabase, String(formData.get("wishId")));
  check(await supabase.from("wishlist_items").update({ received_at: null, received_from: [] }).eq("id", own.id));
  refresh(own.shareToken);
}
