"use client";

import { isImage, todayInGermany } from "./data";
import { useThesis } from "./use-thesis";
import { Writer } from "./writer";

// Writing the thesis itself: an outline with text, exported to LaTeX.
export function WritingTab() {
  const [sections, sources, documents, settings, phases, imageUrls] = useThesis(
    "sections",
    "sources",
    "documents",
    "settings",
    "phases",
    "imageUrls",
  );
  return (
    <Writer
      initial={sections}
      title={settings.title}
      phases={phases}
      today={todayInGermany()}
      targetPages={settings.targetPages}
      wordsPerPage={settings.wordsPerPage}
      citationStyle={settings.citationStyle}
      sources={sources
        .map((source) => ({
          id: source.id,
          key: source.citationKey,
          label: [source.authors[0]?.split(",")[0], source.year && `(${source.year})`, source.title].filter(Boolean).join(" "),
          summary: source.summary,
          notes: source.notes,
        }))
        .sort((a, b) => a.key.localeCompare(b.key))}
      images={documents.filter(isImage).map((document) => ({
        id: document.id,
        title: document.title,
        fileName: document.fileName,
        url: imageUrls[document.id] ?? null,
      }))}
    />
  );
}
