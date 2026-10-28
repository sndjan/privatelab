// The thesis text: an outline of sections with plain text, numbered like the
// final document and exported to LaTeX or Markdown. Shared by server and client.
//
// Text format, kept small on purpose:
//   blank line             new paragraph
//   **fett**, *kursiv*      bold, italics
//   - Punkt                bullet list (lines starting with "- ")
//   [@key] or [@key, S. 12]  citation of a source (its citation key)
//   ![Beschriftung](doc:<id>)  an image from the documents

export type SectionStatus = "open" | "draft" | "done";

export const sectionStatuses: { value: SectionStatus; label: string }[] = [
  { value: "open", label: "Offen" },
  { value: "draft", label: "Entwurf" },
  { value: "done", label: "Fertig" },
];

export type Section = {
  id: string;
  depth: number; // 0 = Kapitel, 1 = Abschnitt, 2 = Unterabschnitt, 3
  title: string;
  body: string;
  status: SectionStatus;
  targetWords: number | null;
  comments: SectionComment[];
};

// A note on a section ("Quelle für die Zahl fehlt"), not part of the text.
export type SectionComment = { id: string; text: string; createdAt: string; resolved: boolean };

export const MAX_DEPTH = 3;

// "1", "1.1", "1.1.1" … in list order.
export function numbering(sections: Pick<Section, "depth">[]) {
  const counters = [0, 0, 0, 0];
  return sections.map(({ depth }) => {
    counters[depth]++;
    for (let level = depth + 1; level < counters.length; level++) counters[level] = 0;
    return counters.slice(0, depth + 1).join(".");
  });
}

// A section with everything below it (deeper sections right after it).
export function subtreeEnd(sections: Pick<Section, "depth">[], index: number) {
  let end = index + 1;
  while (end < sections.length && sections[end].depth > sections[index].depth) end++;
  return end;
}

// Keeps the outline valid: the first section is a chapter, and no section is
// more than one level deeper than the one before it.
export function normalizeDepths<T extends Pick<Section, "depth">>(sections: T[]): T[] {
  let previous = -1;
  return sections.map((section) => {
    const depth = Math.max(0, Math.min(section.depth, previous + 1, MAX_DEPTH));
    previous = depth;
    return depth === section.depth ? section : { ...section, depth };
  });
}

const markup = /!\[[^\]]*\]\(doc:[^)]*\)|\[@[^\]]+\]/g;

export function countWords(text: string) {
  return text.replace(markup, " ").split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

export function formatWords(count: number) {
  return `${count.toLocaleString("de-DE")} ${count === 1 ? "Wort" : "Wörter"}`;
}

export const figurePattern = /!\[([^\]]*)\]\(doc:([^)]*)\)/g;

// The text of a section in pieces for the editor: text, then an image on a
// line of its own, then text again, and so on (always starting and ending
// with text). lead and trail are the line breaks around an image, kept apart
// so the text fields don't start or end with empty lines; joinBody puts
// everything back exactly as it was.
export type BodyPart =
  | { kind: "text"; text: string; lead: string; trail: string }
  | { kind: "image"; line: string; caption: string; id: string };

const figureLine = /^!\[([^\]]*)\]\(doc:([^)]*)\)[ \t]*$/gm;

export function splitBody(body: string): BodyPart[] {
  const parts: BodyPart[] = [];
  let last = 0;
  const pushText = (raw: string, afterImage: boolean, beforeImage: boolean) => {
    const lead = afterImage ? /^\n*/.exec(raw)![0] : "";
    const rest = raw.slice(lead.length);
    const trail = beforeImage ? /\n*$/.exec(rest)![0] : "";
    parts.push({ kind: "text", text: rest.slice(0, rest.length - trail.length), lead, trail });
  };
  for (const match of body.matchAll(figureLine)) {
    pushText(body.slice(last, match.index), parts.length > 0, true);
    parts.push({ kind: "image", line: match[0], caption: match[1], id: match[2] });
    last = match.index + match[0].length;
  }
  pushText(body.slice(last), parts.length > 0, false);
  return parts;
}

export function joinBody(parts: BodyPart[]) {
  return parts.map((part, index) => (part.kind === "image" ? part.line : composeText(parts, index))).join("");
}

// Where the text of part `index` starts in the joined body.
export function partOffset(parts: BodyPart[], index: number) {
  let offset = 0;
  for (let at = 0; at < index; at++) {
    const part = parts[at];
    offset += part.kind === "image" ? part.line.length : composeText(parts, at).length;
  }
  const part = parts[index];
  return offset + (part.kind === "text" ? leadOf(parts, index).length : 0);
}

// An image line needs line breaks around it, also after text was typed into
// an empty piece between two images.
function leadOf(parts: BodyPart[], index: number) {
  const part = parts[index] as Extract<BodyPart, { kind: "text" }>;
  if (index === 0 || part.lead.includes("\n")) return part.lead;
  return part.text || index < parts.length - 1 ? "\n\n" : part.lead;
}

function composeText(parts: BodyPart[], index: number) {
  const part = parts[index] as Extract<BodyPart, { kind: "text" }>;
  const lead = leadOf(parts, index);
  const beforeImage = index < parts.length - 1;
  const trail = beforeImage && part.text && !part.trail.includes("\n") ? "\n\n" : part.trail;
  return lead + part.text + trail;
}

export const figureMarkup = (caption: string, id: string) => `![${caption.replace(/[\]\n]/g, "")}](doc:${id})`;

// A rough page count: words over words per page, plus half a page per figure.
export function estimatePages(sections: Pick<Section, "body">[], wordsPerPage: number) {
  const words = sections.reduce((sum, section) => sum + countWords(section.body), 0);
  const figures = sections.reduce((sum, section) => sum + [...section.body.matchAll(figurePattern)].length, 0);
  return words / wordsPerPage + figures * 0.5;
}

// Whether the section can be indented: it needs a section before it on its
// own level (or deeper) to become part of.
export function canIndent(sections: Pick<Section, "depth">[], index: number) {
  if (index === 0 || sections[index - 1].depth < sections[index].depth) return false;
  const end = subtreeEnd(sections, index);
  return sections.slice(index, end).every((section) => section.depth < MAX_DEPTH);
}

// --- Export -------------------------------------------------------------------

export type ExportImage = { id: string; title: string; fileName: string };

const latexSpecial: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "&": "\\&",
  "%": "\\%",
  $: "\\$",
  "#": "\\#",
  _: "\\_",
  "{": "\\{",
  "}": "\\}",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
};

const escapeLatex = (text: string) =>
  text
    .replace(/[\\&%$#_{}~^]/g, (char) => latexSpecial[char])
    .replace(/"(\S[^"]*?)"/g, "\\enquote{$1}")
    .replace(/„([^“]*)“/g, "\\enquote{$1}");

// **bold**, *italics* and citations inside one line.
function latexInline(text: string) {
  let out = "";
  let last = 0;
  for (const match of text.matchAll(/\*\*(.+?)\*\*|\*(.+?)\*|\[@([^\],]+)(?:,\s*([^\]]+))?\]/g)) {
    out += escapeLatex(text.slice(last, match.index));
    if (match[1] !== undefined) out += `\\textbf{${latexInline(match[1])}}`;
    else if (match[2] !== undefined) out += `\\emph{${latexInline(match[2])}}`;
    else {
      const keys = match[3].split(/[;\s]+@?/).filter(Boolean).join(",");
      out += match[4] ? `\\parencite[${escapeLatex(match[4].trim())}]{${keys}}` : `\\parencite{${keys}}`;
    }
    last = match.index + match[0].length;
  }
  return out + escapeLatex(text.slice(last));
}

const commands = ["chapter", "section", "subsection", "subsubsection"];

const label = (title: string, number: string) =>
  `sec:${
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || number.replace(/\./g, "-")
  }`;

// The body of the thesis for \input{} in a LaTeX template (biblatex for the
// citations, graphicx and csquotes). Images point at the file name of the
// document; copy the files next to the .tex file.
export function toLatex(sections: Section[], images: ExportImage[]) {
  return `% Aus Private Lab exportiert. Einbinden mit \\input{arbeit} in eine Vorlage mit \\chapter (z. B. report,\n% scrreprt); braucht biblatex, graphicx und csquotes.\n\n${latexSections(sections, images)}\n`;
}

function latexSections(sections: Section[], images: ExportImage[]) {
  const numbers = numbering(sections);
  return sections
    .map((section, index) => {
      const heading = `\\${commands[section.depth]}{${latexInline(section.title || "Ohne Titel")}}\\label{${label(section.title, numbers[index])}}`;
      return [heading, latexBody(section.body, images)].filter(Boolean).join("\n\n");
    })
    .join("\n\n");
}

function latexBody(body: string, images: ExportImage[]) {
  return body
    .replace(/\r\n/g, "\n")
    // An image on its own line inside a paragraph still becomes a figure.
    .replace(/^[ \t]*(!\[[^\]]*\]\(doc:[^)]*\))[ \t]*$/gm, "\n$1\n")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const image = /^!\[([^\]]*)\]\(doc:([^)]*)\)$/.exec(block);
      if (image) {
        const file = images.find((entry) => entry.id === image[2]);
        return [
          "\\begin{figure}[htbp]",
          "  \\centering",
          `  \\includegraphics[width=0.8\\textwidth]{${file ? file.fileName.replace(/[{}\\%#]/g, "") : "BILD-FEHLT"}}`,
          `  \\caption{${latexInline(image[1] || file?.title || "")}}`,
          "\\end{figure}",
        ].join("\n");
      }
      const lines = block.split("\n");
      if (lines.every((line) => /^\s*- /.test(line))) {
        return ["\\begin{itemize}", ...lines.map((line) => `  \\item ${latexInline(line.replace(/^\s*- /, ""))}`), "\\end{itemize}"].join("\n");
      }
      return lines.map((line) => latexInline(line.trim())).join("\n");
    })
    .join("\n\n");
}

// A complete document that compiles as it is, e.g. as main.tex in a new
// Overleaf project: report class (for \chapter), biblatex-apa with
// literatur.bib from the Quellen tab, the images uploaded next to it.
export function toLatexDocument(sections: Section[], images: ExportImage[], title: string) {
  const plain = (text: string) => escapeLatex(text.replace(/\s+/g, " ").trim());
  return [
    "% Aus Private Lab exportiert. In Overleaf: neues leeres Projekt, diese Datei als main.tex,",
    "% dazu literatur.bib (Tab Quellen) und die Bilder aus den Dokumenten hochladen.",
    "\\documentclass[12pt,a4paper]{report}",
    "\\usepackage[T1]{fontenc}",
    "\\usepackage[ngerman]{babel}",
    "\\usepackage{csquotes}",
    "\\usepackage{graphicx}",
    "\\usepackage[style=apa,backend=biber]{biblatex}",
    "\\addbibresource{literatur.bib}",
    "",
    `\\title{${plain(title) || "Bachelorarbeit"}}`,
    "\\author{}",
    "\\date{\\today}",
    "",
    "\\begin{document}",
    "\\maketitle",
    "\\tableofcontents",
    "",
    latexSections(sections, images),
    "",
    "\\printbibliography",
    "\\end{document}",
    "",
  ].join("\n");
}

// The outline only, numbered and indented, for talking it through.
export function toOutline(sections: Section[], { withWords = false } = {}) {
  const numbers = numbering(sections);
  return `${sections
    .map((section, index) => {
      const words = countWords(section.body);
      const detail = withWords && words > 0 ? ` (${formatWords(words)})` : "";
      return `${"  ".repeat(section.depth)}${numbers[index]} ${section.title || "Ohne Titel"}${detail}`;
    })
    .join("\n")}\n`;
}

export function toMarkdown(sections: Section[]) {
  const numbers = numbering(sections);
  return `${sections
    .map((section, index) =>
      [`${"#".repeat(section.depth + 1)} ${numbers[index]} ${section.title || "Ohne Titel"}`, section.body.trim()].filter(Boolean).join("\n\n"),
    )
    .join("\n\n")}\n`;
}
