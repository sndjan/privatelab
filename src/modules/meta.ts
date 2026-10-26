// Names, icons and categories of all modules, without their pages, so client
// components (like the header) can use them. Pages of live modules are
// attached in registry.ts. Planned modules are ideas that only exist here:
// admins see them on the dashboard, marked as not implemented.

export const categories = [
  { id: "alltag", name: "Alltag & Finanzen" },
  { id: "sammlungen", name: "Listen & Sammlungen" },
  { id: "kreativ", name: "Kreativ & Erinnerungen" },
  { id: "spiele", name: "Spiele" },
  { id: "lernen", name: "Lernen & Wissen" },
] as const;

export type CategoryId = (typeof categories)[number]["id"];

export type ModuleMeta = {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: CategoryId;
  status: "live" | "planned";
};

export const moduleMeta: ModuleMeta[] = [
  // Alltag & Finanzen
  {
    id: "fire",
    name: "FIRE",
    description: "Vermögen, Sparquote und der Weg zur finanziellen Unabhängigkeit.",
    icon: "🔥",
    category: "alltag",
    status: "live",
  },
  {
    id: "packing",
    name: "Packliste",
    description: "Packlisten für die Fahrt zwischen Zuhause und Uni, mit Vorlagen und Inventar.",
    icon: "🧳",
    category: "alltag",
    status: "live",
  },
  {
    id: "worktime",
    name: "Arbeitszeit-Tracker",
    description: "Arbeitszeiten erfassen, mit Wochensummen und Überstunden.",
    icon: "⏱️",
    category: "alltag",
    status: "planned",
  },
  {
    id: "health",
    name: "Gesundheit-Dashboard",
    description: "Schlaf, Sport, Gewicht und andere Gesundheitswerte im Überblick.",
    icon: "❤️",
    category: "alltag",
    status: "planned",
  },

  // Listen & Sammlungen
  {
    id: "books",
    name: "Bücherregal",
    description: "Leseliste, Fortschritt, Bewertungen und Zitate.",
    icon: "📚",
    category: "sammlungen",
    status: "planned",
  },
  {
    id: "gifts",
    name: "Geschenke-Liste",
    description: "Geschenkideen für andere: für wen, zu welchem Anlass, schon besorgt?",
    icon: "🎁",
    category: "sammlungen",
    status: "planned",
  },
  {
    id: "wishlist",
    name: "Wunsch-Liste",
    description: "Eigene Wünsche sammeln und mit anderen teilen.",
    icon: "⭐",
    category: "sammlungen",
    status: "planned",
  },
  {
    id: "games",
    name: "Spielesammlung",
    description: "Welche Spiele ich habe, mit wem ich sie gespielt habe und wie sie mir gefallen.",
    icon: "🎲",
    category: "sammlungen",
    status: "planned",
  },
  {
    id: "coding-projects",
    name: "Coding-Projekte",
    description: "Ideen und laufende Programmierprojekte mit Status und Links.",
    icon: "💻",
    category: "sammlungen",
    status: "planned",
  },

  // Kreativ & Erinnerungen
  {
    id: "visionboard",
    name: "Visionboard",
    description: "Ziele und Träume als Board aus Bildern und Notizen.",
    icon: "🌄",
    category: "kreativ",
    status: "planned",
  },
  {
    id: "journal",
    name: "Digital Journal",
    description: "Ein digitales Tagebuch mit einem Eintrag pro Tag.",
    icon: "📓",
    category: "kreativ",
    status: "planned",
  },
  {
    id: "daily-collage",
    name: "Daily Images to Collage",
    description: "Jeden Tag ein Bild, daraus wird nach und nach eine Collage.",
    icon: "🖼️",
    category: "kreativ",
    status: "planned",
  },

  // Spiele
  {
    id: "games-olympics",
    name: "Spiele-Olympiade",
    description: "Turnier mit Freunden: Disziplinen, Teams, Punkte und Rangliste.",
    icon: "🏅",
    category: "spiele",
    status: "planned",
  },
  {
    id: "escape-room",
    name: "Escape Room Website",
    description: "Ein Escape Room im Browser: Rätsel lösen, Raum für Raum.",
    icon: "🔐",
    category: "spiele",
    status: "planned",
  },
  {
    id: "enigma",
    name: "Enigma",
    description: "Ein Rätsel- und Verschlüsselungsspiel rund um die Enigma.",
    icon: "⚙️",
    category: "spiele",
    status: "planned",
  },
  {
    id: "easy-to-hard",
    name: "Easy to Hard Game",
    description: "Ein Spiel, bei dem die Fragen von leicht nach schwer immer härter werden.",
    icon: "📈",
    category: "spiele",
    status: "planned",
  },
  {
    id: "hitster-countries",
    name: "Hitster mit Ländern",
    description: "Wie Hitster, nur mit Ländern statt Songs: richtig einordnen und Karten sammeln.",
    icon: "🌍",
    category: "spiele",
    status: "planned",
  },
  {
    id: "guess-the-fame",
    name: "Guess the Fame",
    description: "Berühmte Personen erraten.",
    icon: "🌟",
    category: "spiele",
    status: "planned",
  },
  {
    id: "coding-clicker",
    name: "Coding Clicker",
    description: "Ein Clicker-Spiel, bei dem man nach und nach die Seite freischaltet.",
    icon: "🖱️",
    category: "spiele",
    status: "planned",
  },

  // Lernen & Wissen
  {
    id: "anki-generator",
    name: "AI Anki Generator",
    description: "Karteikarten für Anki per KI aus Texten und Notizen erzeugen.",
    icon: "🧠",
    category: "lernen",
    status: "planned",
  },
  {
    id: "city-history",
    name: "History of City / Reisefakten",
    description: "Geschichte und spannende Fakten zu Städten, zum Beispiel für Reisen.",
    icon: "🏛️",
    category: "lernen",
    status: "planned",
  },
];
