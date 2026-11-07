// Server only. What the browser cache loads for the Gewicht-Challenge (see
// src/lib/query/data.ts). All tabs read the same data: the setup and every
// measurement of every participant.
import type { Loader } from "@/lib/query/loaders";
import { createClient } from "@/lib/supabase/server";
import {
  circumferenceColumns,
  circumferenceFromRow,
  participantColumns,
  participantFromRow,
  settingsColumns,
  settingsFromRow,
  siteColumns,
  weighingColumns,
  weighingFromRow,
  type CircumferenceRow,
  type ParticipantRow,
  type SettingsRow,
  type SiteRow,
  type WeighingRow,
} from "./data";

export const weightLoaders = {
  all: async (_params, user) => {
    const supabase = await createClient();
    const [settings, participants, sites, weighings, circumferences] = await Promise.all([
      supabase.from("weight_settings").select(settingsColumns).maybeSingle<SettingsRow>(),
      supabase.from("weight_participants").select(participantColumns).order("position").order("created_at"),
      supabase.from("weight_sites").select(siteColumns).order("position"),
      supabase.from("weight_entries").select(weighingColumns).order("date", { ascending: false }),
      supabase.from("weight_circumferences").select(circumferenceColumns).order("date", { ascending: false }),
    ]);

    // Admins link participants to accounts: everyone with access to the module.
    let accounts: { id: string; email: string }[] = [];
    if (user.isAdmin) {
      const [{ data: access }, { data: profiles }] = await Promise.all([
        supabase.from("module_access").select("user_id").eq("module_id", "weight"),
        supabase.from("profiles").select("id, email, is_admin").order("email"),
      ]);
      const allowed = new Set((access ?? []).map((row) => row.user_id as string));
      accounts = (profiles ?? [])
        .filter((profile) => profile.is_admin || allowed.has(profile.id as string))
        .map((profile) => ({ id: profile.id as string, email: profile.email as string }));
    }

    return {
      me: { id: user.id, isAdmin: user.isAdmin },
      settings: settings.data ? settingsFromRow(settings.data) : null,
      participants: ((participants.data ?? []) as ParticipantRow[]).map(participantFromRow),
      sites: (sites.data ?? []) as SiteRow[],
      weighings: ((weighings.data ?? []) as WeighingRow[]).map(weighingFromRow),
      circumferences: ((circumferences.data ?? []) as CircumferenceRow[]).map(circumferenceFromRow),
      accounts,
    };
  },
} satisfies Record<string, Loader>;
