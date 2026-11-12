/* eslint-disable @next/next/no-img-element -- photos are small files in public/tvb */
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ClipboardCheckIcon,
  MapPinIcon,
  TrophyIcon,
  UserPlusIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BTV_URL, documents, MAPS_URL, photos, seasons, sponsors, trainers, type News } from "./data";
import { NewsCard } from "./news";
import { buttons, container, display, href, SectionTitle } from "./site";
import { MembershipCards } from "./membership";

export function HomePage({ news }: { news: News[] }) {
  return (
    <>
      <Hero />
      <QuickLinks />
      <LatestNews news={news.slice(0, 3)} />
      <TeamsTeaser />
      <Youth />
      <section className={cn(container, "py-24")}>
        <div className="mx-auto mb-9 max-w-[680px] text-center">
          <SectionTitle eyebrow="Mitgliedschaft" title="Werde Teil vom TVB" />
          <p className="mt-3.5 text-[17px] leading-relaxed text-[#4a504c]">
            Erst mal reinschnuppern oder gleich richtig dabei sein – die Anträge gibt es direkt hier.
          </p>
        </div>
        <MembershipCards />
      </section>
      <Sponsors />
    </>
  );
}

function Hero() {
  return (
    <section className="relative flex min-h-[620px] items-end overflow-hidden bg-(--tvb-deep) lg:min-h-[640px]">
      <img src={photos.vereinsheim.src} alt={photos.vereinsheim.alt} className="absolute inset-0 size-full object-cover object-[center_45%]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.15)_0%,rgba(0,0,0,.45)_40%,rgba(0,0,0,.8)_100%)]" />
      <div className={cn(container, "relative pb-28 text-white lg:pb-36")}>
        <span className="inline-block rounded-md bg-(--tvb-primary) px-3.5 py-2 text-[13px] font-bold tracking-[0.12em] uppercase">
          Tennis im Landkreis Neu-Ulm
        </span>
        <h1 className={cn(display, "mt-5 mb-4 max-w-[900px] text-[54px] leading-[0.92] lg:text-[96px]")}>
          Tennis in Bellenberg.
          <br />
          Seit 1978.
        </h1>
        <p className="mb-7 max-w-[560px] text-lg leading-relaxed text-white/90 lg:text-[19px]">
          Sandplätze, Clubhaus und ein Verein, in dem Jugend, Mannschaften und Hobbyspieler zusammen auf dem Platz stehen.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={href("mitglied")} className={buttons.light}>
            Schnuppermitglied werden <ArrowRightIcon className="size-4.5" />
          </Link>
          <Link href={href("mannschaften")} className={buttons.outlineLight}>
            Mannschaften &amp; Spielplan
          </Link>
        </div>
      </div>
    </section>
  );
}

type Quick = { label: string; hint: string; icon: LucideIcon; to: string; external?: boolean };

const quickLinks: Quick[] = [
  { label: "BTV-Vereinsseite", hint: "Tabellen & Ergebnisse", icon: TrophyIcon, to: BTV_URL, external: true },
  { label: "Spielplan Winter", hint: "2026/27 · PDF", icon: CalendarDaysIcon, to: documents.spielplan, external: true },
  { label: "Jugendtraining", hint: "Winterplan · PDF", icon: UsersIcon, to: documents.jugendtraining, external: true },
  { label: "Mitglied werden", hint: "Anträge & Beiträge", icon: UserPlusIcon, to: href("mitglied") },
  { label: "Stammtisch", hint: "Termine 2026", icon: ClipboardCheckIcon, to: href("verein", {}, "stammtisch") },
  { label: "Anfahrt", hint: "An der Staig 13", icon: MapPinIcon, to: MAPS_URL, external: true },
];

function QuickLinks() {
  return (
    <section aria-label="Schnellzugriff" className={cn(container, "relative z-[1] -mt-16 lg:-mt-22")}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {quickLinks.map(({ label, hint, icon: Icon, to, external }) => {
          const content = (
            <>
              <span className="flex size-11 items-center justify-center rounded-xl bg-(--tvb-soft) text-(--tvb-primary)">
                <Icon className="size-6" strokeWidth={2} />
              </span>
              <span className="text-base leading-tight font-bold">
                {label} {external && <span className="text-(--tvb-muted)">↗</span>}
              </span>
              <span className="-mt-2 text-[13px] text-(--tvb-muted)">{hint}</span>
            </>
          );
          const className =
            "flex min-h-[120px] flex-col gap-3.5 rounded-2xl bg-white p-5 shadow-[0_10px_30px_rgba(16,24,20,.10)] transition hover:-translate-y-0.5";
          return external ? (
            <a key={label} href={to} target="_blank" rel="noreferrer" className={className}>
              {content}
            </a>
          ) : (
            <Link key={label} href={to} className={className}>
              {content}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function LatestNews({ news }: { news: News[] }) {
  return (
    <section className={cn(container, "pt-24 pb-8")}>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <SectionTitle eyebrow="Nichts verpassen" title="Aktuelles" />
        <Link href={href("aktuelles")} className="flex min-h-11 items-center gap-1.5 font-bold text-(--tvb-primary)">
          Alle Meldungen <ArrowRightIcon className="size-4.5" />
        </Link>
      </div>
      {news.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {news.map((item) => (
            <NewsCard key={item.id} news={item} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-(--tvb-line) p-8 text-center text-(--tvb-muted)">Noch keine Meldungen.</p>
      )}
    </section>
  );
}

function TeamsTeaser() {
  const current = seasons[0];
  return (
    <section className={cn(container, "py-20")}>
      <SectionTitle eyebrow="Spielbetrieb" title="Unsere Mannschaften" className="mb-7" />
      <div className="flex flex-col gap-6 lg:flex-row">
        <Link href={href("mannschaften", { saison: "sommer-2026" })} className="relative flex min-h-[420px] flex-1 items-end overflow-hidden rounded-[20px] bg-(--tvb-deep)">
          <img src={photos.damen.src} alt={photos.damen.alt} className="absolute inset-0 h-[118%] w-full object-cover object-top" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_45%,rgba(0,0,0,.75)_100%)]" />
          <div className="relative p-7 text-white">
            <span className="text-[13px] font-bold tracking-[0.1em] uppercase opacity-90">Meister Südliga 2</span>
            <div className={cn(display, "text-[40px] leading-tight")}>Damen I</div>
          </div>
        </Link>
        <div className="flex-[1.15] rounded-[20px] border border-(--tvb-line) bg-white px-7 py-2">
          <div className="flex flex-wrap gap-2 pt-4 pb-2.5">
            {seasons.map((season, index) => (
              <Link
                key={season.id}
                href={href("mannschaften", { saison: season.id })}
                className={cn(
                  "flex min-h-11 items-center rounded-full px-4 text-sm font-semibold",
                  index === 0 ? "bg-(--tvb-primary) font-bold text-white" : "bg-[#f0efea] text-[#333833]",
                )}
              >
                {season.name}
              </Link>
            ))}
          </div>
          {current.teams.map((team) => (
            <a
              key={team.name}
              href={BTV_URL}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center justify-between gap-4 border-t border-[#eceae3] py-4.5"
            >
              <span className="flex flex-col gap-1">
                <span className="text-lg font-bold">{team.name}</span>
                <span className="text-sm text-(--tvb-muted)">
                  {team.league} · Gruppe {team.group}
                </span>
              </span>
              <span className="text-sm font-bold whitespace-nowrap text-(--tvb-primary)">Tabelle ↗</span>
            </a>
          ))}
          <Link href={href("mannschaften")} className="flex justify-center border-t border-[#eceae3] py-4.5 font-bold text-(--tvb-primary)">
            Alle Mannschaften &amp; Ligen
          </Link>
        </div>
      </div>
    </section>
  );
}

function Youth() {
  return (
    <section id="jugend" className="scroll-mt-20 bg-(--tvb-primary) text-white">
      <div className={cn(container, "flex flex-col gap-14 py-22 lg:flex-row lg:items-center")}>
        <div className="flex-1">
          <SectionTitle eyebrow="Jugend & Training" title="Vom ersten Ballwechsel bis zur Medenrunde" light />
          <p className="mt-4.5 mb-6 text-[17px] leading-relaxed opacity-90">
            Gruppentraining, Tenniscamp im Sommer und Ausflüge zu den großen Turnieren wie den BMW Open: Unser Trainerteam begleitet Kinder und
            Jugendliche auf jedem Level.
          </p>
          <ul className="mb-7 flex flex-wrap gap-2" aria-label="Trainerteam">
            {trainers.map((name) => (
              <li key={name} className="rounded-full border border-white/45 px-3.5 py-2 text-sm">
                {name}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <a href={documents.jugendtraining} target="_blank" rel="noreferrer" className={buttons.light}>
              Trainingsplan Winter
            </a>
            <a href="mailto:jugendwart@tv-bellenberg.de" className={buttons.outlineLight}>
              Probetraining anfragen
            </a>
          </div>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-3">
          <img src={photos.u18.src} alt={photos.u18.alt} className="col-span-2 h-[300px] w-full rounded-[18px] object-cover object-[center_25%]" />
          <img src={photos.ausflug.src} alt={photos.ausflug.alt} className="h-[190px] w-full rounded-[18px] object-cover" />
          <img src={photos.tenniscamp.src} alt={photos.tenniscamp.alt} className="h-[190px] w-full rounded-[18px] object-cover" />
        </div>
      </div>
    </section>
  );
}

function Sponsors() {
  return (
    <section className="border-y border-(--tvb-line) bg-white">
      <div className={cn(container, "py-14")}>
        <h2 className={cn(display, "mb-6 text-center text-[28px] tracking-wide text-(--tvb-muted)")}>Danke an unsere Partner</h2>
        <ul className="grid grid-cols-2 items-center gap-4 sm:grid-cols-4 lg:grid-cols-8">
          {sponsors.map((sponsor) => (
            <li key={sponsor.name} className="flex h-[76px] items-center justify-center rounded-xl bg-[#fafaf7] p-2">
              <img src={sponsor.src} alt={sponsor.name} className="max-h-14 max-w-full object-contain" loading="lazy" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
