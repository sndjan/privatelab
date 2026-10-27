import { ExternalLinkIcon, StarIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { deviceHash, guestClaims, guestName } from "./claims";
import { formatDate, formatPrice, sortWishes, toWish, wishColumns, type WishRow } from "./data";
import { GuestButtons } from "./guest-buttons";
import { WishImage } from "./wish-image";

const isId = (value: string) => /^[0-9a-f-]{36}$/i.test(value);

type PublicListRow = { id: string; user_id: string; name: string; occasion_date: string | null };

// Loaded with the secret key: the share token is the only way in.
export async function loadPublicList(token: string) {
  if (!isId(token)) return null;
  const { data } = await createAdminClient()
    .from("wishlist_lists")
    .select("id, user_id, name, occasion_date")
    .eq("share_token", token)
    .maybeSingle<PublicListRow>();
  return data;
}

// The share page /w/<token>: everyone with the link can reserve wishes
// without an account. Wishes nobody can take any more move to the bottom.
export async function PublicList({ token }: { token: string }) {
  const list = await loadPublicList(token);
  if (!list) notFound();

  const { data: rows, error } = await createAdminClient()
    .from("wishlist_items")
    .select(wishColumns)
    .eq("list_id", list.id)
    .is("received_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const [user, device, savedName] = await Promise.all([getCurrentUser(), deviceHash(), guestName()]);
  const isOwner = user?.id === list.user_id;
  const wishes = sortWishes(((rows ?? []) as WishRow[]).map(toWish));
  const claims = await guestClaims(wishes.map((wish) => wish.id), device);
  const free = (id: string, quantity: number) => Math.max(0, quantity - (claims.get(id)?.length ?? 0));
  const ordered = [...wishes.filter((wish) => free(wish.id, wish.quantity) > 0), ...wishes.filter((wish) => free(wish.id, wish.quantity) === 0)];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{list.name}</h1>
        {list.occasion_date && <p className="text-muted-foreground">{formatDate(list.occasion_date)}</p>}
      </div>

      {isOwner ? (
        <p className="rounded-lg border border-brand/30 bg-brand/5 px-4 py-3 text-sm">
          Das ist deine Liste, so sehen sie deine Gäste. Wer was reserviert hat, bleibt für dich verborgen.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Reserviere, was du schenken möchtest, damit nichts doppelt kommt. Eine Anmeldung brauchst du nicht; dein Browser
          merkt sich deine Reservierungen.
        </p>
      )}

      {ordered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">Auf dieser Liste steht gerade nichts.</p>
      ) : (
        <ul className="space-y-3">
          {ordered.map((wish) => {
            const price = formatPrice(wish.price, wish.currency);
            const left = free(wish.id, wish.quantity);
            const wishClaims = claims.get(wish.id) ?? [];
            return (
              <li key={wish.id} className={cn("flex gap-3 rounded-xl border bg-card p-3 shadow-xs", left === 0 && !wishClaims.some((claim) => claim.mine) && "opacity-60")}>
                <WishImage src={wish.imageUrl} alt="" className="size-20 shrink-0 rounded-lg sm:size-28" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="leading-snug font-medium">
                    {wish.favorite && (
                      <StarIcon aria-label="Herzenswunsch" className="mr-1 inline size-4 -translate-y-px fill-amber-400 text-amber-500" />
                    )}
                    {wish.title}
                  </p>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    {price && <span className="font-mono text-foreground">{price}</span>}
                    {wish.quantity > 1 && <span>{left === 0 ? `alle ${wish.quantity} vergeben` : `noch ${left} von ${wish.quantity}`}</span>}
                    {wish.url && (
                      <a href={wish.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:text-foreground hover:underline">
                        <ExternalLinkIcon className="size-3.5" /> Zum Shop
                      </a>
                    )}
                  </p>
                  {wish.note && <p className="text-sm whitespace-pre-line text-muted-foreground">{wish.note}</p>}
                  <div className="pt-1">
                    <GuestButtons
                      token={token}
                      wishId={wish.id}
                      title={wish.title}
                      claims={wishClaims}
                      free={left}
                      savedName={savedName}
                      readOnly={isOwner}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
