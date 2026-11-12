import { cn } from "@/lib/utils";
import { documents, photos } from "./data";
import { PageHead } from "./news";
import { buttons, container, display } from "./site";

// The fees are not on the old site; [BEITRAG] marks where they go.
export function MembershipCards() {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      <div className="flex flex-col gap-3.5 rounded-[20px] border-2 border-(--tvb-primary) bg-white p-7">
        <span className="self-start rounded-md bg-(--tvb-soft) px-2.5 py-1.5 text-xs font-bold tracking-wider text-(--tvb-primary) uppercase">Für Einsteiger</span>
        <h3 className="text-2xl font-bold">Schnuppermitgliedschaft</h3>
        <p className="leading-relaxed text-[#4a504c]">Einmalig für 1 Jahr. Kein Arbeits- und Putzgeld, keine weiteren Kosten. Der Betrag wird zu Beginn abgebucht.</p>
        <span className={cn(display, "text-[34px]")}>[BEITRAG] €</span>
        <a href={documents.antraege} target="_blank" rel="noreferrer" className={cn(buttons.primary, "mt-auto")}>
          Antrag ausfüllen
        </a>
      </div>
      <div className="flex flex-col gap-3.5 rounded-[20px] border border-(--tvb-line) bg-white p-7">
        <span className="self-start rounded-md bg-[#f0efea] px-2.5 py-1.5 text-xs font-bold tracking-wider text-[#333833] uppercase">Voll dabei</span>
        <h3 className="text-2xl font-bold">Vollmitgliedschaft</h3>
        <p className="leading-relaxed text-[#4a504c]">Für Erwachsene, Jugendliche und Familien. Alle Beiträge in der Übersicht.</p>
        <span className={cn(display, "text-[34px]")}>ab [BEITRAG] €</span>
        <a href={documents.antraege} target="_blank" rel="noreferrer" className={cn(buttons.outline, "mt-auto")}>
          Beitragsübersicht
        </a>
      </div>
      <div className="flex flex-col gap-3.5 rounded-[20px] border border-(--tvb-line) bg-white p-7">
        <span className="self-start rounded-md bg-[#f0efea] px-2.5 py-1.5 text-xs font-bold tracking-wider text-[#333833] uppercase">Schon Mitglied</span>
        <h3 className="text-2xl font-bold">Änderung melden</h3>
        <p className="leading-relaxed text-[#4a504c]">Neue Adresse, neue Bankverbindung oder Wechsel der Mitgliedsart – einfach online mitteilen.</p>
        <span className="text-[15px] text-(--tvb-muted)">Geht an: mitglieder@tv-bellenberg.de</span>
        <a href={documents.aenderung} target="_blank" rel="noreferrer" className={cn(buttons.outline, "mt-auto")}>
          Änderungsmitteilung
        </a>
      </div>
    </div>
  );
}

export function MembershipPage() {
  return (
    <>
      <PageHead
        eyebrow="Mitgliedschaft"
        title="Mitglied werden"
        intro="Ein Jahr reinschnuppern ohne Arbeits- und Putzgeld, oder gleich voll dabei sein."
        image={photos.sommerfest}
      />
      <section className={cn(container, "py-14")}>
        <MembershipCards />
      </section>
      <section className={cn(container, "pb-22")}>
        <div className="grid gap-6 rounded-[20px] border border-(--tvb-line) bg-white p-7 md:grid-cols-2">
          <div>
            <h2 className={cn(display, "text-[32px]")}>Fragen?</h2>
            <p className="mt-2 leading-relaxed text-[#4a504c]">Zur Mitgliedschaft und zum Schnuppern helfen euch gerne weiter:</p>
          </div>
          <ul className="space-y-3">
            <li>
              <span className="block font-bold">Steven Potrykus · Vorstand</span>
              <a href="mailto:vorstand@tv-bellenberg.de" className="text-(--tvb-primary) underline">
                vorstand@tv-bellenberg.de
              </a>
            </li>
            <li>
              <span className="block font-bold">Nadine Potrykus · Mitgliederverwaltung</span>
              <a href="mailto:mitglieder@tv-bellenberg.de" className="text-(--tvb-primary) underline">
                mitglieder@tv-bellenberg.de
              </a>
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
