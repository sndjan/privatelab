// Server only. What the browser cache loads for the Bachelorarbeit (see
// src/lib/query/data.ts); each one reads with RLS.
import { createClient } from "@/lib/supabase/server";
import type { Loader } from "@/lib/query/loaders";
import { DOCUMENT_BUCKET, isImage } from "./data";
import {
  documentUrls,
  loadDocument,
  loadBreaks,
  loadDocuments,
  loadEvents,
  loadInfos,
  loadLog,
  loadMilestones,
  loadPeople,
  loadPhases,
  loadProtocols,
  loadSections,
  loadSettings,
  loadSources,
  loadTodos,
} from "./queries";

export const thesisLoaders = {
  settings: (_, user) => loadSettings(user.id),
  phases: () => loadPhases(),
  breaks: () => loadBreaks(),
  milestones: () => loadMilestones(),
  todos: () => loadTodos(),
  log: () => loadLog(),
  sources: () => loadSources(),
  protocols: () => loadProtocols(),
  people: () => loadPeople(),
  events: () => loadEvents(),
  infos: () => loadInfos(),
  sections: () => loadSections(),
  documents: () => loadDocuments(),
  // Links to view and download one document, valid for an hour.
  documentUrls: async ({ id }) => {
    const document = id ? await loadDocument(id) : null;
    return document ? documentUrls(document) : { viewUrl: null, downloadUrl: null };
  },
  // Preview links of all images, by document id, valid for six hours.
  imageUrls: async () => {
    const images = (await loadDocuments()).filter(isImage);
    if (images.length === 0) return {} as Record<string, string>;
    const supabase = await createClient();
    const { data } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .createSignedUrls(images.map((image) => image.storagePath), 6 * 60 * 60);
    return Object.fromEntries(
      images.flatMap((image) => {
        const url = data?.find((entry) => entry.path === image.storagePath)?.signedUrl;
        return url ? [[image.id, url]] : [];
      }),
    ) as Record<string, string>;
  },
} satisfies Record<string, Loader>;
