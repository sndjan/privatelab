// Teilziele to pick from: the one point the coach watches and corrects in an
// exercise (BTV "Planung von Trainingseinheiten": Gesamtziel of the session →
// one Teilziel per Trainingsform, building on each other).
//
// Technique from the BTV Technikskript CP1 (mittlere Bewegungsausführung),
// footwork from the examples for Laufschnelligkeit, tactics as decisions with
// at least two options. `fix` comes from the CP2 script "Methodische
// Maßnahmen zur Technikkorrektur". `say` is how to put it for kids (BTV
// Bewegungsbeschreibung: short, plain words, with a comparison); those are
// suggestions, not from the scripts.

export type Teilziel = { label: string; say: string; fix?: string };
export type TeilzielArea = { name: string; note?: string; points: Teilziel[] };

export const teilzielAreas: TeilzielArea[] = [
  {
    name: "Vorhand",
    points: [
      { label: "Bereitschaftsstellung", say: "Füße breit, auf die Zehenspitzen, Knie leicht beugen" },
      {
        label: "Auftaktschritt und seitliche Stellung",
        say: "Rechter Fuß zur Seite, Schulter zeigt zum Netz",
        fix: "Mit dem linken Fuß seitlich über eine Markierung treten",
      },
      {
        label: "Oberkörperdrehung beim Ausholen",
        say: "Mit dem Griffende ein Foto vom Ball schießen",
        fix: "Nichtschlaghand zeigt auf den Ball · Nichtschlaghand bleibt beim Ausholen lange am Schläger · Schlägerspitze zeigt nach hinten",
      },
      { label: "Schläger im leichten Bogen nach hinten", say: "Schläger malt einen kleinen Bogen nach hinten" },
      {
        label: "Vorwärts-Aufwärts-Bewegung",
        say: "Von unten nach oben durch den Ball",
        fix: "Schlägerspitze berührt vorher den Boden · flach unter Hüfthöhe ausholen · über ein erhöhtes Netz spielen",
      },
      {
        label: "Treffpunkt seitlich vor dem Körper",
        say: "Ball vorne treffen, nicht neben dir",
        fix: "Zuwurf von hinten · cross spielen · kurzes, flaches Zuspiel · Hop-Hit",
      },
      {
        label: "Gewichtsverlagerung nach vorne",
        say: "In den Ball hineinsteigen",
        fix: "Hinsitzen, aufstehen und schlagen · nach dem Schlag um ein Hütchen vor dir laufen · kurzes Zuspiel",
      },
      { label: "Ausschwung weit in Schlagrichtung", say: "Schläger zeigt zum Ziel, dann über die linke Schulter" },
    ],
  },
  {
    name: "Rückhand",
    points: [
      { label: "Auftaktschritt und seitliche Stellung", say: "Linker Fuß zur Seite, Schulter zeigt zum Netz" },
      { label: "Oberkörperdrehung beim Ausholen", say: "Rücken dreht zum Netz" },
      { label: "Linke Hand führt den Schläger zurück", say: "Linke Hand am Schlägerherz nach hinten" },
      {
        label: "Vorwärts-Aufwärts-Bewegung",
        say: "Von unten nach oben durch den Ball",
        fix: "Schlägerspitze berührt vorher den Boden · über ein erhöhtes Netz spielen",
      },
      {
        label: "Treffpunkt seitlich vor dem Körper",
        say: "Ball vorne treffen",
        fix: "Zuwurf von hinten · cross spielen · kurzes, flaches Zuspiel",
      },
      { label: "Ausschwung weit in Schlagrichtung", say: "Schläger zeigt zum Ziel, dann hoch" },
    ],
  },
  {
    name: "Volley",
    points: [
      {
        label: "Kurze Ausholbewegung",
        say: "Schläger bleibt vor dir",
        fix: "Ball unter den Schlagarm klemmen · Rücken an die Wand · schnelles, kurzes Zuspiel · Ball mit einem Hütchen fangen",
      },
      {
        label: "Schlägerkopf über dem Treffpunkt",
        say: "Schlägerspitze zeigt nach oben",
        fix: "Ellbogen zeigt nach unten · Schlägerspitze zeigt zur Decke",
      },
      {
        label: "Vorwärts-Abwärts-Bewegung",
        say: "Von oben nach unten durch den Ball",
        fix: "Schläger zeigt am Ende auf ein Hütchen · nah am Netz, Ausschwung übers Netz",
      },
      {
        label: "Schritt nach vorne",
        say: "Mit dem linken Fuß nach vorne stampfen",
        fix: "Beim Schlagschritt deutlich aufstampfen · Schlagschritt auf eine Teppichfliese",
      },
      { label: "Fester Griff im Treffpunkt", say: "Hand fest, Ball nur blocken" },
    ],
  },
  {
    name: "Aufschlag",
    points: [
      { label: "Seitliche Stellung", say: "Linker Fuß zeigt zum rechten Netzpfosten" },
      { label: "Ballwurf", say: "Arm gestreckt, Ball in Stirnhöhe loslassen" },
      { label: "Schläger über die Schulter führen", say: "Schläger kratzt am Rücken" },
      {
        label: "Treffpunkt am höchsten Punkt",
        say: "So hoch wie möglich treffen",
        fix: "Ball mit dem obersten Drittel des Schlägers treffen · möglichst weit schlagen · Ball lange anschauen",
      },
    ],
  },
  {
    name: "Beinarbeit",
    note: "Koordination und Kondition, z. B. Laufschnelligkeit.",
    points: [
      { label: "Kleine, schnelle Schritte", say: "Trippeln wie ein Wiesel" },
      { label: "Oberkörper nach vorne", say: "Nase vor die Zehen" },
      { label: "Abstoppen und Richtungswechsel", say: "Bremsen, umdrehen, weiter" },
      { label: "Split-Step", say: "Kleiner Hüpfer, wenn der andere trifft" },
      { label: "Rückwärts mit Nachstell- oder Kreuzschritt", say: "Seitlich zurück, nicht rückwärts rennen" },
      { label: "Zurück zur Mitte", say: "Nach jedem Schlag zurück zum Hütchen" },
    ],
  },
  {
    name: "Taktik",
    note: "Ein taktisches Teilziel ist eine Entscheidung mit mindestens zwei Möglichkeiten.",
    points: [
      { label: "Entscheidung: cross oder longline", say: "Spiel dahin, wo der andere nicht steht" },
      { label: "Entscheidung: sicher oder angreifen", say: "Hoher Ball = sicher, kurzer Ball = angreifen" },
      { label: "Entscheidung: wann rücke ich ans Netz auf", say: "Nach einem kurzen Ball nach vorne" },
      { label: "Entscheidung: aggressiver oder defensiver Return", say: "Weit hinten = sicher, vorne = draufgehen" },
    ],
  },
];

// The catalog entry for a Teilziel, by its label (first match), or null for
// one the coach wrote.
export function findTeilziel(label: string): (Teilziel & { area: string }) | null {
  const wanted = label.trim().toLowerCase();
  if (!wanted) return null;
  for (const area of teilzielAreas) {
    const point = area.points.find((entry) => entry.label.toLowerCase() === wanted);
    if (point) return { ...point, area: area.name };
  }
  return null;
}

// The area a Teilziel belongs to, to open the picker there.
export const areaOf = (label: string) => Math.max(0, teilzielAreas.findIndex((area) => area.points.some((point) => point.label === label)));
