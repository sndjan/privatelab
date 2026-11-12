"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { categories, photoKeys, type Category } from "./data";

// Writes go through the user's own Supabase client: RLS only lets users with
// access to the module (the site's admins) change news.

const PATH = "/m/tvb";

async function db() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  return createClient();
}

function text(formData: FormData, name: string, max: number) {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

export async function saveNews(formData: FormData) {
  const supabase = await db();
  const id = text(formData, "id", 40);
  const title = text(formData, "title", 160);
  if (!title) throw new Error("Titel fehlt");

  const category = text(formData, "category", 20);
  const image = text(formData, "image", 40);
  const date = text(formData, "publishedOn", 10);
  const row = {
    title,
    category: (categories as readonly string[]).includes(category) ? (category as Category) : "Verein",
    published_on: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10),
    teaser: text(formData, "teaser", 400),
    body: text(formData, "body", 20000),
    image: (photoKeys as string[]).includes(image) ? image : null,
    published: formData.get("published") === "on",
    show_banner: formData.get("showBanner") === "on",
    updated_at: new Date().toISOString(),
  };

  // Only one news item can be the banner above the header.
  if (row.show_banner) {
    const others = supabase.from("tvb_news").update({ show_banner: false }).eq("show_banner", true);
    const { error } = id ? await others.neq("id", id) : await others;
    if (error) throw new Error(error.message);
  }

  const { error } = id
    ? await supabase.from("tvb_news").update(row).eq("id", id)
    : await supabase.from("tvb_news").insert(row);
  if (error) throw new Error(error.message);

  revalidatePath(PATH);
  redirect(`${PATH}?seite=admin&gespeichert=1`);
}

export async function deleteNews(formData: FormData) {
  const supabase = await db();
  const id = text(formData, "id", 40);
  const { error } = await supabase.from("tvb_news").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
  redirect(`${PATH}?seite=admin`);
}
