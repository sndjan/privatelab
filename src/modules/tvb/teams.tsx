import Link from "next/link";
import { cn } from "@/lib/utils";
import { BTV_URL, documents, photos, seasons } from "./data";
import { PageHead } from "./news";
import { buttons, container, display, href } from "./site";

export function TeamsPage({ seasonId }: { seasonId: string | undefined }) {
  const season = seasons.find((item) => item.id === seasonId) ?? seasons[0];
  return (
    <>
      <PageHead
        eyebrow="Spielbetrieb"
        title="Mannschaften"
        intro="Alle Teams des TVB mit Liga und Gruppe. Tabellen, Spielpläne und Ergebnisse stehen beim BTV."
        image={photos.u18}
      />
      <section className={cn(container, "pt-12 pb-6")}>
        <nav aria-label="Saison" className="mb-7 flex flex-wrap gap-2">
          {seasons.map((item) => (
            <Link
              key={item.id}
              href={href("mannschaften", { saison: item.id })}
              aria-current={item.id === season.id ? "page" : undefined}
              className="flex min-h-11 items-center rounded-full border-[1.5px] border-[#cfcdc4] bg-white px-4.5 text-[15px] font-bold aria-[current=page]:border-(--tvb-primary) aria-[current=page]:bg-(--tvb-primary) aria-[current=page]:text-white"
            >
              {item.name}
            </Link>
          ))}
        </nav>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {season.teams.map((team) => (
            <li key={team.name} className="flex flex-col gap-3.5 rounded-[18px] border border-(--tvb-line) bg-white p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className={cn(display, "text-[32px] leading-none")}>{team.name}</h2>
                  <p className="mt-1.5 text-[15px] text-(--tvb-muted)">{team.league}</p>
                </div>
                <span className="rounded-md bg-(--tvb-soft) px-2.5 py-1.5 text-xs font-bold whitespace-nowrap text-(--tvb-primary)">
                  Gr. {team.group}
                </span>
              </div>
              <a href={BTV_URL} target="_blank" rel="noreferrer" className={cn(buttons.primary, "min-h-11 text-sm")}>
                Tabelle &amp; Spiele beim BTV ↗
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-sm text-(--tvb-muted)">
          Ein Link funktioniert nicht? Kurze Nachricht an{" "}
          <a href="mailto:sportwart@tv-bellenberg.de" className="underline">
            sportwart@tv-bellenberg.de
          </a>
        </p>
      </section>
      <section className={cn(container, "pt-6 pb-22")}>
        <div className="grid gap-4 md:grid-cols-3">
          <a href={documents.spielplan} target="_blank" rel="noreferrer" className="flex min-h-[150px] flex-col gap-2.5 rounded-[18px] bg-(--tvb-primary) p-7 text-white">
            <span className={cn(display, "text-[28px]")}>Spielplan Winter ↗</span>
            <span className="leading-relaxed opacity-90">Alle Spieltermine der Winterrunde 2026/27 als PDF.</span>
          </a>
          <a href={`https://tv-bellenberg.de/spielbetrieb/hobbyrunde/`} target="_blank" rel="noreferrer" className="flex min-h-[150px] flex-col gap-2.5 rounded-[18px] border border-(--tvb-line) bg-white p-7">
            <span className={cn(display, "text-[28px]")}>Hobbyrunde ↗</span>
            <span className="leading-relaxed text-[#4a504c]">Ohne Ligadruck, mit Spaß: Termine und Paarungen der Hobbyrunde.</span>
          </a>
          <a href={`https://tv-bellenberg.de/spielbetrieb/spielbetrieb-archiv/`} target="_blank" rel="noreferrer" className="flex min-h-[150px] flex-col gap-2.5 rounded-[18px] border border-(--tvb-line) bg-white p-7">
            <span className={cn(display, "text-[28px]")}>Archiv ↗</span>
            <span className="leading-relaxed text-[#4a504c]">Frühere Saisons, Meisterschaften und Turniere.</span>
          </a>
        </div>
      </section>
    </>
  );
}
