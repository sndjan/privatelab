// Shared by server and client components of the packing module.

export type Condition = "winter" | "gym" | "tennis" | "rain" | "long" | "exams";
export type ItemKind = "pack" | "task";

// Must match the check constraints in supabase/migrations/*_packing.sql.
export const conditions: { value: Condition; label: string }[] = [
  { value: "winter", label: "Winter" },
  { value: "gym", label: "Gym" },
  { value: "tennis", label: "Tennis" },
  { value: "rain", label: "Regen" },
  { value: "long", label: "Länger als 5 Tage" },
  { value: "exams", label: "Prüfungsphase" },
];

export function conditionLabel(value: string) {
  return conditions.find((condition) => condition.value === value)?.label ?? value;
}

export function isCondition(value: string): value is Condition {
  return conditions.some((condition) => condition.value === value);
}

// Winter is preselected from November to March.
export function defaultConditions(date: Date): Condition[] {
  const month = date.getMonth() + 1;
  return month >= 11 || month <= 3 ? ["winter"] : [];
}

// An item shows up in a run when the run has all of the item's conditions.
export function appliesTo(itemConditions: string[], runConditions: string[]) {
  return itemConditions.every((condition) => runConditions.includes(condition));
}

export function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function defaultTitle(date: string) {
  const label = new Date(`${date}T00:00:00`).toLocaleDateString("de-DE", { day: "numeric", month: "short" });
  return `Reise ${label}`;
}

// Starter data: Bellenberg (home) ↔ Stuttgart (uni), offered on an empty module.

type StarterItem = { name: string; note?: string; kind?: ItemKind; conditions?: Condition[] };

const toiletry: StarterItem = { name: "Kulturtasche", note: "Rasierer, Necessaire, Lippenpflege, Kamm, Deo" };
const winterWear: StarterItem = { name: "Mütze, Schal, Handschuhe", conditions: ["winter"] };
const gym: StarterItem[] = [
  { name: "Gym-Schuhe", conditions: ["gym"] },
  { name: "Gym-Handtuch", conditions: ["gym"] },
  { name: "Gym-Flasche", conditions: ["gym"] },
];

export const starter = {
  places: ["Bellenberg", "Stuttgart"] as const,
  templates: [
    {
      name: "Nach Bellenberg",
      from: "Stuttgart",
      to: "Bellenberg",
      items: [
        { name: "Wertsachen", note: "Schlüssel, Geldbeutel, Laptop" },
        { name: "Arbeitslaptop" },
        { name: "Tastatur + Maus" },
        { name: "Headset" },
        { name: "Ladekabel" },
        { name: "Buch/Kindle" },
        { name: "Spiele" },
        { name: "Sprühflasche" },
        toiletry,
        winterWear,
        { name: "Cap" },
        { name: "Schuhe" },
        ...gym,
        { name: "Dreckwäsche" },
        { name: "Boxen/Gläser" },
        { name: "Essen aus Regal und Kühlschrank" },
        { name: "Liste machen, was ich brauche", kind: "task" },
        { name: "Podcasts herunterladen", kind: "task" },
        { name: "Blumen gießen", kind: "task" },
        { name: "Becher aus der Dusche", kind: "task" },
        { name: "Wasser auffüllen", kind: "task" },
        { name: "Müll ausleeren", kind: "task" },
        { name: "Müll runterbringen", kind: "task" },
      ] satisfies StarterItem[],
    },
    {
      name: "Nach Stuttgart",
      from: "Bellenberg",
      to: "Stuttgart",
      items: [
        { name: "Schlüssel" },
        { name: "Arbeitslaptop" },
        { name: "Privat-Laptop" },
        { name: "Tastatur" },
        { name: "Maus" },
        { name: "Headset" },
        { name: "Ladekabel" },
        { name: "Buch/Kindle" },
        { name: "Uhr" },
        { name: "Jacke" },
        { name: "Gürtel" },
        winterWear,
        { name: "Cap" },
        { name: "Regenschirm", conditions: ["rain"] },
        { name: "Regenjacke", conditions: ["rain"] },
        toiletry,
        { name: "Handtuch für die Hände" },
        { name: "2 Handtücher" },
        { name: "Badezeug" },
        { name: "Bettwäsche" },
        { name: "Fußmatte" },
        { name: "Putzlappen" },
        ...gym,
        { name: "Joggingschuhe", conditions: ["gym"] },
        { name: "Protein-Shaker" },
        { name: "Mixbecher mit Verschluss" },
        { name: "Essen (Frühstück)" },
        { name: "Brot" },
        { name: "Wasser auffüllen", kind: "task" },
        { name: "Sprühflasche auffüllen", kind: "task" },
      ] satisfies StarterItem[],
    },
  ],
  // What is already in Stuttgart. 0 = none there, so it has to come along.
  inventory: {
    Stuttgart: [
      ["T-Shirts", 0],
      ["Socken", 0],
      ["Unterhosen", 0],
      ["Sweater", 0],
      ["Jeans", 0],
      ["Lange Sporthose", 0],
      ["Kurze Hosen", 1],
      ["Jogginghose", 1],
      ["Pulli", 1],
      ["Iconcxm-Pulli", 1],
      ["Icon-Shirts", 2],
      ["Sport-T-Shirts", 2],
      ["Kurze Sporthose", 1],
      ["Überziehteil für Sport", 1],
      ["Tracht", 1],
    ] as [string, number][],
  } as Record<string, [string, number][]>,
};
