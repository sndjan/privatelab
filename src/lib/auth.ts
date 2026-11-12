import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  isAdmin: boolean;
};

// Returns the signed-in user with their profile, or null. Cached per request,
// so the header and the page share one lookup.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, is_admin")
    .eq("id", userId)
    .single();

  return {
    id: userId,
    email: profile?.email ?? data.claims.email ?? "",
    isAdmin: profile?.is_admin ?? false,
  };
});

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (!user.isAdmin) redirect("/dashboard");
  return user;
}

// True for admins and users with a module_access row. For server actions that
// cost money (AI requests) or use the secret key: RLS protects the data, but
// not those.
export async function hasModuleAccess(user: CurrentUser, moduleId: string) {
  if (user.isAdmin) return true;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("module_access")
    .select("module_id")
    .eq("user_id", user.id)
    .eq("module_id", moduleId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

// Only allow relative redirects within the app. The value is resolved the way
// a browser would: "/\\evil.com" and "/<tab>/evil.com" both start with one
// slash but lead to another site, so the string alone can't be trusted.
export function safeNext(next: string | null | undefined, fallback = "/dashboard") {
  if (!next || !next.startsWith("/")) return fallback;
  const base = "http://internal.invalid";
  try {
    const url = new URL(next, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
