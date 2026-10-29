// Sources and how they are cited: the reference list in one of the styles
// common at German universities (APA 7 in the DGPs adaptation, Harvard,
// Deutsche Zitierweise with footnotes, IEEE), all in German, and BibLaTeX
// entries for LaTeX with biber. Plain string formatting, no lookups and no AI.

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
  // What it is about in a few words, shown when citing.
  summary: string;
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

// --- Other styles -----------------------------------------------------------

export type CitationStyle = "apa" | "harvard" | "deutsch" | "ieee";

// What each style looks like, and how the LaTeX export does it: the
// biblatex style (all in TeX Live, so they work in Overleaf) and the command
// a [@key] in the text becomes.
export const citationStyles: {
  value: CitationStyle;
  label: string;
  short: string;
  example: string;
  usedIn: string;
  biblatex: string;
  command: "parencite" | "footcite" | "cite";
}[] = [
  {
    value: "apa",
    label: "APA 7 (DGPs)",
    short: "APA",
    example: "(Müller & Schmidt, 2020, S. 12)",
    usedIn: "Psychologie, Sozial- und Wirtschaftswissenschaften",
    biblatex: "apa",
    command: "parencite",
  },
  {
    value: "harvard",
    label: "Harvard (Autor-Jahr)",
    short: "Harvard",
    example: "(Müller/Schmidt 2020, S. 12)",
    usedIn: "BWL, Wirtschaftsinformatik, viele Fachhochschulen",
    biblatex: "authoryear",
    command: "parencite",
  },
  {
    value: "deutsch",
    label: "Deutsche Zitierweise (Fußnoten)",
    short: "Fußnoten",
    example: "Fußnote: Müller, Hans/Schmidt, Klaus: Titel, 2020, S. 12.",
    usedIn: "Geistes-, Rechts- und Geschichtswissenschaften",
    biblatex: "verbose-ibid",
    command: "footcite",
  },
  {
    value: "ieee",
    label: "IEEE (numerisch)",
    short: "IEEE",
    example: "[1, S. 12]",
    usedIn: "Informatik, Elektrotechnik, Ingenieurwissenschaften",
    biblatex: "ieee",
    command: "cite",
  },
];

export const isCitationStyle = (value: unknown): value is CitationStyle =>
  citationStyles.some((style) => style.value === value);
export const citationStyleOf = (value: CitationStyle) => citationStyles.find((style) => style.value === value)!;

// Builds a reference from pieces: empty ones are dropped, neighbors with the
// same style merged, the trailing space removed.
function segmentsOf(pieces: (Segment | string | false | null | undefined)[]): Segment[] {
  const merged: Segment[] = [];
  for (const piece of pieces) {
    if (!piece) continue;
    const segment = typeof piece === "string" ? { text: piece } : { ...piece };
    const last = merged.at(-1);
    // "2. Aufl." followed by ". " keeps one period.
    if (last?.text.endsWith(".") && segment.text.startsWith(".")) segment.text = segment.text.slice(1);
    if (!segment.text) continue;
    if (last && Boolean(last.italic) === Boolean(segment.italic)) last.text += segment.text;
    else merged.push({ ...segment });
  }
  if (merged.length > 0) merged[merged.length - 1].text = merged[merged.length - 1].text.trimEnd();
  return merged;
}

const italic = (text: string): Segment => ({ text: text.trim(), italic: true });
const yearOf = (source: Source) => (source.year === null ? "o. J." : String(source.year));
const pagesOf = (source: Source) => (source.pages.trim() ? `S. ${dash(source.pages)}` : "");
const versionOf = (source: Source) => source.version.trim().replace(/^v(?=\d)/i, "");
const linkOf = (source: Source) => doiUrl(source.doi) || source.url.trim();
// "a, b, c" with the last joined by `and`.
const joinLast = (names: string[], and: string) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} ${and} ${names.at(-1)}`;

// Harvard and Deutsche Zitierweise: names separated by slashes, from four on
// the first with "et al." / "u. a."; without authors "o. V." (ohne Verfasser).
function slashNames(names: string[], format: (name: string) => string, more: string) {
  if (names.length === 0) return "o. V.";
  if (names.length > 3) return `${format(names[0])} ${more}`;
  return names.map(format).join("/");
}
const fullName = (name: string) => name.trim();

// Harvard as taught at German universities:
// Müller, H./Schmidt, K. (2020): Titel, 2. Aufl., Verlag.
function harvard(source: Source): Segment[] {
  const head = `${slashNames(source.authors, nameFamilyFirst, "et al.")} (${yearOf(source)}): `;
  const title = source.title.trim();
  const link = linkOf(source);
  const online = link ? `, [online] ${link}${source.kind === "web" && source.accessed ? ` [abgerufen am ${germanLongDate(source.accessed)}]` : ""}` : "";
  switch (source.kind) {
    case "web":
      return segmentsOf([head, title, source.container.trim() && `, ${source.container.trim()}`, online, "."]);
    case "article":
      return segmentsOf([
        head,
        `${title}, in: `,
        italic(source.container),
        source.volume.trim() && `, Jg. ${source.volume.trim()}`,
        source.issue.trim() && `, Nr. ${source.issue.trim()}`,
        pagesOf(source) && `, ${pagesOf(source)}`,
        doiUrl(source.doi) && `, ${doiUrl(source.doi)}`,
        ".",
      ]);
    case "book":
      return segmentsOf([
        head,
        italic(title),
        editionText(source.edition) && `, ${editionText(source.edition)}`,
        source.publisher.trim() && `, ${source.publisher.trim()}`,
        doiUrl(source.doi) ? `, ${doiUrl(source.doi)}` : source.url.trim() && `, [online] ${source.url.trim()}`,
        ".",
      ]);
    case "chapter":
      return segmentsOf([
        head,
        `${title}, in: `,
        source.editors.length > 0 && `${slashNames(source.editors, nameFamilyFirst, "et al.")} (Hrsg.): `,
        italic(source.container),
        editionText(source.edition) && `, ${editionText(source.edition)}`,
        source.publisher.trim() && `, ${source.publisher.trim()}`,
        pagesOf(source) && `, ${pagesOf(source)}`,
        ".",
      ]);
    case "software":
      return segmentsOf([
        head,
        italic(title),
        versionOf(source) && ` (Version ${versionOf(source)})`,
        " [Software]",
        source.publisher.trim() && `, ${source.publisher.trim()}`,
        online,
        ".",
      ]);
  }
}

// Deutsche Zitierweise, the entry in the Literaturverzeichnis (the first
// footnote looks the same): Müller, Hans/Schmidt, Klaus: Titel, 2. Aufl., Verlag, 2020.
function deutsch(source: Source): Segment[] {
  const head = `${slashNames(source.authors, fullName, "u. a.")}: `;
  const title = source.title.trim();
  const year = yearOf(source);
  const url = source.url.trim() && `, URL: ${source.url.trim()}`;
  const doi = doiUrl(source.doi) && `, DOI: ${doiUrl(source.doi).replace("https://doi.org/", "")}`;
  switch (source.kind) {
    case "web":
      return segmentsOf([
        head,
        title,
        source.container.trim() && `, ${source.container.trim()}`,
        source.year !== null && `, ${year}`,
        url,
        source.accessed && ` (abgerufen am ${germanLongDate(source.accessed)})`,
        ".",
      ]);
    case "article":
      return segmentsOf([
        head,
        `${title}, in: ${source.container.trim()}`,
        source.volume.trim() && ` ${source.volume.trim()}`,
        ` (${year})`,
        source.issue.trim() && `, Nr. ${source.issue.trim()}`,
        pagesOf(source) && `, ${pagesOf(source)}`,
        doi,
        ".",
      ]);
    case "book":
      return segmentsOf([
        head,
        title,
        editionText(source.edition) && `, ${editionText(source.edition)}`,
        source.publisher.trim() && `, ${source.publisher.trim()}`,
        `, ${year}`,
        doi || url,
        ".",
      ]);
    case "chapter":
      return segmentsOf([
        head,
        `${title}, in: `,
        source.editors.length > 0 && `${slashNames(source.editors, fullName, "u. a.")} (Hrsg.): `,
        source.container.trim(),
        editionText(source.edition) && `, ${editionText(source.edition)}`,
        source.publisher.trim() && `, ${source.publisher.trim()}`,
        `, ${year}`,
        pagesOf(source) && `, ${pagesOf(source)}`,
        doi,
        ".",
      ]);
    case "software":
      return segmentsOf([
        head,
        title,
        versionOf(source) && `, Version ${versionOf(source)}`,
        source.publisher.trim() && `, ${source.publisher.trim()}`,
        `, ${year}`,
        url,
        ".",
      ]);
  }
}

// IEEE with the German terms of biblatex-ieee:
// H. Müller und K. Schmidt, „Titel“, Zeitschrift, Bd. 3, Nr. 2, S. 1–9, 2020.
function ieee(source: Source): Segment[] {
  const names = source.authors.length > 6 ? `${nameGivenFirst(source.authors[0])} u. a.` : joinLast(source.authors.map(nameGivenFirst), "und");
  const head = names ? `${names}, ` : "";
  const quoted = `„${source.title.trim()}“`;
  const year = yearOf(source);
  const doi = doiUrl(source.doi) && `, doi: ${doiUrl(source.doi).replace("https://doi.org/", "")}`;
  const online = source.url.trim() && ` [Online]. Verfügbar unter: ${source.url.trim()}`;
  switch (source.kind) {
    case "web":
      return segmentsOf([
        head,
        `${quoted}, `,
        source.container.trim() && `${source.container.trim()}, `,
        source.year !== null && `${year}. `,
        source.accessed && `Zugegriffen: ${germanLongDate(source.accessed)}.`,
        online,
      ]);
    case "article":
      return segmentsOf([
        head,
        `${quoted}, `,
        italic(source.container),
        source.volume.trim() && `, Bd. ${source.volume.trim()}`,
        source.issue.trim() && `, Nr. ${source.issue.trim()}`,
        pagesOf(source) && `, ${pagesOf(source)}`,
        `, ${year}`,
        doi,
        ".",
      ]);
    case "book":
      return segmentsOf([
        head,
        italic(source.title),
        editionText(source.edition) && `, ${editionText(source.edition)}`,
        ". ",
        source.publisher.trim() && `${source.publisher.trim()}, `,
        year,
        doi,
        ".",
      ]);
    case "chapter":
      return segmentsOf([
        head,
        `${quoted}, in `,
        italic(source.container),
        source.editors.length > 0 && `, ${joinLast(source.editors.map(nameGivenFirst), "und")}, Hrsg.`,
        editionText(source.edition) && `, ${editionText(source.edition)}`,
        ". ",
        source.publisher.trim() && `${source.publisher.trim()}, `,
        year,
        pagesOf(source) && `, ${pagesOf(source)}`,
        doi,
        ".",
      ]);
    case "software":
      return segmentsOf([
        head,
        italic(source.title),
        versionOf(source) && `, Version ${versionOf(source)}`,
        ". ",
        source.publisher.trim() && `${source.publisher.trim()}, `,
        `${year}.`,
        online,
      ]);
  }
}

// The entry for the reference list in the chosen style.
export function reference(source: Source, style: CitationStyle): Segment[] {
  switch (style) {
    case "apa":
      return apa(source);
    case "harvard":
      return harvard(source);
    case "deutsch":
      return deutsch(source);
    case "ieee":
      return ieee(source);
  }
}

export const referenceText = (source: Source, style: CitationStyle) =>
  reference(source, style)
    .map((segment) => segment.text)
    .join("");

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const referenceHtml = (source: Source, style: CitationStyle) =>
  reference(source, style)
    .map((segment) => (segment.italic ? `<i>${escapeHtml(segment.text)}</i>` : escapeHtml(segment.text)))
    .join("");

// --- BibLaTeX ------------------------------------------------------------------
// The same .bib works with every style above (biblatex-apa, authoryear,
// verbose-ibid, biblatex-ieee).

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

// Reference lists are sorted by the first author (or the title without
// authors); IEEE numbers them in the order of citation, which LaTeX does.
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
