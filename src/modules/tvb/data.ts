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
  clubhaus: { src: "/tvb/clubhaus.jpg", alt: "Mitglieder vor dem Clubhaus beim 40-jährigen Jubiläum" },
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
