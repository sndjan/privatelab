// Shared types and the national baseline of the Mülltrenn-Hilfe (no server or
// client APIs here). Most of German waste separation is the same everywhere:
// packaging law (Verpackungsgesetz) decides what goes in the yellow bin, and
// paper and glass work alike. What differs per municipality is stored as
// LocalRules in waste_rules and laid over this baseline with effectiveBins().

export const binIds = ["gelb", "papier", "bio", "rest", "glas", "altkleider", "handel", "wertstoffhof", "schadstoff"] as const;
export type BinId = (typeof binIds)[number];

// How a bin is drawn: a wheelie bin, a bag, a street container, a recycling
// centre, the hazardous waste truck or a shop.
export const containers = ["tonne", "sack", "container", "hof", "mobil", "laden"] as const;
export type Container = (typeof containers)[number];

export type Bin = {
  id: BinId;
  name: string;
  short: string;
  color: string;
  container: Container;
  yes: string[];
  no: string[];
  hint: string;
};

export const baseBins: Record<BinId, Bin> = {
  gelb: {
    id: "gelb",
    name: "Gelbe Tonne / Gelber Sack",
    short: "Gelb",
    color: "#facc15",
    container: "tonne",
    yes: [
      "Joghurtbecher, Butterpapier",
      "Plastikflaschen ohne Pfand, Shampooflaschen",
      "Konservendosen, Alufolie, Alu-Deckel",
      "Getränkekartons (Tetra Pak)",
      "Plastiktüten, Folien, Styroporschalen",
      "Kronkorken, Schraubdeckel",
      "Leere Spraydosen",
    ],
    no: ["Spielzeug, Eimer, Zahnbürsten (keine Verpackung)", "Batterien und Elektrogeräte", "Papier, Glas", "Essensreste, Windeln"],
    hint: "Nur Verpackungen. Löffelrein ausleeren, nicht spülen, Teile trennen (Deckel vom Becher).",
  },
  papier: {
    id: "papier",
    name: "Papiertonne (Blaue Tonne)",
    short: "Papier",
    color: "#2563eb",
    container: "tonne",
    yes: ["Zeitungen, Zeitschriften, Hefte", "Kartons (zusammengefaltet)", "Papiertüten, Eierkartons", "Briefumschläge (auch mit Fenster)"],
    no: [
      "Kassenbons (Thermopapier) → Restmüll",
      "Benutzte Taschentücher, Küchenrolle → Restmüll",
      "Backpapier, beschichtetes Papier → Restmüll",
      "Stark verschmutzter Pizzakarton → Restmüll",
      "Getränkekartons → Gelb",
    ],
    hint: "Kartons flach machen. Was fettig oder nass ist, gehört in den Restmüll.",
  },
  bio: {
    id: "bio",
    name: "Biotonne",
    short: "Bio",
    color: "#92400e",
    container: "tonne",
    yes: ["Obst- und Gemüsereste", "Kaffeesatz mit Filter, Teebeutel", "Eierschalen", "Gartenabfälle, Schnittblumen"],
    no: ["Plastiktüten, auch „kompostierbare“ (meist)", "Katzenstreu, Asche, Windeln", "Verpackungen"],
    hint: "Was genau erlaubt ist (gekochte Speisen, Fleisch, Papiertüten), regelt jede Gemeinde etwas anders.",
  },
  rest: {
    id: "rest",
    name: "Restmüll",
    short: "Rest",
    color: "#374151",
    container: "tonne",
    yes: [
      "Windeln, Hygieneartikel",
      "Staubsaugerbeutel, Kehricht",
      "Zigarettenkippen, kalte Asche",
      "Kassenbons, Fotos, Backpapier",
      "Porzellan, Keramik, Trinkgläser",
      "Medikamente (in den meisten Orten)",
    ],
    no: ["Wertstoffe (Verpackungen, Papier, Glas)", "Batterien, Elektrogeräte", "Farben, Chemikalien"],
    hint: "Für alles, was sich nicht verwerten lässt.",
  },
  glas: {
    id: "glas",
    name: "Altglascontainer",
    short: "Glas",
    color: "#0f766e",
    container: "container",
    yes: ["Flaschen ohne Pfand", "Konserven- und Marmeladengläser", "Nach Farbe: weiß, grün, braun (blaues Glas → grün)"],
    no: ["Trinkgläser, Porzellan → Restmüll", "Fenster- und Spiegelglas → Wertstoffhof", "Glühbirnen, Leuchtmittel"],
    hint: "Deckel ab (→ Gelb). Einwurfzeiten am Container beachten.",
  },
  altkleider: {
    id: "altkleider",
    name: "Altkleidercontainer",
    short: "Altkleider",
    color: "#be185d",
    container: "container",
    yes: ["Tragbare Kleidung", "Schuhe (paarweise gebunden)", "Bettwäsche, Handtücher"],
    no: ["Nasse oder stark verschmutzte Textilien"],
    hint: "In einen Beutel packen. Kaputte Textilien: je nach Ort Altkleider oder Restmüll.",
  },
  handel: {
    id: "handel",
    name: "Rückgabe im Handel",
    short: "Handel",
    color: "#7c3aed",
    container: "laden",
    yes: [
      "Pfandflaschen und -dosen",
      "Batterien und Akkus (Sammelbox im Laden)",
      "Kleine Elektrogeräte (größere Läden und Supermärkte)",
      "Energiesparlampen, LED-Lampen",
    ],
    no: [],
    hint: "Batterien nie in den Hausmüll: Brandgefahr. Pole von Lithium-Akkus abkleben.",
  },
  wertstoffhof: {
    id: "wertstoffhof",
    name: "Wertstoffhof",
    short: "Wertstoffhof",
    color: "#475569",
    container: "hof",
    yes: [
      "Elektrogeräte, Kabel",
      "Sperrmüll, Möbel, Matratzen",
      "Metallschrott",
      "Fenster- und Spiegelglas",
      "Große Kunststoffteile (Eimer, Spielzeug)",
      "Holz, Bauschutt (kleine Mengen)",
    ],
    no: [],
    hint: "Öffnungszeiten und Annahmebedingungen stehen bei deinem Abfallwirtschaftsbetrieb.",
  },
  schadstoff: {
    id: "schadstoff",
    name: "Schadstoffmobil / Problemstoffe",
    short: "Schadstoff",
    color: "#dc2626",
    container: "mobil",
    yes: [
      "Farben, Lacke, Lösungsmittel",
      "Spraydosen mit Restinhalt",
      "Chemikalien, Reiniger mit Gefahrsymbol",
      "Pflanzenschutzmittel, Altöl",
      "Quecksilber-Thermometer",
    ],
    no: [],
    hint: "Nur im Originalbehälter abgeben. Termine stehen im Abfallkalender.",
  },
};

// --- Local differences ---------------------------------------------------------

// What Claude found for one municipality (or the admin entered). available =
// false: there is no such collection (e.g. no Biotonne). Empty strings and
// lists mean "like the baseline".
export type LocalBin = {
  id: BinId;
  available: boolean;
  localName: string;
  container: Container | "";
  extraYes: string[];
  extraNo: string[];
  note: string;
};

export type LocalRules = {
  authority: string;
  authorityUrl: string | null;
  summary: string;
  bins: LocalBin[];
  notes: string[];
};

export type Source = { title: string; url: string };

export type RulesStatus = "pending" | "ready" | "failed";

// A lookup that has been pending this long died with its server function.
export const STALE_PENDING_MS = 10 * 60_000;

export type EffectiveBin = Bin & { available: boolean; extraYes: string[]; extraNo: string[]; note: string };

export function effectiveBins(rules: LocalRules | null): EffectiveBin[] {
  return binIds.map((id) => {
    const base = baseBins[id];
    const local = rules?.bins.find((bin) => bin.id === id);
    return {
      ...base,
      name: local?.localName.trim() || base.name,
      container: local?.container || base.container,
      available: local?.available ?? true,
      extraYes: local?.extraYes ?? [],
      extraNo: local?.extraNo ?? [],
      note: local?.note ?? "",
    };
  });
}

// The rules as plain text for the classification prompt.
export function rulesForPrompt(bins: EffectiveBin[], rules: LocalRules | null) {
  const lines = bins.map((bin) => {
    if (!bin.available) return `- ${bin.id}: NOT AVAILABLE in this municipality.`;
    const yes = [...bin.yes, ...bin.extraYes].join("; ");
    const no = [...bin.no, ...bin.extraNo].join("; ");
    return `- ${bin.id} ("${bin.name}", ${bin.container}): yes: ${yes}${no ? ` | no: ${no}` : ""}${bin.note ? ` | local note: ${bin.note}` : ""}`;
  });
  const notes = rules?.notes.length ? `\nLocal notes:\n${rules.notes.map((note) => `- ${note}`).join("\n")}` : "";
  return `${lines.join("\n")}${notes}`;
}

// --- Verdict --------------------------------------------------------------------

export type Confidence = "sicher" | "wahrscheinlich" | "unsicher";

export type VerdictPart = { part: string; bin: BinId; hint: string };

// What the AI says about one thing.
export type Verdict = {
  recognized: boolean;
  item: string;
  description: string;
  confidence: Confidence;
  bin: BinId;
  parts: VerdictPart[];
  tips: string[];
  check: string;
  hazard: boolean;
  hazardNote: string;
};

export const confidenceLabel: Record<Confidence, string> = {
  sicher: "Sicher",
  wahrscheinlich: "Wahrscheinlich",
  unsicher: "Unsicher",
};

export const placeLabel = (place: { label: string; name: string }) => place.label || place.name;

export const formatDate = (iso: string) => new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(iso));
