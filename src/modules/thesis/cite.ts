// Sources and how they are cited: APA 7 in the German adaptation (DGPs) for
// the reference list, and BibLaTeX entries for biblatex-apa (LaTeX with
// biber). Plain string formatting, no lookups and no AI.

export type SourceKind = "web" | "article" | "book" | "chapter" | "software";
export type SourceStatus = "found" | "read" | "cited";

export type Source = {
  id: string;
  kind: SourceKind;
  citationKey: string;
  status: SourceStatus;
  // Persons as "Nachname, Vorname", organizations without a comma.
  authors: string[];
  editors: string[];
  year: number | null;
  month: number | null;
  day: number | null;
  title: string;
  // Site name (web), journal (article) or book title (chapter).
  container: string;
  volume: string;
  issue: string;
  pages: string;
  edition: string;
  version: string;
  publisher: string;
  doi: string;
  url: string;
  accessed: string | null;
  notes: string;
};

export type SourceField =
  | "authors"
  | "editors"
  | "date"
  | "year"
  | "title"
  | "container"
  | "volume"
  | "issue"
  | "pages"
  | "edition"
  | "version"
  | "publisher"
  | "doi"
  | "url"
  | "accessed";

type FieldSpec = { label: string; required?: boolean; hint?: string };

// The fields each kind asks for, in form order. "date" is year with optional
// month and day, "year" only the year. Required fields are what APA needs
// for a complete reference.
export const sourceKinds: { value: SourceKind; label: string; fields: Partial<Record<SourceField, FieldSpec>> }[] = [
  {
    value: "web",
    label: "Webseite / Dokumentation",
    fields: {
      authors: { label: "Autor:innen / Organisation", hint: "Leer lassen, wenn niemand genannt ist." },
      date: { label: "Veröffentlicht / aktualisiert", hint: "Leer lassen, wenn kein Datum angegeben ist (o. J.)." },
      title: { label: "Titel der Seite", required: true },
      container: { label: "Name der Website", hint: "Entfällt, wenn gleich der Organisation." },
      url: { label: "URL", required: true },
      accessed: { label: "Abgerufen am", hint: "Für Seiten, die sich ändern, z. B. Dokumentationen." },
    },
  },
  {
    value: "article",
    label: "Zeitschriftenartikel / Paper",
    fields: {
      authors: { label: "Autor:innen", required: true },
      year: { label: "Jahr", required: true },
      title: { label: "Titel des Artikels", required: true },
      container: { label: "Zeitschrift / Konferenzband", required: true },
      volume: { label: "Jahrgang (Volume)" },
      issue: { label: "Heft (Issue)" },
      pages: { label: "Seiten / Artikelnummer", hint: "z. B. 123-145" },
      doi: { label: "DOI" },
      url: { label: "URL", hint: "Nur ohne DOI nötig." },
    },
  },
  {
    value: "book",
    label: "Buch",
    fields: {
      authors: { label: "Autor:innen", required: true },
      year: { label: "Jahr", required: true },
      title: { label: "Titel", required: true },
      edition: { label: "Auflage", hint: "Nur ab der 2. Auflage, z. B. 2" },
      publisher: { label: "Verlag", required: true },
      doi: { label: "DOI" },
      url: { label: "URL", hint: "Nur ohne DOI, z. B. bei E-Books." },
    },
  },
  {
    value: "chapter",
    label: "Buchkapitel",
    fields: {
      authors: { label: "Autor:innen des Kapitels", required: true },
      year: { label: "Jahr", required: true },
      title: { label: "Titel des Kapitels", required: true },
      editors: { label: "Herausgeber:innen" },
      container: { label: "Titel des Buchs", required: true },
      edition: { label: "Auflage", hint: "Nur ab der 2. Auflage, z. B. 2" },
      pages: { label: "Seiten", hint: "z. B. 45-67" },
      publisher: { label: "Verlag", required: true },
      doi: { label: "DOI" },
      url: { label: "URL", hint: "Nur ohne DOI." },
    },
  },
  {
    value: "software",
    label: "Software / Repository",
    fields: {
      authors: { label: "Autor:innen / Organisation", hint: "Leer lassen, wenn niemand genannt ist." },
      year: { label: "Jahr", hint: "Jahr der verwendeten Version; leer = o. J." },
      title: { label: "Name", required: true },
      version: { label: "Version", hint: "z. B. 18.3.1" },
      publisher: { label: "Herausgeber / Plattform", hint: "z. B. GitHub. Entfällt, wenn gleich den Autor:innen." },
      url: { label: "URL", required: true },
    },
  },
];

export const sourceStatuses: { value: SourceStatus; label: string }[] = [
  { value: "found", label: "Gefunden" },
  { value: "read", label: "Gelesen" },
  { value: "cited", label: "Zitiert" },
];

export const kindLabel = (kind: SourceKind) => sourceKinds.find((entry) => entry.value === kind)?.label ?? kind;
export const statusLabel = (status: SourceStatus) =>
  sourceStatuses.find((entry) => entry.value === status)?.label ?? status;

// Names that are missing for the source's kind, by their form label.
export function missingFields(source: Source) {
  const spec = sourceKinds.find((entry) => entry.value === source.kind)!;
  return Object.entries(spec.fields)
    .filter(([field, info]) => info.required && isEmpty(source, field as SourceField))
    .map(([, info]) => info.label);
}

function isEmpty(source: Source, field: SourceField) {
  switch (field) {
    case "authors":
    case "editors":
      return source[field].length === 0;
    case "date":
    case "year":
      return source.year === null;
    case "accessed":
      return source.accessed === null;
    default:
      return source[field].trim() === "";
  }
}

// --- Names ------------------------------------------------------------------

const isPerson = (name: string) => name.includes(",");

function splitPerson(name: string) {
  const index = name.indexOf(",");
  return { family: name.slice(0, index).trim(), given: name.slice(index + 1).trim() };
}

// "Hans-Peter Maria" → "H.-P. M."; "J. R." stays.
function initials(given: string) {
  return given
    .split(/\s+/)
    .filter(Boolean)
    .map((part) =>
      part
        .split("-")
        .map((piece) => (piece ? `${piece.replace(/\.$/, "").charAt(0).toUpperCase()}.` : ""))
        .join("-"),
    )
    .join(" ");
}

// Reference list order: "Nachname, V."
function nameFamilyFirst(name: string) {
  if (!isPerson(name)) return name.trim();
  const { family, given } = splitPerson(name);
  return given ? `${family}, ${initials(given)}` : family;
}

// Editors: "V. Nachname"
function nameGivenFirst(name: string) {
  if (!isPerson(name)) return name.trim();
  const { family, given } = splitPerson(name);
  return given ? `${initials(given)} ${family}` : family;
}

// APA 7: all names up to 20, with a comma before "&"; from 21 on the first
// 19, an ellipsis and the last one.
function authorList(authors: string[]) {
  const names = authors.map(nameFamilyFirst);
  if (names.length === 1) return names[0];
  if (names.length > 20) return `${names.slice(0, 19).join(", ")}, … ${names.at(-1)}`;
  return `${names.slice(0, -1).join(", ")}, & ${names.at(-1)}`;
}

function editorList(editors: string[]) {
  const names = editors.map(nameGivenFirst);
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, & ${names.at(-1)}`;
}

// --- APA 7 (German) ---------------------------------------------------------

// Pieces of a reference; italic pieces are emphasized in the copied text.
export type Segment = { text: string; italic?: boolean };

const germanMonths = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

// "3. März 2027"
export function germanLongDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return `${day}. ${germanMonths[month - 1]} ${year}`;
}

function apaDate(source: Source, withDay: boolean) {
  if (source.year === null) return "o. J.";
  if (!withDay || source.month === null) return String(source.year);
  const month = germanMonths[source.month - 1];
  return source.day === null ? `${source.year}, ${month}` : `${source.year}, ${source.day}. ${month}`;
}

// Adds a period unless the text already ends with a punctuation mark.
const closed = (text: string) => (/[.?!]$/.test(text) ? text : `${text}.`);

const dash = (pages: string) => pages.trim().replace(/\s*-+\s*/g, "–");

export function doiUrl(doi: string) {
  const value = doi.trim().replace(/^(https?:\/\/(dx\.)?doi\.org\/|doi:\s*)/i, "");
  return value ? `https://doi.org/${value}` : "";
}

const editionText = (edition: string) => {
  const value = edition.trim().replace(/\.$/, "");
  if (!value) return "";
  return /^\d+$/.test(value) ? `${value}. Aufl.` : value;
};

export function apa(source: Source): Segment[] {
  const segments: Segment[] = [];
  const add = (text: string, italic = false) => {
    if (text) segments.push({ text, italic });
  };
  const singleAuthor = source.authors.length === 1 ? source.authors[0].trim() : null;
  const date = `(${apaDate(source, source.kind === "web")}).`;
  const link = doiUrl(source.doi) || source.url.trim();
  const titleItalic = source.kind !== "article" && source.kind !== "chapter";

  // Title with what belongs right after it, e.g. "(2. Aufl.)" or "(Version 2) [Computersoftware]".
  const titleSuffix = (() => {
    if (source.kind === "book") return editionText(source.edition) ? ` (${editionText(source.edition)})` : "";
    if (source.kind === "software") {
      const version = source.version.trim() ? `(Version ${source.version.trim().replace(/^v(?=\d)/i, "")}) ` : "";
      return ` ${version}[Computersoftware]`;
    }
    return "";
  })();
  const pushTitle = () => {
    if (titleSuffix) {
      add(source.title.trim(), titleItalic);
      add(`${titleSuffix}. `);
    } else if (titleItalic) {
      // The closing period isn't part of the italic title.
      const title = source.title.trim();
      add(title, true);
      add(/[.?!]$/.test(title) ? " " : ". ");
    } else {
      add(`${closed(source.title.trim())} `);
    }
  };

  // Without authors the title takes their place.
  if (source.authors.length > 0) {
    add(`${closed(authorList(source.authors))} ${date} `);
    pushTitle();
  } else {
    pushTitle();
    add(`${date} `);
  }

  switch (source.kind) {
    case "web": {
      const site = source.container.trim();
      if (site && site !== singleAuthor) add(`${closed(site)} `);
      break;
    }
    case "article": {
      const journal = source.container.trim();
      const volume = source.volume.trim();
      const issue = source.issue.trim();
      const pages = dash(source.pages);
      add(journal, true);
      if (volume) {
        add(", ");
        add(volume, true);
      }
      if (issue) add(`(${issue})`);
      if (pages) add(`, ${pages}`);
      add(". ");
      break;
    }
    case "book":
      if (source.publisher.trim()) add(`${closed(source.publisher.trim())} `);
      break;
    case "chapter": {
      const editors = source.editors.length > 0 ? `${editorList(source.editors)} (Hrsg.), ` : "";
      const details = [editionText(source.edition), source.pages.trim() ? `S. ${dash(source.pages)}` : ""].filter(Boolean);
      add(`In ${editors}`);
      add(source.container.trim(), true);
      add(`${details.length > 0 ? ` (${details.join(", ")})` : ""}. `);
      if (source.publisher.trim()) add(`${closed(source.publisher.trim())} `);
      break;
    }
    case "software": {
      const publisher = source.publisher.trim();
      if (publisher && publisher !== singleAuthor) add(`${closed(publisher)} `);
      break;
    }
  }

  if (link) {
    add(source.kind === "web" && source.accessed ? `Abgerufen am ${germanLongDate(source.accessed)}, von ${link}` : link);
  }

  // Merge neighbors with the same style and drop the trailing space.
  const merged: Segment[] = [];
  for (const segment of segments) {
    const last = merged.at(-1);
    if (last && Boolean(last.italic) === Boolean(segment.italic)) last.text += segment.text;
    else merged.push({ ...segment });
  }
  if (merged.length > 0) merged[merged.length - 1].text = merged[merged.length - 1].text.trimEnd();
  return merged;
}

export const apaText = (source: Source) => apa(source).map((segment) => segment.text).join("");

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const apaHtml = (source: Source) =>
  apa(source)
    .map((segment) => (segment.italic ? `<i>${escapeHtml(segment.text)}</i>` : escapeHtml(segment.text)))
    .join("");

// --- BibLaTeX (biblatex-apa) -----------------------------------------------

const latexSpecial: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "{": "\\{",
  "}": "\\}",
  "&": "\\&",
  "%": "\\%",
  $: "\\$",
  "#": "\\#",
  _: "\\_",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
};

const latex = (text: string) => text.trim().replace(/[\\{}&%$#_~^]/g, (char) => latexSpecial[char]);

// Organizations in double braces, so biber doesn't split them into names.
const bibNames = (names: string[]) =>
  names
    .map((name) => (isPerson(name) ? latex(name) : `{${latex(name)}}`))
    .join(" and ");

const bibTypes: Record<SourceKind, string> = {
  web: "online",
  article: "article",
  book: "book",
  chapter: "incollection",
  software: "software",
};

const pad = (value: number) => String(value).padStart(2, "0");

export function biblatex(source: Source) {
  const fields: [string, string][] = [];
  const add = (name: string, value: string) => {
    if (value) fields.push([name, value]);
  };
  const doi = doiUrl(source.doi).replace("https://doi.org/", "");

  if (source.authors.length > 0) add("author", bibNames(source.authors));
  if (source.kind === "chapter" && source.editors.length > 0) add("editor", bibNames(source.editors));
  add("title", latex(source.title));
  if (source.year !== null) {
    let date = String(source.year);
    if (source.kind === "web" && source.month !== null) {
      date += `-${pad(source.month)}`;
      if (source.day !== null) date += `-${pad(source.day)}`;
    }
    add("date", date);
  }
  switch (source.kind) {
    case "web":
      add("organization", latex(source.container));
      break;
    case "article":
      add("journaltitle", latex(source.container));
      add("volume", latex(source.volume));
      add("number", latex(source.issue));
      add("pages", latex(source.pages).replace(/\s*-+\s*/g, "--"));
      break;
    case "book":
    case "chapter":
      if (source.kind === "chapter") {
        add("booktitle", latex(source.container));
        add("pages", latex(source.pages).replace(/\s*-+\s*/g, "--"));
      }
      add("edition", latex(source.edition.replace(/\.$/, "")));
      add("publisher", latex(source.publisher));
      break;
    case "software":
      add("version", latex(source.version.replace(/^v(?=\d)/i, "")));
      add("publisher", latex(source.publisher));
      break;
  }
  add("doi", doi);
  if (!doi) add("url", source.url.trim());
  if (source.kind === "web" && source.accessed) add("urldate", source.accessed);

  const width = Math.max(...fields.map(([name]) => name.length));
  const body = fields.map(([name, value]) => `  ${name.padEnd(width)} = {${value}}`).join(",\n");
  return `@${bibTypes[source.kind]}{${source.citationKey},\n${body}\n}`;
}

export const bibliography = (sources: Source[]) => sources.map(biblatex).join("\n\n") + "\n";

// APA reference lists are sorted by the first author (or the title without authors).
export function sortKey(source: Source) {
  return (source.authors[0] ?? source.title).toLocaleLowerCase("de-DE");
}

// --- Citation keys ----------------------------------------------------------

const ascii = (text: string) =>
  text
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[^A-Za-z0-9\s]/g, "");

const stopWords = new Set(["a", "an", "the", "of", "der", "die", "das", "ein", "eine", "und", "and", "on", "in", "zu", "zur", "zum", "for", "how", "to", "with"]);

// "mozilla2024fetch": first author's family name (or organization's first
// word), year and the first word of the title that isn't a filler.
export function suggestCitationKey(source: Pick<Source, "authors" | "year" | "title">) {
  const first = source.authors[0] ?? "";
  const name = ascii(isPerson(first) ? splitPerson(first).family : first)
    .split(/\s+/)
    .find(Boolean);
  const titleWords = ascii(source.title).toLowerCase().split(/\s+/).filter(Boolean);
  const word = titleWords.find((candidate) => !stopWords.has(candidate)) ?? titleWords[0] ?? "quelle";
  return `${(name ?? word).toLowerCase()}${source.year ?? "oj"}${name ? word : ""}`.slice(0, 50) || "quelle";
}
