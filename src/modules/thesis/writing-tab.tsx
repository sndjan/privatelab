import { createClient } from "@/lib/supabase/server";
import { DOCUMENT_BUCKET, isImage, todayInGermany } from "./data";
import { loadDocuments, loadPhases, loadSections, loadSettings, loadSources } from "./queries";
import { Writer } from "./writer";

// Writing the thesis itself: an outline with text, exported to LaTeX.
export async function WritingTab({ userId }: { userId: string }) {
  const [sections, sources, documents, settings, phases] = await Promise.all([
    loadSections(),
    loadSources(),
    loadDocuments(),
    loadSettings(userId),
    loadPhases(),
  ]);
  const images = documents.filter(isImage);
  // Previews of the images in the text; the links last a few hours.
  const supabase = await createClient();
  const { data: signed } = images.length
    ? await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrls(images.map((image) => image.storagePath), 6 * 60 * 60)
    : { data: [] };
  return (
    <Writer
      initial={sections}
      title={settings.title}
      phases={phases}
      today={todayInGermany()}
      targetPages={settings.targetPages}
      wordsPerPage={settings.wordsPerPage}
      sources={sources
        .map((source) => ({
          id: source.id,
          key: source.citationKey,
          label: [source.authors[0]?.split(",")[0], source.year && `(${source.year})`, source.title].filter(Boolean).join(" "),
          summary: source.summary,
        }))
        .sort((a, b) => a.key.localeCompare(b.key))}
      images={images.map((document) => ({
        id: document.id,
        title: document.title,
        fileName: document.fileName,
        url: signed?.find((entry) => entry.path === document.storagePath)?.signedUrl ?? null,
      }))}
    />
  );
}
