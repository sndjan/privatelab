import { ArrowUpRightIcon, LayoutGridIcon, LogInIcon, MenuIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BTV_URL, MAPS_URL, type News } from "./data";
import { ColorSwitch } from "./shell";

// Shared parts of the club site: links between its pages, the banner above
// the header, the header with its menu and the footer.

export const BASE = "/m/tvb";

export type PageId = "start" | "aktuelles" | "mannschaften" | "verein" | "mitglied" | "login" | "admin";

export function href(seite: PageId = "start", params: Record<string, string> = {}, hash?: string) {
  const query = new URLSearchParams(seite === "start" ? params : { seite, ...params }).toString();
  return `${BASE}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}

export const display = "font-[family-name:var(--font-tvb-display)] font-extrabold uppercase";
export const container = "mx-auto w-full max-w-[1240px] px-4 sm:px-8 lg:px-12";

export const buttons = {
  primary:
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-(--tvb-primary) px-6 font-bold text-white transition hover:brightness-110",
  light: "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 font-bold text-(--tvb-primary) transition hover:bg-white/90",
  outlineLight:
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-white/80 px-6 font-bold text-white transition hover:bg-white/10",
  outline:
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-(--tvb-ink) px-6 font-bold transition hover:bg-black/5",
};

export function SectionTitle({ eyebrow, title, className, light }: { eyebrow: string; title: string; className?: string; light?: boolean }) {
  return (
    <div className={className}>
      <span className={cn("text-[13px] font-bold tracking-[0.12em] uppercase", light ? "opacity-85" : "text-(--tvb-primary)")}>{eyebrow}</span>
      <h2 className={cn(display, "mt-1.5 text-[40px] leading-none sm:text-[56px]")}>{title}</h2>
    </div>
  );
}

export function Banner({ news }: { news: News | undefined }) {
  return (
    <div className="bg-(--tvb-deep) text-[13px] text-white">
      <div className={cn(container, "flex min-h-10 flex-wrap items-center justify-between gap-x-6 gap-y-1 py-2")}>
        {news ? (
          <Link href={href("aktuelles", { id: news.id })} className="flex items-center gap-2 hover:underline">
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-[#f2b33d]" />
            {news.title}
          </Link>
        ) : (
          <span className="opacity-80">Tennisverein Bellenberg e.V. · seit 1978</span>
        )}
        <span className="hidden items-center gap-6 opacity-90 md:flex">
          <a href={BTV_URL} target="_blank" rel="noreferrer" className="hover:underline">
            BTV-Vereinsseite
          </a>
          <Link href={href("verein", {}, "kontakt")} className="hover:underline">
            Kontakt
          </Link>
          <Link href={href("login")} className="flex items-center gap-1.5 hover:underline">
            <LogInIcon className="size-3.5" />
            Login
          </Link>
        </span>
      </div>
    </div>
  );
}

const navItems: { label: string; page: PageId; hash?: string }[] = [
  { label: "Aktuelles", page: "aktuelles" },
  { label: "Mannschaften", page: "mannschaften" },
  { label: "Jugend & Training", page: "start", hash: "jugend" },
  { label: "Verein", page: "verein" },
  { label: "Kontakt", page: "verein", hash: "kontakt" },
];

export function Header({ current }: { current: PageId }) {
  return (
    <header className="sticky top-0 z-10 border-b border-(--tvb-line) bg-white">
      <div className={cn(container, "flex items-center justify-between gap-4 py-3")}>
        <Link href={href()} className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tvb/wappen.png" alt="" className="h-11 w-auto sm:h-13" />
          <span className="flex flex-col leading-none">
            <span className={cn(display, "text-2xl tracking-wide text-(--tvb-primary) sm:text-[28px]")}>TV Bellenberg</span>
            <span className="mt-1 text-xs text-(--tvb-muted)">Tennisverein seit 1978</span>
          </span>
        </Link>

        <nav aria-label="Hauptmenü" className="hidden items-center gap-6 text-[15px] font-semibold lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={href(item.page, {}, item.hash)}
              aria-current={current === item.page && !item.hash ? "page" : undefined}
              className="border-b-[3px] border-transparent py-1 hover:text-(--tvb-primary) aria-[current=page]:border-(--tvb-primary) aria-[current=page]:text-(--tvb-primary)"
            >
              {item.label}
            </Link>
          ))}
          <Link href={href("mitglied")} className={cn(buttons.primary, "min-h-11 px-5 text-[15px]")}>
            Mitglied werden
          </Link>
          <BackToLab />
        </nav>

        {/* Phones: the menu opens below the header, without JavaScript. */}
        <details className="group lg:hidden">
          <summary
            aria-label="Menü"
            className="flex size-12 cursor-pointer list-none items-center justify-center rounded-xl border border-(--tvb-line) text-(--tvb-primary) [&::-webkit-details-marker]:hidden"
          >
            <MenuIcon className="size-6" />
          </summary>
          <nav
            aria-label="Hauptmenü"
            className="absolute inset-x-0 top-full flex flex-col gap-1 border-b border-(--tvb-line) bg-white px-4 pt-2 pb-4 text-lg font-semibold shadow-lg"
          >
            {navItems.map((item) => (
              <Link key={item.label} href={href(item.page, {}, item.hash)} className="rounded-lg px-3 py-3 hover:bg-(--tvb-soft)">
                {item.label}
              </Link>
            ))}
            <Link href={href("mitglied")} className={cn(buttons.primary, "mt-2")}>
              Mitglied werden
            </Link>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-(--tvb-line) pt-3 text-base">
              <Link href={href("login")} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-(--tvb-muted)">
                <LogInIcon className="size-4" />
                Login
              </Link>
              <BackToLab />
            </div>
          </nav>
        </details>
      </div>
    </header>
  );
}

// Not part of the real site: the way back into Private Lab.
function BackToLab() {
  return (
    <Link
      href="/dashboard"
      title="Zurück zu Private Lab"
      className="flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-(--tvb-muted)/60 px-3.5 text-sm font-semibold text-(--tvb-muted) hover:border-(--tvb-ink) hover:text-(--tvb-ink)"
    >
      <LayoutGridIcon className="size-4" />
      Private Lab
    </Link>
  );
}

export function Footer() {
  return (
    <footer id="kontakt-footer" className="bg-(--tvb-deep) text-white">
      <div className={cn(container, "pt-16 pb-8")}>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-3.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/tvb/wappen.png" alt="Wappen TV Bellenberg" className="h-18 w-auto self-start" />
            <p className="text-[15px] leading-relaxed opacity-85">
              Tennisverein Bellenberg e.V. – seit 1978 Tennis für alle Generationen im Landkreis Neu-Ulm.
            </p>
          </div>
          <FooterColumn title="Anlage">
            <span>TV Bellenberg</span>
            <span>An der Staig 13</span>
            <span>89287 Bellenberg</span>
            <a href={MAPS_URL} target="_blank" rel="noreferrer" className="underline">
              Route planen
            </a>
          </FooterColumn>
          <FooterColumn title="Kontakt">
            <a href="mailto:info@tv-bellenberg.de" className="hover:underline">
              info@tv-bellenberg.de
            </a>
            <a href="mailto:vorstand@tv-bellenberg.de" className="hover:underline">
              vorstand@tv-bellenberg.de
            </a>
            <Link href={href("verein", {}, "vorstand")} className="hover:underline">
              Vorstandschaft &amp; Ansprechpartner
            </Link>
          </FooterColumn>
          <FooterColumn title="Links">
            <a href={BTV_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline">
              BTV-Vereinsseite <ArrowUpRightIcon className="size-3.5" />
            </a>
            <Link href={href("mannschaften")} className="hover:underline">
              Mannschaften &amp; Ligen
            </Link>
            <Link href={href("verein", {}, "dokumente")} className="hover:underline">
              Satzung &amp; Rundschreiben
            </Link>
            <a href="http://www.gemeinde-bellenberg.de/" target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline">
              Gemeinde Bellenberg <ArrowUpRightIcon className="size-3.5" />
            </a>
          </FooterColumn>
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-white/20 pt-6 text-sm">
          <span className="opacity-80">© 2026 TV Bellenberg e.V.</span>
          <span className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <span className="rounded-md border border-dashed border-white/40 px-2 py-1 text-xs tracking-wide uppercase opacity-80">Prototyp</span>
            <ColorSwitch />
            <a href="https://tv-bellenberg.de/impressum/" target="_blank" rel="noreferrer" className="opacity-80 hover:underline">
              Impressum
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 text-[15px]">
      <span className="text-[13px] font-bold tracking-widest uppercase opacity-70">{title}</span>
      {children}
    </div>
  );
}
