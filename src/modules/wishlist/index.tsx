import { ArchiveIcon, ChevronLeftIcon, ChevronRightIcon, ExternalLinkIcon, PencilIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/server";
import type { ModulePageProps } from "@/modules/registry";
import {
  createList,
  deleteList,
  deleteWish,
  markReceived,
  renewShareLink,
  unmarkReceived,
  updateList,
} from "./actions";
import { formatDate, formatPrice, joinNames, sortWishes, toWish, wishColumns, type Wish, type WishRow } from "./data";
import { FavoriteBadge } from "./favorite-badge";
import { ShareLink } from "./share-link";
import { WishEditor } from "./wish-editor";
import { WishImage } from "./wish-image";

const PATH = "/m/wishlist";

type List = { id: string; name: string; occasion_date: string | null; share_token: string };

export default async function WishlistModule({ user, hasAccess, searchParams }: ModulePageProps) {
  if (!user || !hasAccess) notFound();

  const params = await searchParams;
  const param = (key: string) => (typeof params[key] === "string" ? params[key] : undefined);
  const listId = param("list");
  const wishId = param("wish");
  // From the share target in manifest.ts (Android: "Teilen" in the Amazon app
  // → Private Lab). Apps put the link in url or text, the title in title or text.
  const shared = param("shared") ?? ([param("shared_title"), param("shared_text"), param("shared_url")].filter(Boolean).join(" ") || undefined);
  if (listId && wishId) return <WishView listId={listId} wishId={wishId} sharedText={shared?.slice(0, 3000)} />;
  if (listId) return <ListView listId={listId} />;
  if (shared) return <PickList shared={shared.slice(0, 3000)} />;
  return <Overview />;
}

// Something was shared into the app: which list should it go on?
async function PickList({ shared }: { shared: string }) {
  const supabase = await createClient();
  const { data } = await supabase.from("wishlist_lists").select("id, name").order("created_at");
  const lists = (data ?? []) as Pick<List, "id" | "name">[];
  const newWish = (id: string) => `${PATH}?list=${id}&wish=new&shared=${encodeURIComponent(shared)}`;
  if (lists.length === 1) redirect(newWish(lists[0].id));

  return (
    <div className="mx-auto max-w-2xl space-y-1.5">
      <h2 className="px-1 text-sm font-medium text-muted-foreground">Auf welche Liste?</h2>
      {lists.length === 0 ? (
        <p className="px-1 text-sm">
          Du hast noch keine Wunschliste. <Link href={PATH} className="underline">Erst eine anlegen</Link> und dann noch einmal teilen.
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {lists.map((list) => (
            <li key={list.id}>
              <Link href={newWish(list.id)} className="flex min-h-14 items-center gap-3 px-4 py-2 active:bg-accent">
                <span className="min-w-0 flex-1 truncate">{list.name}</span>
                <ChevronRightIcon className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- Overview -----------------------------------------------------------------

async function Overview() {
  const supabase = await createClient();
  const [{ data: listRows }, { data: itemRows }] = await Promise.all([
    supabase.from("wishlist_lists").select("id, name, occasion_date, share_token").order("created_at"),
    supabase.from("wishlist_items").select("list_id").is("received_at", null),
  ]);
  const lists = (listRows ?? []) as List[];
  const count = (id: string) => (itemRows ?? []).filter((row) => row.list_id === id).length;

  return (
    <div className="mx-auto max-w-2xl space-y-1.5">
      <h2 className="px-1 text-sm font-medium text-muted-foreground">Meine Wunschlisten</h2>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {lists.map((list) => (
          <li key={list.id}>
            <Link href={`${PATH}?list=${list.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 active:bg-accent">
              <span className="min-w-0 flex-1">
                <span className="block truncate">{list.name}</span>
                {list.occasion_date && (
                  <span className="block text-xs text-muted-foreground">{formatDate(list.occasion_date)}</span>
                )}
              </span>
              <span className="font-mono text-sm text-muted-foreground">{count(list.id)}</span>
              <ChevronRightIcon className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
        <li>
          <form action={createList}>
            <Input
              name="name"
              required
              maxLength={80}
              aria-label="Neue Wunschliste"
              placeholder="+ Neue Liste, z. B. Geburtstag 2026"
              enterKeyHint="enter"
              className="h-12 rounded-none border-0 px-4 shadow-none focus-visible:ring-0"
            />
          </form>
        </li>
      </ul>
    </div>
  );
}

// --- One list -------------------------------------------------------------------

type ItemRow = WishRow & { received_at: string | null; received_from: string[] };

async function ListView({ listId }: { listId: string }) {
  const supabase = await createClient();
  const [{ data: list }, { data: itemRows }] = await Promise.all([
    supabase.from("wishlist_lists").select("id, name, occasion_date, share_token").eq("id", listId).maybeSingle<List>(),
    supabase
      .from("wishlist_items")
      .select(`${wishColumns}, received_at, received_from`)
      .eq("list_id", listId)
      .order("created_at", { ascending: false }),
  ]);
  if (!list) notFound();

  const rows = (itemRows ?? []) as ItemRow[];
  const open = sortWishes(rows.filter((row) => !row.received_at).map(toWish));
  const received = rows.filter((row) => row.received_at).sort((a, b) => b.received_at!.localeCompare(a.received_at!));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="-ml-2 flex items-center gap-1">
        <Button asChild variant="ghost" size="icon" className="size-10 text-muted-foreground">
          <Link href={PATH} aria-label="Zur Übersicht">
            <ChevronLeftIcon className="size-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-semibold tracking-tight">{list.name}</h2>
          {list.occasion_date && <p className="text-sm text-muted-foreground">{formatDate(list.occasion_date)}</p>}
        </div>
      </div>

      <Button asChild size="lg" className="h-12 w-full">
        <Link href={`${PATH}?list=${list.id}&wish=new`}>
          <PlusIcon /> Wunsch hinzufügen
        </Link>
      </Button>

      {open.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">Noch keine Wünsche. Füge einen Link aus einem Shop ein.</p>
      ) : (
        <ul className="space-y-3">
          {open.map((wish) => (
            <li key={wish.id}>
              <OwnerWishCard listId={list.id} wish={wish} />
            </li>
          ))}
        </ul>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            <h3>Teilen</h3>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Wer den Link hat, sieht die Liste und kann Wünsche reservieren, ganz ohne Anmeldung. Du siehst davon nichts;
            von wem ein Geschenk kam, steht erst im Archiv, wenn du es als erhalten markierst.
          </p>
          <ShareLink token={list.share_token} title={list.name} />
        </CardContent>
      </Card>

      {received.length > 0 && (
        <section aria-labelledby="archive-title" className="space-y-1.5">
          <h3 id="archive-title" className="flex items-center gap-2 px-1 text-sm font-medium text-muted-foreground">
            <ArchiveIcon className="size-4" /> Erhalten
          </h3>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {received.map((row) => (
              <li key={row.id} className="flex items-center gap-3 px-4 py-2">
                <WishImage src={row.image_url} alt="" className="size-10 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate">{row.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.received_from.length > 0 ? `von ${joinNames(row.received_from)}` : "nicht reserviert"} ·{" "}
                    {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(row.received_at!))}
                  </p>
                </div>
                <form action={unmarkReceived}>
                  <input type="hidden" name="wishId" value={row.id} />
                  <SubmitButton variant="ghost" size="sm" className="text-muted-foreground">
                    Zurück auf die Liste
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ListSettings list={list} />
    </div>
  );
}

// No reservation status here on purpose: the owner shouldn't know what's coming.
function OwnerWishCard({ listId, wish }: { listId: string; wish: Wish }) {
  const price = formatPrice(wish.price, wish.currency);

  return (
    <div className="flex gap-3 rounded-xl border bg-card p-3 shadow-xs">
      <WishImage src={wish.imageUrl} alt="" className="size-20 shrink-0 rounded-lg sm:size-24" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1 space-y-1">
            {wish.favorite && <FavoriteBadge />}
            <p className="leading-snug font-medium">{wish.title}</p>
          </div>
          <Button asChild variant="ghost" size="icon" className="text-muted-foreground">
            <Link href={`${PATH}?list=${listId}&wish=${wish.id}`} aria-label={`${wish.title} bearbeiten`}>
              <PencilIcon />
            </Link>
          </Button>
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {price && <span className="font-mono text-foreground">{price}</span>}
          {wish.quantity > 1 && <span>{wish.quantity}×</span>}
          {wish.url && (
            <a href={wish.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
              <ExternalLinkIcon className="size-3.5" /> {new URL(wish.url).hostname.replace(/^www\./, "")}
            </a>
          )}
        </p>
        {wish.note && <p className="text-sm whitespace-pre-line text-muted-foreground">{wish.note}</p>}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <div className="ml-auto flex flex-wrap gap-1">
            <form action={markReceived}>
              <input type="hidden" name="wishId" value={wish.id} />
              <SubmitButton variant="outline" size="sm">
                Erhalten
              </SubmitButton>
            </form>
            <form action={deleteWish}>
              <input type="hidden" name="wishId" value={wish.id} />
              <SubmitButton variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                Löschen
              </SubmitButton>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Add or edit a wish -------------------------------------------------------

async function WishView({ listId, wishId, sharedText }: { listId: string; wishId: string; sharedText?: string }) {
  const supabase = await createClient();
  const { data: list } = await supabase.from("wishlist_lists").select("id").eq("id", listId).maybeSingle();
  if (!list) notFound();
  if (wishId === "new") return <WishEditor listId={listId} sharedText={sharedText} />;

  const { data: row } = await supabase
    .from("wishlist_items")
    .select(wishColumns)
    .eq("id", wishId)
    .eq("list_id", listId)
    .maybeSingle<WishRow>();
  if (!row) notFound();
  return <WishEditor key={row.id} listId={listId} wish={toWish(row)} />;
}

function ListSettings({ list }: { list: List }) {
  return (
    <details className="group rounded-xl border bg-card">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-muted-foreground">Liste bearbeiten</summary>
      <div className="space-y-4 border-t p-4">
        <form action={updateList} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="listId" value={list.id} />
          <div className="min-w-40 flex-1 space-y-2">
            <Label htmlFor="list-name">Name</Label>
            <Input id="list-name" name="name" required maxLength={80} defaultValue={list.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="list-date">Anlass am</Label>
            <Input id="list-date" name="occasionDate" type="date" defaultValue={list.occasion_date ?? ""} />
          </div>
          <SubmitButton variant="outline">Speichern</SubmitButton>
        </form>
        <div className="flex flex-wrap gap-2">
          <form action={renewShareLink}>
            <input type="hidden" name="listId" value={list.id} />
            <SubmitButton variant="outline" size="sm">
              Neuen Link erzeugen
            </SubmitButton>
          </form>
          <form action={deleteList}>
            <input type="hidden" name="listId" value={list.id} />
            <SubmitButton variant="ghost" size="sm" className="text-destructive hover:text-destructive">
              Liste löschen
            </SubmitButton>
          </form>
        </div>
        <p className="text-xs text-muted-foreground">Ein neuer Link macht den alten ungültig; Reservierungen bleiben erhalten.</p>
      </div>
    </details>
  );
}
