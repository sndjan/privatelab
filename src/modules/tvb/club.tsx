/* eslint-disable @next/next/no-img-element -- photos are small files in public/tvb */
import { ArrowUpRightIcon, MailIcon, MapPinIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { board, documents, MAPS_URL, meetups, photos, trainers } from "./data";
import { PageHead } from "./news";
import { buttons, container, display } from "./site";

export function ClubPage() {
  return (
    <>
      <PageHead
        eyebrow="Über uns"
        title="Der Verein"
        intro="Der Tennisverein Bellenberg e.V. wurde 1978 gegründet. Hier findet ihr Vorstandschaft, Trainer, Termine und alles Offizielle."
        image={photos.clubhaus}
      />

      <section id="vorstand" className={cn(container, "scroll-mt-20 py-14")}>
        <h2 className={cn(display, "mb-6 text-[40px] leading-none")}>Vorstandschaft</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {board.map((person) => (
            <li key={`${person.role}-${person.name}`} className="flex flex-col gap-1 rounded-2xl border border-(--tvb-line) bg-white p-5">
              <span className="text-[13px] font-bold tracking-wider text-(--tvb-primary) uppercase">{person.role}</span>
              <span className="text-lg font-bold">{person.name}</span>
              <a href={`mailto:${person.email}`} className="flex items-center gap-1.5 text-sm text-(--tvb-muted) hover:underline">
                <MailIcon className="size-3.5" />
                {person.email}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-(--tvb-primary) text-white">
        <div className={cn(container, "grid gap-10 py-16 lg:grid-cols-2")}>
          <div>
            <h2 className={cn(display, "mb-4 text-[40px] leading-none")}>Trainerteam</h2>
            <ul className="flex flex-wrap gap-2">
              {trainers.map((name) => (
                <li key={name} className="rounded-full border border-white/45 px-4 py-2.5">
                  {name}
                </li>
              ))}
            </ul>
          </div>
          <div id="stammtisch" className="scroll-mt-20">
            <h2 className={cn(display, "mb-1 text-[40px] leading-none")}>Stammtisch 2026</h2>
            <p className="mb-4 opacity-85">Jeweils freitags um 19:00 Uhr. Ausrichter melden sich bei festwart@tv-bellenberg.de.</p>
            <ul className="divide-y divide-white/20 rounded-2xl bg-white/10">
              {meetups.map((meetup) => (
                <li key={meetup.date} className="flex justify-between gap-4 px-5 py-3.5">
                  <span className="font-bold">Fr, {meetup.date}</span>
                  <span className="opacity-90">{meetup.host}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="kontakt" className={cn(container, "scroll-mt-20 py-16")}>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-[20px] border border-(--tvb-line) bg-white p-7">
            <h2 className={cn(display, "text-[34px] leading-none")}>Kontakt &amp; Anfahrt</h2>
            <p className="flex items-start gap-2.5 text-lg leading-relaxed">
              <MapPinIcon className="mt-1 size-5 shrink-0 text-(--tvb-primary)" />
              <span>
                TV Bellenberg
                <br />
                An der Staig 13
                <br />
                89287 Bellenberg
              </span>
            </p>
            <a href="mailto:info@tv-bellenberg.de" className="flex items-center gap-2.5 text-lg text-(--tvb-primary) underline">
              <MailIcon className="size-5" /> info@tv-bellenberg.de
            </a>
            <a href={MAPS_URL} target="_blank" rel="noreferrer" className={cn(buttons.primary, "mt-2 self-start")}>
              Route planen <ArrowUpRightIcon className="size-4.5" />
            </a>
          </div>
          <img src={photos.vereinsheim.src} alt={photos.vereinsheim.alt} className="h-full min-h-[280px] w-full rounded-[20px] object-cover" />
        </div>
      </section>

      <section id="dokumente" className={cn(container, "scroll-mt-20 pb-22")}>
        <h2 className={cn(display, "mb-6 text-[40px] leading-none")}>Dokumente</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Satzung, Platz- & Spielordnung", to: documents.satzung },
            { label: "Rundschreiben", to: documents.rundschreiben },
            { label: "Anträge & Beiträge", to: documents.antraege },
            { label: "Chronik", to: documents.chronik },
          ].map((doc) => (
            <li key={doc.label}>
              <a
                href={doc.to}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-[72px] items-center justify-between gap-3 rounded-2xl border border-(--tvb-line) bg-white px-5 py-4 font-bold hover:border-(--tvb-primary)"
              >
                {doc.label}
                <ArrowUpRightIcon className="size-4.5 shrink-0 text-(--tvb-primary)" />
              </a>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
