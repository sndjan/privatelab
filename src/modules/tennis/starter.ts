import type { DiagramItem, ExerciseInput } from "./data";

// Starter collection: well-known, kid-friendly drills and games, offered on an
// empty module. Every exercise is the user's own row afterwards, so it can be
// changed or deleted.

const coach = (x: number, y: number): DiagramItem => ({ type: "coach", x, y });
const kid = (x: number, y: number, label = ""): DiagramItem => ({ type: "player", x, y, ...(label && { label }) });
const cone = (x: number, y: number): DiagramItem => ({ type: "cone", x, y });
const target = (x: number, y: number): DiagramItem => ({ type: "target", x, y });
const basket = (x: number, y: number): DiagramItem => ({ type: "basket", x, y });
const ball = (x: number, y: number): DiagramItem => ({ type: "ball", x, y });
const run = (x: number, y: number, x2: number, y2: number): DiagramItem => ({ type: "run", x, y, x2, y2 });
const shot = (x: number, y: number, x2: number, y2: number): DiagramItem => ({ type: "shot", x, y, x2, y2 });

// The trainer feeding from the basket on the far side, a line of kids waiting.
const feeding = [coach(0.5, -8.5), basket(1.6, -8.5)];
const queue = (x: number, y: number, count = 3) =>
  Array.from({ length: count }, (_, index) => kid(x, y + index * 1.3, String(index + 2)));

export const starterExercises: ExerciseInput[] = [
  // --- Aufwärmen --------------------------------------------------------------
  {
    name: "Linien-Alarm",
    phase: "warmup",
    minutes: 8,
    summary: "Der Trainer ruft eine Linie, alle sprinten hin. Wer zuletzt ankommt, macht 3 Hampelmänner.",
    description:
      "Alle Kinder laufen locker im Feld herum. Der Trainer ruft eine Linie: „Grundlinie!“, „Netz!“, „T!“, „Seitenlinie!“. Alle sprinten dorthin und berühren die Linie mit dem Schläger. Später Zusatzaufgaben: rückwärts laufen, Sidesteps, auf einem Bein ankommen.",
    tips: ["Kleine schnelle Schritte!", "Bremsen mit tiefen Knien", "Schläger immer in der Hand"],
    focus: ["Beinarbeit", "Koordination"],
    diagram: {
      items: [coach(-6.5, -2), kid(-2, 3, "1"), kid(2, 5, "2"), kid(-1, 9, "3"), kid(3, 10, "4"), run(-2, 3, -2, 0.6), run(2, 5, 2, 0.6), run(-1, 9, -1, 11.5), run(3, 10, 4.1, 10)],
    },
  },
  {
    name: "Eierlauf-Staffel",
    phase: "warmup",
    minutes: 8,
    summary: "Teams laufen mit einem Ball auf dem Schläger um ein Hütchen und zurück.",
    description:
      "Zwei Teams stehen an der Grundlinie, gegenüber auf der Aufschlaglinie je ein Hütchen. Der Ball liegt auf der Schlägerfläche, laufen, um das Hütchen und zurück, Ball an den Nächsten übergeben. Fällt der Ball, kurz stehen bleiben und weiter. Steigerung: Ball auf dem Schläger hüpfen lassen oder auf der Rückhandseite balancieren.",
    tips: ["Schlägerfläche flach halten", "Augen auf den Ball", "Erst sicher, dann schnell"],
    focus: ["Ballgefühl", "Koordination"],
    diagram: {
      items: [kid(-2.5, 11, "A"), kid(-2.5, 12.3, "A"), kid(2.5, 11, "B"), kid(2.5, 12.3, "B"), cone(-2.5, 6.4), cone(2.5, 6.4), run(-2.2, 10, -2.2, 7.2), run(-2.8, 7.2, -2.8, 10), run(2.8, 10, 2.8, 7.2), run(2.2, 7.2, 2.2, 10)],
    },
  },
  {
    name: "Ball-Tippen-Challenge",
    phase: "warmup",
    minutes: 6,
    summary: "Ball auf dem Schläger hochtippen: Wer schafft die meisten am Stück?",
    description:
      "Jedes Kind hat einen Ball und tippt ihn auf der Schlägerfläche hoch. Runde 1: Vorhandseite. Runde 2: Rückhandseite. Runde 3: abwechselnd. Runde 4: auf den Boden prellen. Jeder zählt laut mit, der Trainer fragt nach Rekorden.",
    tips: ["Nur kleine Bewegungen aus dem Handgelenk", "Ball nicht höher als der Kopf", "Weich in den Knien"],
    focus: ["Ballgefühl", "Koordination"],
    diagram: { items: [kid(-3, 3, "1"), kid(0, 4, "2"), kid(3, 3, "3"), kid(-1.5, 8, "4"), kid(1.5, 8, "5"), ball(-3, 2), ball(0, 3), ball(3, 2), ball(-1.5, 7), ball(1.5, 7), coach(0, 11)] },
  },
  {
    name: "Partner-Werfen übers Netz",
    phase: "warmup",
    minutes: 8,
    summary: "Zu zweit Bälle übers Netz werfen und fangen: Aufwärmen für Augen und Füße.",
    description:
      "Paare stehen sich im Aufschlagfeld gegenüber. Ball von unten übers Netz werfen, der Partner fängt nach einem Aufsprung. Steigerung: mit der Nicht-Schlaghand fangen, seitlich werfen, damit der Partner laufen muss, Fangen mit einer Ballkugel-Dose.",
    tips: ["Seitlich zum Netz stellen", "Ball fängt man vor dem Körper", "Nach jedem Wurf zurück zur Mitte"],
    focus: ["Koordination", "Beinarbeit"],
    diagram: { items: [kid(-2.5, -4, "1"), kid(2.5, -4, "2"), kid(-2.5, 4, "1"), kid(2.5, 4, "2"), shot(-2.5, -3.4, -2.2, 3.4), shot(2.2, 3.4, 2.5, -3.4)] },
  },
  {
    name: "Linienfangen",
    phase: "warmup",
    minutes: 8,
    summary: "Fangen spielen, aber alle dürfen nur auf den Linien laufen.",
    description:
      "Ein Fänger (mit Ball in der Hand zum Markieren). Alle laufen nur auf den weißen Linien des Platzes. Wer gefangen wird, wird ebenfalls Fänger (Kettenfangen) oder tauscht. Wer neben die Linie tritt, macht einmal eine Schattenvorhand.",
    tips: ["Kopf hoch, Linien mit den Augen suchen", "Kleine Schritte an den Ecken"],
    focus: ["Beinarbeit"],
    diagram: { items: [kid(0, 6.4, "F"), kid(-4.1, 9, "1"), kid(4.1, 3, "2"), kid(0, 11.9, "3"), run(0, 6.4, -3.6, 6.4), run(-4.1, 9, -4.1, 11.4), run(4.1, 3, 4.1, 0.6)] },
  },
  {
    name: "Spiegelbild",
    phase: "warmup",
    minutes: 6,
    summary: "Zu zweit: einer macht Schattenschläge und Laufwege vor, der andere spiegelt sie.",
    description:
      "Paare stehen sich an der Aufschlaglinie gegenüber (gleiche Platzhälfte, Abstand ca. 3 Meter). Der Anführer macht Sidesteps, Schattenvorhand, Schattenrückhand, Volleys. Der Partner spiegelt alles so schnell wie möglich. Nach einer Minute Rollenwechsel.",
    tips: ["Immer in Bereitschaftsstellung zurück", "Schläger mit beiden Händen vor dem Körper"],
    focus: ["Beinarbeit", "Koordination"],
    diagram: { items: [kid(-2, 5, "A"), kid(-2, 8.5, "B"), kid(2, 5, "A"), kid(2, 8.5, "B"), run(-2, 5, -3.5, 5), run(-2, 8.5, -3.5, 8.5), run(2, 5, 3.5, 5), run(2, 8.5, 3.5, 8.5)] },
  },
  {
    name: "Hütchen umdrehen",
    phase: "warmup",
    minutes: 6,
    summary: "Team Rot dreht Hütchen um, Team Blau stellt sie wieder auf. Wer hat nach einer Minute mehr?",
    description:
      "Viele Hütchen liegen verteilt auf einer Platzhälfte, die Hälfte steht, die Hälfte liegt umgedreht. Team 1 dreht stehende Hütchen um, Team 2 stellt liegende auf. Nach 60 Sekunden wird gezählt. Variante: nur mit dem Schläger umdrehen.",
    tips: ["Tief in die Knie, nicht aus dem Rücken bücken", "Kurze Wege suchen"],
    focus: ["Beinarbeit"],
    diagram: { items: [cone(-3, 2), cone(0, 3.5), cone(3, 2.5), cone(-2, 7), cone(2.5, 8), cone(-4, 10), cone(0.5, 10.5), kid(-1, 5, "1"), kid(1.5, 6, "2"), run(-1, 5, -2.6, 2.6), run(1.5, 6, 2.3, 7.4)] },
  },
  {
    name: "Mini-Tennis einspielen",
    phase: "warmup",
    minutes: 8,
    summary: "Im Aufschlagfeld locker hin und her spielen, mit kurzer Ausholbewegung.",
    description:
      "Paare spielen sich im Aufschlagfeld gegenüber locker zu, Ball nur bis zur Aufschlaglinie. Ziel: 10 Ballwechsel am Stück, dann 20. Wer Fehler macht, startet wieder bei 0. Der Trainer geht durch und lobt.",
    tips: ["Kurz ausholen, weit durchschwingen", "Ball vor dem Körper treffen", "Nach dem Schlag zurück in die Mitte"],
    focus: ["Vorhand", "Rückhand", "Ballgefühl"],
    diagram: { items: [kid(-2.5, -4.5, "1"), kid(2.5, -4.5, "2"), kid(-2.5, 4.5, "1"), kid(2.5, 4.5, "2"), shot(-2.5, 4, -2.5, -4), shot(2.5, -4, 2.5, 4)] },
  },

  // --- Technik ------------------------------------------------------------------
  {
    name: "Vorhand-Zielschießen",
    phase: "technique",
    minutes: 15,
    summary: "Trainer spielt zu, die Kinder spielen Vorhand cross auf Ziele. Treffer = Punkte fürs Team.",
    description:
      "Kinder stehen hintereinander an der Grundlinie. Der Trainer spielt aus dem Korb eine Vorhand zu, das Kind spielt cross in das markierte Zielfeld (Reifen oder Hütchen). Danach hinten anstellen. Feld getroffen = 1 Punkt, Reifen = 3 Punkte. Zwei Teams oder alle gemeinsam auf eine Zielzahl.",
    tips: ["Früh ausholen!", "Treffpunkt vor dem Körper", "Ausschwingen über die Schulter"],
    focus: ["Vorhand"],
    diagram: { items: [...feeding, kid(-1, 10.5, "1"), ...queue(1, 11.5, 2), target(-3, -9), cone(-4, -7.5), cone(-2, -7.5), shot(1, -8, -1, 9.5), shot(-1, 9.5, -3, -8.6)] },
  },
  {
    name: "Rückhand-Zielschießen",
    phase: "technique",
    minutes: 15,
    summary: "Wie Vorhand-Zielschießen, aber mit Rückhand longline in eine Zone.",
    description:
      "Der Trainer spielt aus dem Korb auf die Rückhandseite. Ziel ist eine Hütchen-Zone longline hinter der Aufschlaglinie. Wer drei Treffer schafft, darf sich das nächste Ziel aussuchen. Bei Anfängern zuerst zuwerfen statt zuspielen.",
    tips: ["Schultern drehen, Rücken kurz zum Netz", "Beide Hände bis zum Schluss am Schläger", "Durch den Ball schwingen"],
    focus: ["Rückhand"],
    diagram: { items: [...feeding, kid(2.5, 10.5, "1"), ...queue(0, 11.5, 2), target(2.8, -9.5), cone(2, -8), cone(4, -8), shot(1, -8, 2.5, 9.5), shot(2.5, 9.5, 2.8, -9)] },
  },
  {
    name: "Pendel: Vorhand – Rückhand",
    phase: "technique",
    minutes: 12,
    summary: "Trainer spielt abwechselnd Vor- und Rückhand zu, das Kind läuft seitlich hin und her.",
    description:
      "Ein Kind an der Grundlinie, zwei Hütchen markieren Vorhand- und Rückhandpunkt. Der Trainer spielt abwechselnd 6 Bälle, danach wechseln. Nach jedem Schlag mit Sidesteps zurück zur Mitte (Hütchen in der Mitte antippen).",
    tips: ["Nach dem Schlag zurück zur Mitte!", "Sidesteps, nicht überkreuzen", "Früh drehen"],
    focus: ["Vorhand", "Rückhand", "Beinarbeit"],
    diagram: { items: [...feeding, kid(0, 10.5, "1"), cone(0, 11.3), cone(-3, 10), cone(3, 10), run(0, 10.5, -2.6, 10), run(0, 10.5, 2.6, 10), shot(1, -8, -3, 9.4), shot(1, -8, 3, 9.4), ...queue(-5, 12, 2)] },
  },
  {
    name: "Volley-Fangen",
    phase: "technique",
    minutes: 10,
    summary: "Vorstufe zum Volley: Ball in Volley-Haltung mit der Hand fangen, dann blocken.",
    description:
      "Die Kinder stehen am Netz. Der Trainer wirft Bälle zu, das Kind fängt sie vor dem Körper mit der freien Hand (wie ein Volley, Schritt nach vorn). Dann mit dem Schläger kurz am Hals gefasst blocken, später normal greifen. Fünf Bälle, dann wechseln.",
    tips: ["Schläger vor dem Körper, Kopf hoch", "Nicht ausholen, nur blocken!", "Schritt nach vorne"],
    focus: ["Volley"],
    diagram: { items: [coach(0, -4), basket(1.2, -4), kid(0, 2.2, "1"), ...queue(-3, 4.5), shot(0, -3.4, 0, 1.6), run(0, 2.8, 0, 2.2)] },
  },
  {
    name: "Volley-Reihe",
    phase: "technique",
    minutes: 12,
    summary: "Kinder stehen nebeneinander am Netz, der Trainer spielt reihum Volleys zu.",
    description:
      "Drei bis vier Kinder stehen nebeneinander zwischen Netz und Aufschlaglinie. Der Trainer spielt reihum Bälle zu, jedes Kind blockt einen Volley in ein Zielfeld. Wer daneben trifft, rückt ans Ende der Reihe. Schneller werden, wenn es gut klappt.",
    tips: ["Schläger oben halten", "Kurz und fest, wie eine Ohrfeige für den Ball", "Bereit bleiben!"],
    focus: ["Volley"],
    diagram: { items: [coach(0, -8), basket(1.2, -8), kid(-3, 2.5, "1"), kid(-1, 2.5, "2"), kid(1, 2.5, "3"), kid(3, 2.5, "4"), shot(0, -7.4, -1, 2), target(-2, -4), target(2, -4)] },
  },
  {
    name: "Aufschlag-Bowling",
    phase: "technique",
    minutes: 12,
    summary: "Mit dem Aufschlag Hütchen im Aufschlagfeld umwerfen: Strike!",
    description:
      "Im gegenüberliegenden Aufschlagfeld stehen Hütchen (oder Balldosen) wie Kegel. Die Kinder schlagen nacheinander auf. Umgeworfenes Hütchen = Punkt. Kleine Kinder dürfen von der Aufschlaglinie aus aufschlagen und mit jedem Treffer einen Schritt nach hinten gehen.",
    tips: ["Ball gerade hoch werfen, wie in einen Schornstein", "Werfen wie einen Ball weit weg", "Locker bleiben"],
    focus: ["Aufschlag"],
    diagram: { items: [kid(1, 11.9, "1"), ...queue(3, 12.5, 2), cone(-2, -5.5), cone(-2.8, -5.3), cone(-1.2, -5.3), cone(-2, -4.6), shot(1, 11.6, -2, -5.2), coach(-5, -2)] },
  },
  {
    name: "Aufschlag-Wurf",
    phase: "technique",
    minutes: 10,
    summary: "Die Aufschlagbewegung erst mit Ballwerfen lernen, dann mit Schläger.",
    description:
      "Die Kinder stehen an der Aufschlaglinie und werfen Bälle mit der Wurfbewegung (Ellbogen hoch, weit ausholen) übers Netz ins Aufschlagfeld gegenüber. Dann mit dem Schläger von derselben Stelle aufschlagen. Mit jedem dritten Treffer einen Schritt Richtung Grundlinie.",
    tips: ["Ellbogen hoch!", "Wie ein Ball, den du ganz weit werfen willst", "Danach mit dem Schläger genauso"],
    focus: ["Aufschlag", "Koordination"],
    diagram: { items: [kid(-2, 6.4, "1"), kid(0, 6.4, "2"), kid(2, 6.4, "3"), shot(-2, 6, -2, -4), shot(0, 6, 1.5, -4), shot(2, 6, 2.5, -3.5), coach(4.8, 4)] },
  },
  {
    name: "Rein, Schlag, Volley, Raus",
    phase: "technique",
    minutes: 12,
    summary: "Trainer spielt einen kurzen Ball, Kind läuft vor, schlägt, macht einen Volley und läuft zurück.",
    description:
      "Das Kind startet an der Grundlinie. Ball 1: kurzer Ball, das Kind läuft vor und spielt ihn longline. Ball 2: Volley am Netz. Danach zurücklaufen und das Hütchen an der Grundlinie berühren, der Nächste ist dran. Wer beide Bälle ins Feld spielt, bekommt einen Punkt.",
    tips: ["Nach dem Schlag weiter nach vorn!", "Vor dem Volley kurz stehen (Split-Step)", "Kopf hoch beim Laufen"],
    focus: ["Beinarbeit", "Volley", "Taktik"],
    diagram: { items: [...feeding, kid(0, 11, "1"), cone(0, 11.9), run(0, 10.4, 0, 5), run(0.3, 5, 0.3, 2.2), shot(1, -8, 0.6, 4.5), shot(1, -8, 1, 2), ...queue(-3, 12, 2)] },
  },
  {
    name: "Hinter die T-Linie",
    phase: "technique",
    minutes: 12,
    summary: "Ballwechsel in Paaren: Punkte gibt es nur für Bälle hinter der Aufschlaglinie.",
    description:
      "Zwei Kinder spielen von der Grundlinie Ballwechsel. Ein Ball, der hinter der Aufschlaglinie aufspringt, zählt einen Punkt. Bälle davor zählen nichts. Wer zuerst 7 hat, gewinnt. Schult hohe, tiefe Bälle statt Netzrollern.",
    tips: ["Hoch übers Netz spielen", "Von unten nach oben schwingen", "Lieber sicher als hart"],
    focus: ["Vorhand", "Rückhand", "Taktik"],
    diagram: { items: [kid(-1, -11, "1"), kid(1, 11, "2"), shot(1, 10.4, -1.5, -9), shot(-1, -10.4, 1.5, 9), cone(-4.1, -6.4), cone(4.1, -6.4), cone(-4.1, 6.4), cone(4.1, 6.4), coach(-6.5, 0)] },
  },
  {
    name: "Stationen-Zirkel",
    phase: "technique",
    minutes: 20,
    summary: "Drei Stationen, alle 4–5 Minuten Wechsel. Der Trainer betreut nur eine davon.",
    description:
      "Station 1 (Trainer): Zuspiel aus dem Korb, Vorhand und Rückhand. Station 2: Paare spielen Mini-Tennis im anderen Aufschlagfeld und zählen Ballwechsel. Station 3: Aufschlag auf Hütchen. Auf Pfiff gehen alle eine Station weiter. Gut, wenn man nicht alles gleichzeitig im Blick haben will.",
    tips: ["Vorher die Stationen in 30 Sekunden erklären", "Rekorde an den Stationen ansagen lassen", "Pfeifen statt rufen"],
    focus: ["Vorhand", "Rückhand", "Aufschlag"],
    diagram: {
      items: [coach(-2.5, -9), basket(-1.5, -9), kid(-2.5, 10, "1"), kid(-2.5, 11.3, "2"), shot(-2.5, -8.4, -2.5, 9.4), kid(3, -3, "3"), kid(3, 3, "4"), shot(3, 2.5, 3, -2.5), kid(5, 12, "5"), cone(-2, -4), cone(-3, -4.5), shot(5, 11.5, -2.3, -4)],
    },
  },
  {
    name: "Cross-Duell",
    phase: "technique",
    minutes: 12,
    summary: "Zwei gegen zwei auf halbem Platz: nur cross spielen, Fehler zählen für den Gegner.",
    description:
      "Der Platz wird diagonal geteilt, zwei Paare spielen gleichzeitig nur cross (Vorhand-Vorhand bzw. Rückhand-Rückhand). Eingespielt wird vom Kind, nicht vom Trainer. Wer zuerst 7 Punkte hat. Danach die Seiten wechseln, damit beide Schläge drankommen.",
    tips: ["Ball hoch und sicher übers Netz", "Zurück zur Mitte deiner Hälfte", "Rufe laut deinen Punktestand"],
    focus: ["Vorhand", "Rückhand"],
    diagram: { items: [kid(-3, -11, "1"), kid(3, 11, "2"), kid(3, -11, "3"), kid(-3, 11, "4"), shot(-3, -10.4, 2.6, 9), shot(3, -10.4, -2.6, 9), coach(-6.5, 0)] },
  },
  {
    name: "Lob über den Trainer",
    phase: "technique",
    minutes: 10,
    summary: "Der Trainer steht am Netz, die Kinder spielen einen hohen Lob über ihn drüber.",
    description:
      "Der Trainer steht mit Schläger am Netz und spielt einen Ball zur Grundlinie. Das Kind spielt einen Lob über ihn. Erreicht der Trainer den Ball mit hochgestrecktem Schläger, ist er im Spiel. Ball über den Trainer und ins Feld = Punkt.",
    tips: ["Schlägerfläche nach oben öffnen", "Von unten nach oben, ganz langsam", "Hoch wie ein Regenbogen"],
    focus: ["Ballgefühl", "Taktik"],
    diagram: { items: [coach(0, -2), basket(1.2, -2.5), kid(0, 11, "1"), ...queue(3, 12, 2), shot(0, -1.4, 0, 10.4), shot(0, 10.4, -0.8, -9)] },
  },
  {
    name: "Schmetterball-Fangen",
    phase: "technique",
    minutes: 10,
    summary: "Hohe Bälle erst mit der Hand fangen, dann als Schmetterball schlagen.",
    description:
      "Der Trainer spielt hohe Bälle zum Netz. Das Kind dreht seitlich ein, zeigt mit der freien Hand auf den Ball und fängt ihn über dem Kopf. Danach dieselbe Bewegung mit dem Schläger: zeigen, ausholen, schlagen. Ziel: Ball nach unten ins Feld.",
    tips: ["Mit der freien Hand auf den Ball zeigen", "Seitlich stellen", "Ball über dem Kopf treffen"],
    focus: ["Koordination", "Volley"],
    diagram: { items: [...feeding, kid(0, 3.5, "1"), ...queue(-3.5, 5), shot(1, -8, 0.2, 3)] },
  },
  {
    name: "Hütchen-Sprint mit Schlag",
    phase: "technique",
    minutes: 12,
    summary: "Um ein Hütchen sprinten, zugespielten Ball schlagen, zurück zum Start.",
    description:
      "Start an der Mitte der Grundlinie. Der Trainer zeigt nach links oder rechts. Das Kind läuft um das jeweilige Hütchen, bekommt einen Ball zugespielt, schlägt ihn ins Feld und läuft zurück. Fünf Bälle pro Durchgang.",
    tips: ["Explosiver Start", "Ausrichten vor dem Schlag", "Zurück bevor der nächste Ball kommt"],
    focus: ["Beinarbeit", "Vorhand", "Rückhand"],
    diagram: { items: [...feeding, kid(0, 11.5, "1"), cone(-3, 9), cone(3, 9), run(0, 11, -2.6, 9.4), run(0, 11, 2.6, 9.4), shot(1, -8, -3, 8.2)] },
  },
  {
    name: "Kurz – Lang",
    phase: "technique",
    minutes: 10,
    summary: "Auf Zuruf abwechselnd kurze und lange Bälle spielen: Gefühl für Tempo und Länge.",
    description:
      "Paare spielen von der Grundlinie Ballwechsel. Der Trainer ruft „kurz!“ oder „lang!“. Bei kurz muss der Ball vor der Aufschlaglinie landen, bei lang dahinter. Wer es schafft, bekommt einen Punkt.",
    tips: ["Für kurz: weicher Schlag, Schlägerfläche offen", "Für lang: hoch übers Netz", "Gut hinhören!"],
    focus: ["Ballgefühl", "Taktik"],
    diagram: { items: [kid(0, -11, "1"), kid(0, 11, "2"), shot(0, 10.4, -1, -3.5), shot(0, -10.4, 1.5, 9.5), coach(-6.5, 1)] },
  },
  {
    name: "Return-Schlange",
    phase: "technique",
    minutes: 10,
    summary: "Der Trainer schlägt locker auf, die Kinder spielen den Return in eine Zone.",
    description:
      "Der Trainer schlägt locker (von unten oder leicht) auf. Die Kinder stehen in einer Schlange und returnieren in eine markierte Zone. Treffer = Punkt, nach jedem Schlag hinten anstellen. Variante: Return cross gegen Return longline.",
    tips: ["Kurz ausholen, der Ball kommt schnell", "Split-Step, wenn der Trainer den Ball trifft", "Ins Feld zurück, nicht hart"],
    focus: ["Taktik", "Vorhand", "Rückhand"],
    diagram: { items: [coach(1, -11.9), basket(2.2, -12.3), kid(-2.5, 10.5, "1"), ...queue(-4.5, 11.5, 2), shot(1, -11.3, -2.3, 4), shot(-2.5, 10, -2, -9), target(-2, -9.5)] },
  },

  // --- Spiel ----------------------------------------------------------------------
  {
    name: "Rundlauf",
    phase: "game",
    minutes: 15,
    summary: "Alle laufen um das Netz und schlagen nacheinander einen Ball. Wer Fehler macht, verliert ein Leben.",
    description:
      "Die Kinder stehen in zwei Reihen auf beiden Seiten. Der Trainer spielt ein. Nach dem Schlag läuft man zur anderen Seite und stellt sich hinten an. Wer einen Fehler macht, verliert ein Leben (3 Leben). Am Ende Finale mit den letzten zwei. Ausgeschiedene feuern an oder helfen beim Ballsammeln.",
    tips: ["Nach dem Schlag sofort loslaufen", "Sicher spielen, nicht gewinnen wollen", "Lauter anfeuern!"],
    focus: ["Beinarbeit", "Ballgefühl"],
    diagram: { items: [kid(0, -10.5, "1"), kid(1.2, -11.8, "2"), kid(0, 10.5, "3"), kid(1.2, 11.8, "4"), shot(0, -10, 0, 9.8), run(0, -10.5, -5.5, -5), run(-5.5, -1, -5.5, 8), coach(6.5, 0)] },
  },
  {
    name: "König des Platzes",
    phase: "game",
    minutes: 15,
    summary: "Ein König verteidigt die Königsseite, die Herausforderer greifen an. Wer gewinnt, wird König.",
    description:
      "Ein Kind (oder Paar) ist König auf der Trainerseite. Der Trainer spielt den Herausforderern einen Ball ein, es wird ein Punkt ausgespielt. Gewinnt der Herausforderer, läuft er auf die Königsseite. Nur auf der Königsseite gibt es Punkte. Wer hat am Ende die meisten Königspunkte?",
    tips: ["Nach dem Punkt sofort bereit", "Erst den Ball ins Feld, dann gewinnen", "Freut euch für den neuen König!"],
    focus: ["Taktik"],
    diagram: { items: [kid(0, -10.5, "K"), coach(5, 9), basket(5, 10.2), kid(0, 10.5, "1"), ...queue(-3.5, 11.5, 2), shot(5, 8.4, 0.3, 10), shot(0, 10, 0, -9.8), run(0, 9.8, 2.5, 0.8)] },
  },
  {
    name: "Ziel-Bingo",
    phase: "game",
    minutes: 15,
    summary: "Neun Ziele auf der Trainerseite, jedes Team versucht drei in einer Reihe zu treffen.",
    description:
      "Auf der anderen Seite liegen 9 Reifen oder Hütchen in einem 3×3-Raster. Der Trainer spielt zu, die Teams schlagen abwechselnd. Getroffenes Ziel gehört dem Team (Hütchen umdrehen oder Farbe markieren). Drei in einer Reihe = Bingo!",
    tips: ["Zielen heißt: ruhig und sicher spielen", "Nach dem Schlag schauen, wo der Ball landet", "Team berät, welches Ziel als Nächstes"],
    focus: ["Vorhand", "Rückhand", "Ballgefühl"],
    diagram: {
      items: [target(-3, -10), target(0, -10), target(3, -10), target(-3, -7.5), target(0, -7.5), target(3, -7.5), target(-3, -4), target(0, -4), target(3, -4), coach(5.2, 6), basket(5.2, 7.2), kid(-1, 10, "A"), kid(1, 10, "B"), shot(-1, 9.4, -3, -7)],
    },
  },
  {
    name: "Dosen abräumen",
    phase: "game",
    minutes: 12,
    summary: "Balldosen und Hütchen auf der Gegenseite: Welches Team räumt zuerst alles ab?",
    description:
      "Auf der Trainerseite stehen Balldosen und Hütchen. Der Trainer spielt den Teams abwechselnd zu, jeder Treffer räumt ein Ziel ab. Das Team, das zuerst alles abgeräumt hat (oder in 5 Minuten mehr Treffer hat), gewinnt. Alternativ jedes Team hat eigene Ziele.",
    tips: ["Ganz durchschwingen", "Nicht zu fest, lieber genau"],
    focus: ["Vorhand", "Rückhand"],
    diagram: { items: [cone(-3, -9), cone(-1, -10), cone(1.5, -9.5), cone(3.5, -8), cone(-2, -6), cone(2, -5), coach(-5.2, 3), basket(-5.2, 4.2), kid(-1, 10, "A"), kid(1.5, 10.5, "B"), shot(-5, 3.6, -1, 9.4), shot(-1, 9.4, 1.5, -9)] },
  },
  {
    name: "Trainer-Doppel",
    phase: "game",
    minutes: 15,
    summary: "Doppel ohne Aufschlag: Der Trainer spielt jeden Punkt ein, Teams spielen bis 7.",
    description:
      "Zwei Teams à zwei Kinder spielen Doppel. Statt Aufschlag spielt der Trainer von der Seite einen Ball ein (abwechselnd zu beiden Teams). Punkte bis 7, dann rotieren die Teams. Wartende Kinder zählen mit oder sammeln Bälle.",
    tips: ["Absprache: Wer nimmt die Mitte?", "Nach dem Punkt abklatschen", "Netzspieler: Schläger oben"],
    focus: ["Taktik", "Volley"],
    diagram: { items: [kid(-2, -10, "A"), kid(2, -4, "A"), kid(-2, 4, "B"), kid(2, 10, "B"), coach(6.5, 0.5), basket(6.5, 1.7), shot(6.3, 0.9, 2.2, 9.4)] },
  },
  {
    name: "Bälle sammeln",
    phase: "game",
    minutes: 12,
    summary: "Treffer im Zielfeld = ein Ball aus dem Trainerkorb ins eigene Team-Lager.",
    description:
      "Zwei Teams, jedes hat ein Lager (Reifen) an der Grundlinie. Der Trainer spielt zu; wer ins Zielfeld trifft, darf einen Ball aus dem Korb holen und ins Lager legen. Welches Team hat nach 8 Minuten die meisten Bälle? Variante: Treffer darf auch einen Ball aus dem anderen Lager klauen.",
    tips: ["Schnell zurück in die Reihe", "Genau statt hart"],
    focus: ["Taktik", "Beinarbeit"],
    diagram: { items: [...feeding, target(-3.5, 12), target(3.5, 12), kid(-1, 10, "A"), kid(1, 10, "B"), shot(1, -8, -1, 9.4), shot(-1, 9.4, -2, -9), run(-1, 10.6, -3, 11.7)] },
  },
  {
    name: "Volley-Duell",
    phase: "game",
    minutes: 10,
    summary: "Zwei gegen zwei am Netz, nur Volleys, der Ball darf nicht aufspringen.",
    description:
      "Alle stehen zwischen Netz und Aufschlaglinie. Der Trainer wirft einen Ball ein, dann wird nur mit Volleys gespielt. Springt der Ball auf, ist der Punkt vorbei. Schnelle, lustige Punkte. Bis 5, dann Teams mischen.",
    tips: ["Schläger vor die Brust!", "Kurze Schläge, kein Ausholen", "Füße bewegen"],
    focus: ["Volley"],
    diagram: { items: [kid(-2, -3, "A"), kid(2, -3, "A"), kid(-2, 3, "B"), kid(2, 3, "B"), shot(-2, 2.5, 1.8, -2.5), shot(1.8, -2.5, 2, 2.5), coach(-6.5, 0)] },
  },
  {
    name: "Ballwechsel-Rekord",
    phase: "game",
    minutes: 10,
    summary: "Alle zusammen: Wie viele Ballwechsel schafft die Gruppe am Stück?",
    description:
      "Zwei Reihen auf beiden Seiten, jeder schlägt einen Ball und stellt sich wieder hinten an (wie Rundlauf, aber ohne Laufen und ohne Ausscheiden). Alle zählen laut mit. Ziel: den Gruppenrekord brechen. Der Rekord wird notiert und nächste Woche angegriffen.",
    tips: ["Alle zählen laut!", "Hoch und in die Mitte spielen", "Gemeinsam statt gegeneinander"],
    focus: ["Ballgefühl"],
    diagram: { items: [kid(0, -9, "1"), kid(0, -10.3, "3"), kid(0, 9, "2"), kid(0, 10.3, "4"), shot(0, -8.4, 0.5, 8.4), shot(0.5, 8.4, -0.5, -8.4), coach(6.5, 0)] },
  },
  {
    name: "Auf- und Absteiger",
    phase: "game",
    minutes: 15,
    summary: "Kurze Matches in mehreren Feldern: Gewinner steigen auf, Verlierer ab.",
    description:
      "Die Aufschlagfelder (oder mehrere Plätze) sind Ligen: Feld 1 = Bundesliga. In jedem Feld wird bis 5 oder für 3 Minuten gespielt. Gewinner rücken ein Feld höher, Verlierer eins tiefer. Wer ist am Ende in der Bundesliga?",
    tips: ["Gegen jeden gut spielen", "Fair zählen, laut ansagen"],
    focus: ["Taktik"],
    diagram: { items: [kid(-2.5, -4.5, "1"), kid(-2.5, 4.5, "2"), kid(2.5, -4.5, "3"), kid(2.5, 4.5, "4"), run(-2.5, 5.2, 1.8, 5.2), run(2.5, -5.2, -1.8, -5.2), coach(-6.5, 0)] },
  },
  {
    name: "Burg verteidigen",
    phase: "game",
    minutes: 12,
    summary: "Jeder hat eine Hütchenburg hinter sich und versucht, die Burg des Gegners zu treffen.",
    description:
      "Zwei Kinder spielen gegeneinander, jedes hat hinter sich einen Hütchen-Turm (oder Dose). Es wird Ballwechsel gespielt; wer die Burg des Gegners trifft, bekommt 3 Punkte, normaler Punkt = 1. Lustig und schult Ziel-Spielen und Verteidigung.",
    tips: ["Erst aufbauen, dann zielen", "Burg schützen heißt: zurück zur Mitte"],
    focus: ["Taktik", "Ballgefühl"],
    diagram: { items: [kid(0, -9.5, "1"), cone(0, -12.5), kid(0, 9.5, "2"), cone(0, 12.5), shot(0, 9, 0.2, -12)] },
  },
  {
    name: "Ampel-Tennis",
    phase: "game",
    minutes: 10,
    summary: "Der Trainer ruft Farben: Rot = kurz, Gelb = in die Mitte, Grün = volle Länge.",
    description:
      "Paare spielen Ballwechsel. Der Trainer ruft während des Spiels Ampelfarben. Rot: kurzer Ball ins Aufschlagfeld. Gelb: in die Mitte. Grün: lang zur Grundlinie. Wer die Farbe richtig umsetzt, bekommt einen Punkt.",
    tips: ["Zuhören und reagieren", "Tempo anpassen, nicht nur Richtung"],
    focus: ["Ballgefühl", "Taktik"],
    diagram: { items: [kid(-2, -11, "1"), kid(2, 11, "2"), shot(2, 10.4, -2, -3), shot(-2, -10.4, 1.5, 10), coach(-6.5, 0)] },
  },

  // --- Abschluss ------------------------------------------------------------------
  {
    name: "Ballsammel-Rennen",
    phase: "cooldown",
    minutes: 5,
    summary: "Zwei Teams sammeln alle Bälle: Welcher Korb ist voller?",
    description:
      "Jedes Team bekommt einen Korb (oder eine Platzhälfte). Auf Pfiff werden alle Bälle eingesammelt, nur mit dem Schläger aufheben (draufklopfen, mit Fuß und Schläger) erlaubt. Danach wird gezählt. Spart dem Trainer das Aufräumen.",
    tips: ["Nur mit dem Schläger!", "Zählen alle gemeinsam"],
    focus: ["Ballgefühl"],
    diagram: { items: [basket(-3, 12.5), basket(3, 12.5), ball(-2, 5), ball(1, 3), ball(3, 8), ball(-4, 9), ball(0, 7), kid(-1, 8, "A"), kid(2, 5, "B"), run(-1, 8, -2.6, 11.8), run(2, 5, 1.2, 3.4)] },
  },
  {
    name: "Korbfangen",
    phase: "cooldown",
    minutes: 8,
    summary: "Der Trainer hält den Ballkorb hoch, die Kinder versuchen, hineinzuspielen.",
    description:
      "Der Trainer steht auf der anderen Seite und hält den leeren Ballkorb. Die Kinder spielen sich selbst einen Ball zu (fallen lassen und schlagen) und versuchen, in den Korb zu treffen, der Trainer hilft ein bisschen mit. Jeder Treffer = großer Jubel. Gut als lustiger Abschluss.",
    tips: ["Hoher, weicher Ball", "Wer trifft, bekommt Applaus"],
    focus: ["Ballgefühl"],
    diagram: { items: [coach(0, -8), basket(0, -9.3), kid(-2, 9, "1"), kid(0, 10, "2"), kid(2, 9, "3"), shot(-2, 8.4, 0, -8.8), shot(2, 8.4, 0.3, -8.6)] },
  },
  {
    name: "Letzter Aufschlag",
    phase: "cooldown",
    minutes: 5,
    summary: "Jeder hat genau einen Aufschlag auf ein Ziel. Wer trifft, wählt das Spiel für nächste Woche.",
    description:
      "Alle stellen sich an der Grundlinie auf. Ein Ziel (Dose oder Reifen) im Aufschlagfeld. Jedes Kind hat einen Versuch. Wer trifft (oder am nächsten dran ist), darf das Lieblingsspiel für die nächste Stunde aussuchen. Wird hier in den Notizen eingetragen.",
    tips: ["Konzentration: nur ein Versuch!", "Alle anderen sind leise"],
    focus: ["Aufschlag"],
    diagram: { items: [kid(1, 11.9, "1"), kid(2.5, 12.5, "2"), kid(4, 12.5, "3"), target(-2, -5), shot(1, 11.4, -2, -5)] },
  },
  {
    name: "Abschlussrunde mit Abklatschen",
    phase: "cooldown",
    minutes: 5,
    summary: "Kurz im Kreis: Was hat am meisten Spaß gemacht? Dann Abklatsch-Tunnel.",
    description:
      "Alle sitzen im Kreis am Netz. Jedes Kind sagt in einem Satz, was heute am meisten Spaß gemacht hat oder was es gelernt hat. Der Trainer lobt jedes Kind für eine konkrete Sache. Zum Schluss bilden alle einen Tunnel und jeder läuft einmal durch und wird abgeklatscht.",
    tips: ["Für jedes Kind eine konkrete Sache loben", "Den Rekord vom Tag noch einmal nennen"],
    focus: [],
    diagram: { items: [coach(0, 2.5), kid(-2, 2.5, "1"), kid(2, 2.5, "2"), kid(-1.4, 4.2, "3"), kid(1.4, 4.2, "4"), kid(0, 5, "5")] },
  },
];
