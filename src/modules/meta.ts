// Names and icons of all modules, without their pages, so client components
// (like the header) can use them. The pages are attached in registry.ts.

export type ModuleMeta = {
  id: string;
  name: string;
  description: string;
  icon: string;
};

export const moduleMeta = [
  { id: "books", name: "Bücher", description: "Leseliste, Fortschritt und Notizen.", icon: "📚" },
  {
    id: "fire",
    name: "FIRE",
    description: "Vermögen, Sparquote und der Weg zur finanziellen Unabhängigkeit.",
    icon: "🔥",
  },
  {
    id: "packing",
    name: "Packliste",
    description: "Packlisten für die Fahrt zwischen Zuhause und Uni, mit Vorlagen und Inventar.",
    icon: "🧳",
  },
] as const satisfies ModuleMeta[];

export type ModuleId = (typeof moduleMeta)[number]["id"];
