import { isImage } from "./data";
import { loadDocuments, loadSections, loadSources } from "./queries";
import { Writer } from "./writer";

// Writing the thesis itself: an outline with text, exported to LaTeX.
export async function WritingTab() {
  const [sections, sources, documents] = await Promise.all([loadSections(), loadSources(), loadDocuments()]);
  return (
    <Writer
      initial={sections}
      sources={sources
        .map((source) => ({
          key: source.citationKey,
          label: [source.authors[0]?.split(",")[0], source.year && `(${source.year})`, source.title].filter(Boolean).join(" "),
        }))
        .sort((a, b) => a.key.localeCompare(b.key))}
      images={documents.filter(isImage).map((document) => ({ id: document.id, title: document.title, fileName: document.fileName }))}
    />
  );
}
