// The club's content that rarely changes: teams, board, trainers, dates,
// sponsors and photos, taken from the old site (tv-bellenberg.de). The news
// come from the database (tvb_news).

export const BTV_URL = "https://www.btv.de/de/mein-verein/vereinsseite/tv-bellenberg.html";
export const MAPS_URL = "https://goo.gl/maps/TRk85M8zpXkNR2mh8";
export const OLD_SITE = "https://tv-bellenberg.de";

// Photos in public/tvb/. News refer to them by key.
export const photos = {
  vereinsheim: { src: "/tvb/vereinsheim.jpg", alt: "Vereinsheim und Sandplätze des TV Bellenberg" },
  tenniscamp: { src: "/tvb/tenniscamp.jpg", alt: "Tenniscamp auf der Anlage" },
  damen: { src: "/tvb/damen.jpg", alt: "Damen-Mannschaft, Meister der Südliga 2" },
  u18: { src: "/tvb/u18.jpg", alt: "U18-Junioren, Meister der Südliga 4" },
  ausflug: { src: "/tvb/ausflug.jpg", alt: "Vereinsausflug zu den BMW Open" },
  sommerfest: { src: "/tvb/sommerfest.jpg", alt: "Jugend-Sommerfest auf der Anlage" },
  jugend1: { src: "/tvb/jugend1.jpg", alt: "Jugendliche beim Training" },
  winter: { src: "/tvb/winter.jpg", alt: "Verschneite Tennisanlage" },
  wintergrillen: { src: "/tvb/wintergrillen.jpg", alt: "Laterne beim Wintergrillen" },
  clubhaus: { src: "/tvb/clubhaus.jpg", alt: "Mitglieder beim 40-jährigen Jubiläum 2018" },
} as const;

export type PhotoKey = keyof typeof photos;
export const photoKeys = Object.keys(photos) as PhotoKey[];

export function photo(key: string | null | undefined) {
  return key && key in photos ? photos[key as PhotoKey] : null;
}

export const categories = ["Verein", "Anlage", "Jugend", "Spielbetrieb"] as const;
export type Category = (typeof categories)[number];

export type News = {
  id: string;
  title: string;
  category: Category;
  publishedOn: string;
  teaser: string;
  body: string;
  image: string | null;
  published: boolean;
  showBanner: boolean;
};

export type NewsRow = {
  id: string;
  title: string;
  category: Category;
  published_on: string;
  teaser: string;
  body: string;
  image: string | null;
  published: boolean;
  show_banner: boolean;
};

export const newsColumns = "id, title, category, published_on, teaser, body, image, published, show_banner";

export function newsFromRow(row: NewsRow): News {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    publishedOn: row.published_on,
    teaser: row.teaser,
    body: row.body,
    image: row.image,
    published: row.published,
    showBanner: row.show_banner,
  };
}

export function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export type Team = { name: string; league: string; group: string };
export type Season = { id: string; name: string; teams: Team[] };

export const seasons: Season[] = [
  {
    id: "winter-2026",
    name: "Winter 2026/27",
    teams: [
      { name: "Herren", league: "Südliga 3", group: "030" },
      { name: "Herren 30", league: "Landesliga 2", group: "018" },
      { name: "Herren 40", league: "Südliga 1", group: "131" },
    ],
  },
  {
    id: "sommer-2026",
    name: "Sommer 2026",
    teams: [
      { name: "Herren I", league: "Südliga 1", group: "001" },
      { name: "Herren II", league: "Südliga 3", group: "029" },
      { name: "Herren III", league: "Südliga 4", group: "061" },
      { name: "Damen I", league: "Südliga 2", group: "151" },
      { name: "Damen II", league: "Südliga 3", group: "169" },
      { name: "Herren 40", league: "Südliga 1", group: "294" },
    ],
  },
  {
    id: "winter-2025",
    name: "Winter 2025/26",
    teams: [
      { name: "Herren I", league: "Südliga 2", group: "010" },
      { name: "Herren II", league: "Südliga 3", group: "030" },
      { name: "Damen", league: "Südliga 2", group: "083" },
      { name: "Herren 40", league: "Südliga 1", group: "122" },
    ],
  },
];

export const trainers = ["Lisa Prestele", "Heike Zanker", "Benny Maier-Fuchs", "Jan Sander", "Bastian Bättger", "Philipp Draxler"];

export const board = [
  { role: "1. Vorsitzender", name: "Steven Potrykus", email: "vorstand@tv-bellenberg.de" },
  { role: "2. Vorsitzender", name: "Arnold Eck", email: "vorstand@tv-bellenberg.de" },
  { role: "Kassier", name: "Heike Zanker", email: "finanzen@tv-bellenberg.de" },
  { role: "Mitgliederverwaltung", name: "Nadine Potrykus", email: "mitglieder@tv-bellenberg.de" },
  { role: "Schriftführerin / Presse", name: "Sabrina Hertenberger", email: "presse@tv-bellenberg.de" },
  { role: "Sportwart", name: "Icke Potrykus", email: "sportwart@tv-bellenberg.de" },
  { role: "Jugendwartin", name: "Lisa Prestele", email: "jugendwart@tv-bellenberg.de" },
  { role: "Technischer Leiter", name: "Andreas Gutbrod", email: "technik@tv-bellenberg.de" },
  { role: "Vergnügungswartin", name: "Manuela Peters", email: "festwart@tv-bellenberg.de" },
  { role: "Beisitzer", name: "Peter Baumann", email: "beisitzer@tv-bellenberg.de" },
  { role: "Beisitzer", name: "Fabian Hertenberger", email: "beisitzer@tv-bellenberg.de" },
];

// Stammtisch dates of the 2026 season, Fridays at 19:00.
export const meetups = [
  { date: "24.04.", host: "Vorstandschaft" },
  { date: "26.06.", host: "Senioren" },
  { date: "24.07.", host: "Damen 1 + 2" },
  { date: "04.09.", host: "Herren 40" },
  { date: "18.09.", host: "Herren 1 + 2 + 3" },
];

export const sponsors = [
  { name: "Raiffeisenbank Schwaben Mitte", src: "/tvb/sponsoren/raiffeisenbank.webp" },
  { name: "Autohaus Lindner", src: "/tvb/sponsoren/lindner.webp" },
  { name: "Ebhard", src: "/tvb/sponsoren/ebhard.webp" },
  { name: "Brunnen-Apotheke", src: "/tvb/sponsoren/brunnenapotheke.webp" },
  { name: "Leinfelder", src: "/tvb/sponsoren/leinfelder.webp" },
  { name: "mb Garten", src: "/tvb/sponsoren/mb-garten.webp" },
  { name: "Schörghuber", src: "/tvb/sponsoren/schoerghuber.webp" },
  { name: "Schreinerei Eck", src: "/tvb/sponsoren/schreinerei-eck.webp" },
];

// Documents still served by the old site.
export const documents = {
  spielplan: `${OLD_SITE}/wp-content/uploads/2026-27_Ergebnisse.pdf`,
  jugendtraining: `${OLD_SITE}/wp-content/uploads/2026-27_Jugendtraining.pdf`,
  satzung: `${OLD_SITE}/verein/satz-platz-spielordnung/`,
  rundschreiben: `${OLD_SITE}/verein/rundschreiben/`,
  antraege: `${OLD_SITE}/verein/beitraege/`,
  aenderung: `${OLD_SITE}/verein/aenderungsmitteilung/`,
  chronik: `${OLD_SITE}/verein/chronik/`,
};

// The site knows the season: from November to March the courts are closed
// and the start page shows the winter photo. ?saison=sommer|winter overrides
// it, to look at the other one.
export type Jahreszeit = "winter" | "sommer";

export function jahreszeitOf(date: Date, override?: string): Jahreszeit {
  if (override === "winter" || override === "sommer") return override;
  const month = date.getMonth() + 1;
  return month >= 11 || month <= 3 ? "winter" : "sommer";
}

export const heroes: Record<Jahreszeit, { photo: PhotoKey; position: string; badge: string; lines: [string, string]; text: string; caption: string }> = {
  winter: {
    photo: "winter",
    position: "center 60%",
    badge: "Winterpause",
    lines: ["Die Plätze schlafen.", "Wir spielen drinnen."],
    text: "Seit 7. November ist die Anlage zu. Die Winterrunde läuft, das Jugendtraining auch, und im Frühjahr legen wir die Plätze wieder gemeinsam an.",
    caption: "Die Anlage im Schnee",
  },
  sommer: {
    photo: "vereinsheim",
    position: "center 45%",
    badge: "Tennis im Landkreis Neu-Ulm",
    lines: ["Tennis in Bellenberg.", "Seit 1978."],
    text: "Sandplätze, Clubhaus und ein Verein, in dem Jugend, Mannschaften und Hobbyspieler zusammen auf dem Platz stehen.",
    caption: "Unser Vereinsheim im Sommer 2022",
  },
};

// "Wusstest du?": stories from the old site.
export const stories = [
  {
    text: "Die Holzbank vor Platz 4 ist ein Unikat: Bruno Schwägerl hat sie in wochenlanger Arbeit geschnitzt, samt großem Tennisball mit den Buchstaben „TVB“ an der Seite.",
    source: "Aus „TOP“ auf der alten Vereinsseite",
  },
  {
    text: "Beim Bezirksmusikfest am 31. Mai 1992 fuhr der Tennisverein mit einem eigenen Festwagen durch Bellenberg – mit riesigem Tennisschläger obendrauf.",
    source: "Fotoalbum · 1992",
  },
  {
    text: "20 Jahre lang haben Gustl Mair und Klaus Bürzle die Kasse des Vereins geprüft. 2026 haben sie das Amt abgegeben.",
    source: "Mitgliederversammlung 2026",
  },
  {
    text: "Alois Alt, Rita Köhler und Gerd Reitz sind Ehrenmitglieder des TVB, ernannt bei der Mitgliederversammlung 2020 für ihre langjährigen Verdienste.",
    source: "Ehrungen · 2020",
  },
  {
    text: "Zum Vereinsausflug geht es zu den Großen: 2024 zum Porsche Tennis Grand Prix nach Stuttgart, 2025 zu den BMW Open nach München.",
    source: "Jugend · Ausflüge",
  },
];

// The chronicle gallery on the start page, oldest first.
export const chronicle = [
  { year: "1978", text: "Gründung des Tennisvereins Bellenberg", src: "/tvb/wappen.png", alt: "Wappen des TV Bellenberg" },
  { year: "1992", text: "Eigener Festwagen beim Bezirksmusikfest", src: "/tvb/festwagen-1992.jpg", alt: "Festwagen des Tennisvereins 1992" },
  { year: "2000", text: "Unsere Wimpelsammlung", src: "/tvb/wimpel-2000.jpg", alt: "Wimpel an der Wand" },
  { year: "2006", text: "Herren 30 werden Meister", src: "/tvb/herren30-2006.jpg", alt: "Herren 30, Meister 2006" },
  { year: "2018", text: "40 Jahre TVB", src: photos.clubhaus.src, alt: "Mitglieder beim 40-jährigen Jubiläum" },
  { year: "2020", text: "Tenniscamp der Jugend", src: photos.tenniscamp.src, alt: photos.tenniscamp.alt },
  { year: "2023", text: "Damen I und U18 werden Meister", src: photos.damen.src, alt: photos.damen.alt },
  { year: "2025", text: "Vereinsausflug zu den BMW Open", src: photos.ausflug.src, alt: photos.ausflug.alt },
  { year: "2026", text: "20 neue Mitglieder seit April", src: photos.sommerfest.src, alt: photos.sommerfest.alt },
];
