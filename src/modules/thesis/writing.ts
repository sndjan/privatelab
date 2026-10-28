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
};

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
  const numbers = numbering(sections);
  const parts = sections.map((section, index) => {
    const heading = `\\${commands[section.depth]}{${latexInline(section.title || "Ohne Titel")}}\\label{${label(section.title, numbers[index])}}`;
    return [heading, latexBody(section.body, images)].filter(Boolean).join("\n\n");
  });
  return `% Aus Private Lab exportiert. Einbinden mit \\input{arbeit}; braucht biblatex, graphicx und csquotes.\n\n${parts.join("\n\n")}\n`;
}

function latexBody(body: string, images: ExportImage[]) {
  return body
    .replace(/\r\n/g, "\n")
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

export function toMarkdown(sections: Section[]) {
  const numbers = numbering(sections);
  return `${sections
    .map((section, index) =>
      [`${"#".repeat(section.depth + 1)} ${numbers[index]} ${section.title || "Ohne Titel"}`, section.body.trim()].filter(Boolean).join("\n\n"),
    )
    .join("\n\n")}\n`;
}
