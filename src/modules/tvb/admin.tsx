/* eslint-disable @next/next/no-img-element -- photos are small files in public/tvb */
import { CheckCircle2Icon, EyeIcon, LogInIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { deleteNews, saveNews } from "./actions";
import { categories, formatDate, photo, photoKeys, photos, type News } from "./data";
import { buttons, container, display, href } from "./site";
import { Submit } from "./submit";

// The club site's admin area. Signing in uses the Private Lab account (magic
// link); everyone with access to the module may edit the news.

export function LoginPage({ signedIn }: { signedIn: boolean }) {
  const next = href("admin");
  return (
    <section className={cn(container, "flex justify-center py-20")}>
      <div className="w-full max-w-[460px] rounded-[20px] border border-(--tvb-line) bg-white p-8 text-center shadow-[0_10px_30px_rgba(16,24,20,.08)]">
        <img src="/tvb/wappen.png" alt="" className="mx-auto mb-5 h-20 w-auto" />
        <h1 className={cn(display, "text-[40px] leading-none")}>Admin-Login</h1>
        {signedIn ? (
          <>
            <p className="mt-3 mb-6 leading-relaxed text-[#4a504c]">
              Du bist angemeldet, hast aber keinen Zugriff auf die Verwaltung dieser Seite. Den gibt der Admin von Private Lab frei.
            </p>
            <Link href={href()} className={cn(buttons.outline, "w-full")}>
              Zur Startseite
            </Link>
          </>
        ) : (
          <>
            <p className="mt-3 mb-6 leading-relaxed text-[#4a504c]">
              Hier pflegt der Vorstand News, Hinweise und Termine. Die Anmeldung läuft über einen Link per E-Mail, ohne Passwort.
            </p>
            <Link href={`/login?next=${encodeURIComponent(next)}`} className={cn(buttons.primary, "w-full")}>
              <LogInIcon className="size-4.5" /> Mit E-Mail anmelden
            </Link>
          </>
        )}
      </div>
    </section>
  );
}

export function AdminPage({ news, editing, saved }: { news: News[]; editing: string | undefined; saved: boolean }) {
  const current = editing && editing !== "neu" ? news.find((item) => item.id === editing) : undefined;
  const showForm = editing === "neu" || Boolean(current);
  return (
    <section className={cn(container, "py-10")}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-[13px] font-bold tracking-[0.12em] text-(--tvb-primary) uppercase">Verwaltung</span>
          <h1 className={cn(display, "text-[44px] leading-none")}>News &amp; Hinweise</h1>
        </div>
        {!showForm && (
          <Link href={href("admin", { bearbeiten: "neu" })} className={buttons.primary}>
            <PlusIcon className="size-4.5" /> Neue Meldung
          </Link>
        )}
      </div>

      {saved && !showForm && (
        <p role="status" className="mb-6 flex items-center gap-2 rounded-xl bg-(--tvb-soft) px-4 py-3 font-semibold text-(--tvb-primary)">
          <CheckCircle2Icon className="size-5" /> Gespeichert. Die Seite zeigt die Änderung sofort.
        </p>
      )}

      {showForm ? <NewsForm news={current} /> : <NewsTable news={news} />}
    </section>
  );
}

function NewsTable({ news }: { news: News[] }) {
  if (news.length === 0) {
    return <p className="rounded-2xl border border-dashed border-(--tvb-line) bg-white p-8 text-center text-(--tvb-muted)">Noch keine Meldungen.</p>;
  }
  return (
    <ul className="divide-y divide-(--tvb-line) overflow-hidden rounded-2xl border border-(--tvb-line) bg-white">
      {news.map((item) => {
        const image = photo(item.image);
        return (
          <li key={item.id} className="flex flex-wrap items-center gap-4 p-4">
            {image ? (
              <img src={image.src} alt="" className="h-14 w-20 shrink-0 rounded-lg object-cover" />
            ) : (
              <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-(--tvb-soft)">
                <img src="/tvb/wappen.png" alt="" className="h-9 w-auto" />
              </span>
            )}
            <div className="min-w-0 flex-1 basis-60">
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-(--tvb-muted)">
                {formatDate(item.publishedOn)} · {item.category}
                {!item.published && <span className="rounded bg-[#f0efea] px-1.5 py-0.5 font-bold text-[#333833]">Entwurf</span>}
                {item.showBanner && <span className="rounded bg-[#fdf1d6] px-1.5 py-0.5 font-bold text-[#7a5300]">Hinweisleiste</span>}
              </div>
              <div className="truncate font-bold">{item.title}</div>
            </div>
            <div className="flex gap-2">
              <Link
                href={href("aktuelles", { id: item.id })}
                aria-label={`„${item.title}“ ansehen`}
                className="flex size-11 items-center justify-center rounded-full border border-(--tvb-line) hover:bg-(--tvb-soft)"
              >
                <EyeIcon className="size-4.5" />
              </Link>
              <Link
                href={href("admin", { bearbeiten: item.id })}
                className="flex min-h-11 items-center gap-1.5 rounded-full border border-(--tvb-line) px-4 font-semibold hover:bg-(--tvb-soft)"
              >
                <PencilIcon className="size-4" /> Bearbeiten
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const field = "min-h-12 w-full rounded-xl border-[1.5px] border-[#d6d4cc] bg-white px-3.5 text-base outline-none focus:border-(--tvb-primary)";
const label = "text-sm font-semibold";

function NewsForm({ news }: { news: News | undefined }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="flex flex-col gap-6">
      <form action={saveNews} className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex flex-[2] flex-col gap-5 rounded-2xl border border-(--tvb-line) bg-white p-6">
        {news && <input type="hidden" name="id" value={news.id} />}
        <label className="flex flex-col gap-1.5">
          <span className={label}>Titel</span>
          <input name="title" required maxLength={160} defaultValue={news?.title} className={field} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={label}>Datum</span>
            <input type="date" name="publishedOn" defaultValue={news?.publishedOn ?? today} className={field} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={label}>Kategorie</span>
            <select name="category" defaultValue={news?.category ?? "Verein"} className={field}>
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className={cn(label, "mb-1.5")}>Titelbild</legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <ImageChoice value="" checked={!news?.image}>
              <span className="flex size-full items-center justify-center bg-(--tvb-soft) text-xs font-semibold text-(--tvb-muted)">Kein Bild</span>
            </ImageChoice>
            {photoKeys.map((key) => (
              <ImageChoice key={key} value={key} checked={news?.image === key}>
                <img src={photos[key].src} alt={photos[key].alt} className="size-full object-cover" />
              </ImageChoice>
            ))}
          </div>
          <span className="text-xs text-(--tvb-muted)">Im Prototyp aus den vorhandenen Fotos. Später: eigenes Bild hochladen.</span>
        </fieldset>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Kurztext für die Übersicht</span>
          <textarea name="teaser" rows={2} maxLength={400} defaultValue={news?.teaser} className={cn(field, "py-3")} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Text</span>
          <textarea name="body" rows={10} maxLength={20000} defaultValue={news?.body} className={cn(field, "py-3 leading-relaxed")} />
          <span className="text-xs text-(--tvb-muted)">Eine Leerzeile beginnt einen neuen Absatz.</span>
        </label>
      </div>

      <aside className="flex flex-1 flex-col gap-4 lg:sticky lg:top-24">
        <div className="flex flex-col gap-3 rounded-2xl border border-(--tvb-line) bg-white p-5">
          <span className="font-bold">Veröffentlichung</span>
          <Toggle name="published" defaultChecked={news?.published ?? true}>
            Veröffentlicht
          </Toggle>
          <Toggle name="showBanner" defaultChecked={news?.showBanner ?? false}>
            Als Hinweisleiste oben zeigen
          </Toggle>
          <Submit className={cn(buttons.primary, "mt-2 w-full")}>{news ? "Speichern" : "Veröffentlichen"}</Submit>
          <Link href={href("admin")} className={cn(buttons.outline, "w-full border-[1.5px] border-[#cfcdc4]")}>
            Abbrechen
          </Link>
        </div>
      </aside>
      </form>
        {news && (
          <details className="self-start rounded-2xl border border-(--tvb-line) bg-white p-5">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold text-[#a8272a]">
              <Trash2Icon className="size-4" /> Meldung löschen …
            </summary>
            <form action={deleteNews} className="mt-3 flex flex-col gap-3">
              <input type="hidden" name="id" value={news.id} />
              <p className="text-sm text-[#4a504c]">Die Meldung ist danach weg und lässt sich nicht wiederherstellen.</p>
              <Submit className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#a8272a] px-5 font-bold text-white">
                Endgültig löschen
              </Submit>
            </form>
          </details>
        )}
    </div>
  );
}

function ImageChoice({ value, checked, children }: { value: string; checked: boolean; children: React.ReactNode }) {
  return (
    <label className="relative aspect-[4/3] cursor-pointer overflow-hidden rounded-lg ring-(--tvb-primary) has-checked:ring-4">
      <input type="radio" name="image" value={value} defaultChecked={checked} className="peer sr-only" />
      {children}
    </label>
  );
}

function Toggle({ name, defaultChecked, children }: { name: string; defaultChecked: boolean; children: React.ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
      <span>{children}</span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-5.5 accent-(--tvb-primary)" />
    </label>
  );
}
