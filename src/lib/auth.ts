import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  isAdmin: boolean;
};

// Returns the signed-in user with their profile, or null.
export async function getCurrentUser(): Promise<CurrentUser | null> {
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
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (!user.isAdmin) redirect("/dashboard");
  return user;
}

// Only allow relative redirects within the app.
export function safeNext(next: string | null | undefined, fallback = "/dashboard") {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
