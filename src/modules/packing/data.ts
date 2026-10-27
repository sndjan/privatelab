// Shared by server and client components of the packing module.

export type Chip = { id: string; name: string; active: boolean };
export type Section = { id: string; name: string };
export type Item = {
  id: string;
  sectionId: string;
  chipId: string | null;
  name: string;
  note: string | null;
  done: boolean;
};

// An item counts (and shows in its section) unless its chip is switched off.
export function isShown(item: { chipId: string | null }, chips: Chip[]) {
  return !item.chipId || chips.find((chip) => chip.id === item.chipId)?.active !== false;
}

export function progress(items: Item[], chips: Chip[]) {
  const shown = items.filter((item) => isShown(item, chips));
  return { done: shown.filter((item) => item.done).length, total: shown.length };
}

// Starter data: two lists for the trips between Bellenberg (home) and
// Stuttgart (uni), plus the inventory in Stuttgart. Offered on an empty module.

type StarterItem = { name: string; note?: string; chip?: string };
type StarterList = { name: string; chips: string[]; sections: { name: string; items: StarterItem[] }[] };

const toiletry: StarterItem = { name: "Kulturtasche", note: "Rasierer, Necessaire, Lippenpflege, Kamm, Deo" };
const winterWear: StarterItem = { name: "Mütze, Schal, Handschuhe", chip: "Winter" };
const gym: StarterItem[] = [
  { name: "Gym-Schuhe", chip: "Gym" },
  { name: "Gym-Handtuch", chip: "Gym" },
  { name: "Gym-Flasche", chip: "Gym" },
];

export const starter = {
  lists: [
    {
      name: "Nach Stuttgart",
      chips: ["Winter", "Regen", "Gym"],
      sections: [
        {
          name: "Wertsachen & Technik",
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
          ],
        },
        {
          name: "Kleidung",
          items: [
            { name: "Jacke" },
            { name: "Gürtel" },
            winterWear,
            { name: "Cap" },
            { name: "Regenschirm", chip: "Regen" },
            { name: "Regenjacke", chip: "Regen" },
          ],
        },
        {
          name: "Bad & Wohnung",
          items: [
            toiletry,
            { name: "Handtuch für die Hände" },
            { name: "2 Handtücher" },
            { name: "Badezeug" },
            { name: "Bettwäsche" },
            { name: "Fußmatte" },
            { name: "Putzlappen" },
          ],
        },
        {
          name: "Sport",
          items: [
            ...gym,
            { name: "Joggingschuhe", chip: "Gym" },
            { name: "Protein-Shaker" },
            { name: "Mixbecher mit Verschluss" },
          ],
        },
        { name: "Essen", items: [{ name: "Essen (Frühstück)" }, { name: "Brot" }] },
        { name: "Vor der Abfahrt", items: [{ name: "Wasser auffüllen" }, { name: "Sprühflasche auffüllen" }] },
      ],
    },
    {
      name: "Nach Bellenberg",
      chips: ["Winter", "Gym"],
      sections: [
        {
          name: "Wertsachen & Technik",
          items: [
            { name: "Wertsachen", note: "Schlüssel, Geldbeutel, Laptop" },
            { name: "Arbeitslaptop" },
            { name: "Tastatur + Maus" },
            { name: "Headset" },
            { name: "Ladekabel" },
            { name: "Buch/Kindle" },
            { name: "Spiele" },
          ],
        },
        { name: "Kleidung", items: [winterWear, { name: "Cap" }, { name: "Schuhe" }] },
        { name: "Bad", items: [toiletry, { name: "Sprühflasche" }] },
        { name: "Sport", items: gym },
        {
          name: "Wäsche & Essen",
          items: [{ name: "Dreckwäsche" }, { name: "Boxen/Gläser" }, { name: "Essen aus Regal und Kühlschrank" }],
        },
        {
          name: "Vor der Abfahrt",
          items: [
            { name: "Liste machen, was ich brauche" },
            { name: "Podcasts herunterladen" },
            { name: "Blumen gießen" },
            { name: "Becher aus der Dusche" },
            { name: "Wasser auffüllen" },
            { name: "Müll ausleeren" },
            { name: "Müll runterbringen" },
          ],
        },
      ],
    },
  ] satisfies StarterList[],
  places: ["Bellenberg", "Stuttgart"],
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
