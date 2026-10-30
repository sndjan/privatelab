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

const exercises: Omit<ExerciseInput, "playersMin" | "playersMax" | "variations">[] = [
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
    minutes: 10,
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
    minutes: 10,
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

  // --- Aus der BTV-C-Trainer-Ausbildung (Lehrgangsskripte CP1/CP2) -----------
  {
    name: "Feuer-Wasser-Sturm",
    phase: "warmup",
    minutes: 6,
    summary: "Alle laufen kreuz und quer, auf Zuruf: Feuer = Tappings, Wasser = Strecksprünge, Sturm = in die Hocke.",
    description:
      "Die ganze Gruppe bewegt sich auf einer Platzhälfte kreuz und quer, mal vorwärts, rückwärts, seitlich. Der Trainer ruft unregelmäßig: „Feuer!“ – schnelle Tappings am Ort (Flammen austreten), „Wasser!“ – hohe Strecksprünge (Luft holen), „Sturm!“ – in die Hocke (wenig Angriffsfläche). Bei „Entwarnung!“ laufen alle locker weiter.",
    tips: ["Kopf hoch, niemanden anrempeln", "Schnell reagieren!", "Ganz tief in die Hocke"],
    focus: ["Koordination", "Beinarbeit"],
    diagram: { items: [coach(-6.5, 3), kid(-3, 2, "1"), kid(2, 3, "2"), kid(-1, 7, "3"), kid(3, 9, "4"), kid(0, 10.5, "5"), run(-3, 2, -1, 4.5), run(2, 3, 3.5, 5.5), run(-1, 7, -3.5, 8.5), run(3, 9, 1.5, 7.5)] },
  },
  {
    name: "Staffel Balltransport",
    phase: "warmup",
    minutes: 8,
    summary: "Zwei Teams bringen einen Ball von Kegel zu Kegel und zurück. Welches Team ist zuerst fertig?",
    description:
      "Zwei gleich starke Teams stehen hinter der Grundlinie. Auf der T-Linie und kurz vor dem Netz steht für jedes Team ein Kegel, auf dem T-Linien-Kegel liegt ein Ball. Der Erste läuft hin, bringt den Ball zu Kegel 2, legt ihn ab und schlägt den Nächsten ab. Der läuft direkt zu Kegel 2 und bringt den Ball zurück zu Kegel 1. Erst nach den Ballspielen spielen, Staffeln brauchen warme Beine.",
    tips: ["Ball ablegen, nicht werfen!", "Abklatschen erst hinter der Linie", "Anfeuern!"],
    focus: ["Koordination", "Beinarbeit"],
    diagram: { items: [kid(-2.5, 12.3, "A"), kid(-2.5, 13.5, "A"), kid(2.5, 12.3, "B"), kid(2.5, 13.5, "B"), cone(-2.5, 6.4), cone(-2.5, 1.2), cone(2.5, 6.4), cone(2.5, 1.2), ball(-2.5, 6), run(-2.5, 11.6, -2.5, 6.9), run(2.5, 11.6, 2.5, 1.7)] },
  },
  {
    name: "Eistüten bauen",
    phase: "warmup",
    minutes: 6,
    summary: "Der Trainer wirft Bälle zu, die Kinder fangen sie mit einem umgedrehten Hütchen: eine Eistüte.",
    description:
      "Jedes Kind hat ein Hütchen in der Hand, mit der Öffnung nach oben. Der Trainer wirft Bälle variabel zu: hoch, flach, links, rechts. Die Kinder fangen den Ball nach einem Aufsprung mit dem Hütchen, kippen ihn aus und laufen zurück. Für jede gefangene Eistüte gibt es einen Punkt.",
    tips: ["Zum Ball laufen, nicht warten", "Hütchen ruhig halten", "Nach dem Fangen zurück zur Mitte"],
    focus: ["Ballgefühl", "Beinarbeit", "Koordination"],
    diagram: { items: [coach(0, -2), basket(1.2, -2), kid(-2, 4, "1"), kid(2, 4.5, "2"), kid(0, 7, "3"), shot(0, -1.5, -2, 3.5), shot(0, -1.5, 2, 4)] },
  },
  {
    name: "Halte den Platz frei",
    phase: "warmup",
    minutes: 5,
    summary: "Zwei Teams werfen Bälle über das Netz: Wer hat nach einer Minute weniger Bälle auf seiner Seite?",
    description:
      "Auf jeder Platzhälfte liegen gleich viele Bälle (z. B. 20). Auf Kommando werfen beide Teams die Bälle auf die andere Seite, immer nur einen Ball aufheben und nur über Schulterhöhe werfen – das ist schon die Wurfbewegung für den Aufschlag. Nach einer Minute zählen: Welches Team hat weniger Bälle auf seiner Hälfte?",
    tips: ["Seitlich stellen, Ellbogen hoch", "Nur ein Ball in der Hand", "Weit nach oben werfen"],
    focus: ["Aufschlag", "Koordination"],
    diagram: { items: [kid(-2.5, -6, "A"), kid(2.5, -8, "A"), kid(-2.5, 6, "B"), kid(2.5, 8, "B"), ball(-1, -4), ball(1, -9), ball(0, 5), ball(-3, 9), shot(-2.5, -5.5, -1, 7), shot(2.5, 7.5, 1, -6)] },
  },
  {
    name: "Formel-1-Rennen",
    phase: "warmup",
    minutes: 5,
    summary: "Den Ball am Schlägerrahmen entlang Runden drehen lassen, ohne dass er herunterfällt.",
    description:
      "Jedes Kind legt einen Ball auf die Schlägerfläche und lässt ihn durch leichtes Kippen am Rahmen entlang kreisen: das Formel-1-Rennen. Wer schafft die meisten Runden? Dann im Gehen, dann im Laufen um ein Hütchen herum, dann in die andere Richtung.",
    tips: ["Nur ganz wenig kippen", "Augen auf den Ball", "Erst langsam, dann schnell"],
    focus: ["Ballgefühl", "Koordination"],
    diagram: { items: [kid(-3, 3, "1"), kid(0, 4, "2"), kid(3, 3, "3"), cone(-1.5, 8), cone(1.5, 8), run(0, 4, 1.5, 7.5), coach(0, 10.5)] },
  },
  {
    name: "Rollhockey",
    phase: "warmup",
    minutes: 6,
    summary: "Zu zweit den Ball mit dem Schläger am Boden hin und her rollen, mit Vorhand- und Rückhandbewegung.",
    description:
      "Paare stehen sich in 3–4 Metern Abstand gegenüber und rollen den Ball mit dem Schläger über den Boden hin und her, mit einer vorhand- bzw. rückhandähnlichen Bewegung. Erst nur Vorhand, dann nur Rückhand, dann im Wechsel. Zum Schluss zu viert reihum, der Letzte rollt auf ein Ziel.",
    tips: ["Schlägerfläche zum Partner", "Ball vor dem Körper treffen", "In die Knie gehen"],
    focus: ["Vorhand", "Rückhand", "Ballgefühl"],
    diagram: { items: [kid(-3, 3, "1"), kid(-3, 7, "2"), kid(2, 3, "3"), kid(2, 7, "4"), shot(-3, 3.5, -3, 6.5), shot(2, 6.5, 2, 3.5), target(4, 10)] },
  },
  {
    name: "Klappball",
    phase: "technique",
    minutes: 8,
    summary: "Zu zweit über kurze Distanz auf die Teppichfliese des Partners spielen; jeder Treffer klappt sie weiter nach hinten.",
    description:
      "Zwei Kinder stehen sich in 3–4 Metern Abstand gegenüber, vor jedem liegt eine Teppichfliese (oder eine ausgebreitete Zeitung). Sie spielen sich den Ball mit Vorhand oder Rückhand zu und versuchen, die Fliese des anderen zu treffen. Bei jedem Treffer wird die getroffene Fliese einmal nach hinten geklappt – das Feld wird größer. Wer zuerst bis zur Linie geklappt hat, gewinnt.",
    tips: ["Von unten nach oben schwingen", "Ball am höchsten Punkt über der Fliese", "Nach dem Schlag bereit machen"],
    focus: ["Vorhand", "Rückhand", "Ballgefühl"],
    diagram: { items: [kid(-2.5, 1.5, "1"), kid(-2.5, 5.5, "2"), kid(2.5, 1.5, "3"), kid(2.5, 5.5, "4"), target(-2.5, 2.5), target(-2.5, 4.5), target(2.5, 2.5), target(2.5, 4.5), shot(-2.5, 5, -2.5, 2.6)] },
  },
  {
    name: "Lenkradvolley",
    phase: "technique",
    minutes: 8,
    summary: "Den Schläger wie ein Lenkrad mit beiden Händen halten und zugeworfene Bälle als Volley zurückblocken.",
    description:
      "Paare im Aufschlagfeld: A wirft den Ball von unten zu, B hält den Schläger mit beiden Händen am Rahmen wie ein Lenkrad und blockt den Ball als Vorhand-Volley zurück, A fängt. Nach 10 Bällen Wechsel. Dann Rückhand-Volley, dann normal am Griff, dann zuspielen statt zuwerfen.",
    tips: ["Schlägerkopf oben", "Nicht ausholen, nur blocken", "Ball vor dem Körper treffen"],
    focus: ["Volley"],
    diagram: { items: [kid(-2.5, -2, "B"), kid(2.5, -2, "B"), kid(-2.5, 3.5, "A"), kid(2.5, 3.5, "A"), shot(-2.5, 3, -2.5, -1.5), shot(-2.2, -1.5, -2.2, 3)] },
  },
  {
    name: "Wer kriegt die Dose voll?",
    phase: "technique",
    minutes: 8,
    summary: "Einer wirft zu und fängt den Volley mit der Balldose wieder auf. Ist die Dose voll, wird gewechselt.",
    description:
      "Paare: A steht auf einer Teppichfliese, wirft den Ball zu und fängt ihn mit einer Balldose wieder auf. B spielt den Ball aus der seitlichen Stellung mit einem Rückhand-Volley (oder Vorhand-Volley) zurück. Für jeden gefangenen Ball gibt es einen Punkt, ist die Dose voll (3–4 Bälle), wird gewechselt. Gut als Station.",
    tips: ["Seitlich stellen", "Kurz blocken, kein Ausholen", "Genau zum Partner"],
    focus: ["Volley", "Ballgefühl"],
    diagram: { items: [kid(-2, -2.5, "B"), kid(-2, 4, "A"), target(-2, 4.8), shot(-2, 3.5, -2, -2), shot(-1.7, -2, -1.7, 3.5), kid(2.5, -2.5, "B"), kid(2.5, 4, "A"), target(2.5, 4.8)] },
  },
  {
    name: "Aufschlag-Return-Fangen",
    phase: "technique",
    minutes: 10,
    summary: "Paare: A schlägt auf, B retourniert, A fängt. Gelingt alles, gibt es einen Punkt fürs Team.",
    description:
      "Zwei Paare spielen gleichzeitig cross. A schlägt auf, B spielt den Return zu A zurück, A fängt den Ball nach einem Aufsprung. Landen Aufschlag und Return im Feld und wird gefangen, gibt es einen Punkt und A schlägt sofort wieder auf. Nach 1,5 Minuten Aufgabenwechsel. Welches Paar hat nach 3 Minuten die meisten Punkte?",
    tips: ["Ball hoch genug werfen", "Return ruhig, Hauptsache rein", "Split-Step beim Aufschlag des Partners"],
    focus: ["Aufschlag", "Ballgefühl"],
    diagram: { items: [kid(-1, -11.9, "A"), kid(2.5, 11.9, "B"), kid(1, -11.9, "C"), kid(-2.5, 11.9, "D"), shot(-1, -11.4, 2.5, 5.5), shot(2.5, 11.4, -1, -10.5), coach(-6.5, 0)] },
  },
  {
    name: "Mensch ärgere dich nicht",
    phase: "technique",
    minutes: 10,
    summary: "Teamwettkampf beim Aufschlag: Jedes getroffene Zielfeld wird mit einem Hütchen markiert. Wer hat zuerst alle drei?",
    description:
      "Zwei Teams in Reihen, Aufschlag cross in drei markierte Zielfelder. Wer trifft, läuft außen herum auf die andere Seite und stellt ein Hütchen in das getroffene Feld. Jedes Kind schlägt nur einmal auf, dann ist der Nächste dran. Das Team, das zuerst alle drei Felder markiert hat, gewinnt. Laufweg aus Sicherheitsgründen immer außerhalb des Feldes.",
    tips: ["Ruhig aufwerfen", "Langer Ausschwung in Richtung Ziel", "Laufweg außen herum!"],
    focus: ["Aufschlag"],
    diagram: { items: [kid(1, 11.9, "A"), kid(1.5, 13.2, "A"), kid(-1, 11.9, "B"), kid(-1.5, 13.2, "B"), target(-3.5, -5), target(-1, -5), target(-2.2, -2), shot(1, 11.4, -2.2, -2.5), run(1.5, 13.2, 6.2, 0)] },
  },
  {
    name: "Pyramidenspiel",
    phase: "technique",
    minutes: 10,
    summary: "Paare spielen erst 1, dann 2, dann 3 Bälle ins Feld, bis zur Zielstufe. Welches Paar ist zuerst oben?",
    description:
      "Zwei Paare spielen longline miteinander. In Stufe 1 muss jeder den Ball einmal ins Feld spielen, dann wird gefangen, in Stufe 2 zweimal, dann dreimal – bis zur Zielstufe 7 (oder 10). Bei einem Fehler wird die Stufe wiederholt. Welches Paar schafft zuerst die Spitze der Pyramide?",
    tips: ["Sicherheit vor Tempo", "Hoch übers Netz", "Nach dem Schlag zurück in die Mitte"],
    focus: ["Vorhand", "Rückhand", "Ballgefühl"],
    diagram: { items: [kid(-3, -9, "A"), kid(-3, 9, "B"), kid(3, -9, "C"), kid(3, 9, "D"), shot(-3, 8.5, -3, -8.5), shot(3, -8.5, 3, 8.5)] },
  },
  {
    name: "Ziehharmonika",
    phase: "technique",
    minutes: 10,
    summary: "Paare spielen longline und rücken nach jedem Schlag ein, zwei Schritte vor bis zum Netz und wieder zurück.",
    description:
      "Zwei Paare spielen longline miteinander und starten gleichzeitig an der Grundlinie. Nach jedem Schlag gehen beide ein, zwei Schritte Richtung Netz, bis sie eine Markierung etwa 2 Meter vor dem Netz berührt haben, dann nach jedem Schlag wieder zurück hinter die Grundlinie. Volleys sind erlaubt. Welches Paar ist zuerst wieder hinten?",
    tips: ["Kleine Schritte, Ball nicht aus den Augen", "Vorne kurz und weich, hinten lang", "Bereit sein, bevor der Partner schlägt"],
    focus: ["Vorhand", "Volley", "Beinarbeit"],
    diagram: { items: [kid(-3, -11.9, "A"), kid(-3, 11.9, "B"), kid(3, -11.9, "C"), kid(3, 11.9, "D"), cone(-3, 2), cone(3, 2), run(-3, 11.4, -3, 2.6), run(3, -11.4, 3, -2.6), shot(-2.6, -11, -2.6, 10.8)] },
  },
  {
    name: "Hosenträger",
    phase: "technique",
    minutes: 10,
    summary: "Ein Kind spielt immer cross, das andere immer longline: der Ball wandert wie ein Hosenträger übers Feld.",
    description:
      "Zwei Kinder (oder Trainer und Kind) spielen über das ganze Feld: A spielt immer cross, B immer longline. So muss jeder nach jedem Schlag laufen. Wer drei Fehler hat, wechselt mit dem Nächsten. Nach der Hälfte der Zeit tauschen die Aufgaben.",
    tips: ["Nach jedem Schlag zurück zur Mitte", "Früh ausholen", "Richtung mit den Schultern vorgeben"],
    focus: ["Vorhand", "Rückhand", "Beinarbeit"],
    diagram: { items: [kid(-3, -10, "A"), kid(3, 10, "B"), shot(-3, -9.5, 3, 9.5), shot(3, 9.5, 3, -9.5), run(-3, -10, 3, -10), kid(-3, 12, "C")] },
  },
  {
    name: "Dart-Tennis",
    phase: "technique",
    minutes: 8,
    summary: "Mit kurz gefasstem Schläger aufschlagen, auf Zielflächen wie bei Darts: Wer schafft genau 20 Punkte?",
    description:
      "An der Wand oder im Aufschlagfeld liegen verschieden große Zielflächen: die kleinste bringt die meisten Punkte, die größte die wenigsten. Die Kinder schlagen mit kurz gefasstem Schläger auf (Aufschlagbewegung von oben). Wer schafft als Erster genau 20 (oder 10) Punkte? Variation: Wer hat nach 10 Versuchen die meisten?",
    tips: ["Ball über dem Kopf treffen", "Schläger kurz fassen", "Auf genau 20 – ruhig zielen"],
    focus: ["Aufschlag"],
    diagram: { items: [kid(-2, 9, "1"), kid(0, 10.2, "2"), kid(2, 9, "3"), target(-2.5, -5), target(0, -3.5), target(2.5, -5.5), shot(0, 8.5, 0, -3.5)] },
  },
  {
    name: "California (Superpunkt)",
    phase: "game",
    minutes: 12,
    summary: "Doppel: Nur das Team am Netz kann punkten. Verliert es zwei Punkte in Folge, wechselt es an die Grundlinie.",
    description:
      "Doppel A/B steht am Netz, Doppel C/D an der Grundlinie. Der Trainer spielt immer auf das Grundlinien-Team ein, der eingespielte Ball darf nicht aus der Luft genommen werden. Nur das Netz-Team kann punkten. Verliert es zwei Punkte in Folge, wechselt es an die Grundlinie und das andere Team rückt ans Netz. Mit oder ohne Lob. Wer hat zuerst 7 Punkte?",
    tips: ["Am Netz: Schläger vor die Brust", "Grundlinie: flach oder Lob über die Netzspieler", "Schnell die Positionen wechseln"],
    focus: ["Volley", "Taktik"],
    diagram: { items: [coach(-6.5, -9), basket(-6.5, -10.2), kid(-2, -3, "A"), kid(2, -3, "B"), kid(-2.5, 11.5, "C"), kid(2.5, 11.5, "D"), shot(-6, -8.5, -2.5, 10.8), shot(-2.5, 11, 1.8, -2.6), kid(5.8, 13, "E")] },
  },
  {
    name: "Vier-Länder",
    phase: "game",
    minutes: 12,
    summary: "Vier Aufschlagfelder sind vier Länder, jedes Kind verteidigt eins. Wer Fehler macht, muss ins letzte Land.",
    description:
      "Die vier Aufschlagfelder sind vier Länder, Land 1 ist das Königreich. In jedem Land steht ein Kind, weitere warten am Rand. Der König spielt ein, gespielt wird in ein beliebiges anderes Land, der Ball springt einmal auf. Wer einen Fehler macht, geht ins letzte Land (oder raus, und ein wartendes Kind kommt ins letzte Land), alle dahinter rücken auf. Wer ist am Ende König?",
    tips: ["Bereit stehen, Schläger vor dem Körper", "Ins Land mit der Lücke spielen", "Fair laut ansagen"],
    focus: ["Ballgefühl", "Taktik", "Beinarbeit"],
    diagram: { items: [kid(-2.5, -3.5, "1"), kid(2.5, -3.5, "2"), kid(2.5, 3.5, "3"), kid(-2.5, 3.5, "4"), kid(-6.5, 5, "5"), shot(-2.5, -3, 2.5, 3), shot(2.5, 3, 2.5, -3), coach(6.8, 0)] },
  },
  {
    name: "Tischtennis-Doppel",
    phase: "game",
    minutes: 10,
    summary: "Zwei gegen zwei, aber wie beim Tischtennis schlagen die Partner abwechselnd und klatschen sich nach jedem Schlag ab.",
    description:
      "Zwei gegen zwei im Kleinfeld oder Midcourt. Die Partner schlagen immer abwechselnd, wie beim Tischtennis-Doppel, und klatschen sich nach jedem Schlag ab. Der Trainer spielt den Ball ein. Gespielt wird um Punkte, bis 7.",
    tips: ["Nach dem Schlag Platz machen", "Abklatschen und zurück", "Hoch und sicher spielen"],
    focus: ["Beinarbeit", "Taktik"],
    diagram: { items: [coach(-6.5, 0), kid(-1, -5, "A"), kid(1.5, -6.5, "B"), kid(-1, 5, "C"), kid(1.5, 6.5, "D"), run(-1, -5, 1, -7), shot(-1, 4.5, -1, -4.5)] },
  },
  {
    name: "Rote Zone",
    phase: "game",
    minutes: 10,
    summary: "Einzel um Punkte, aber in der Mitte des Feldes liegt eine verbotene Zone. Wer hineinspielt, verliert den Punkt.",
    description:
      "Es wird 1 gegen 1 gespielt, die anderen warten und wechseln nach jedem Punkt. In der Mitte jeder Platzhälfte ist eine Zone von etwa 3 × 2 Metern markiert. Das Einspiel geht in die Zone, danach verliert, wer den Ball hineinspielt. So lernen die Kinder, in die Ecken und lang zu spielen.",
    tips: ["Weg von der Mitte!", "Lieber sicher in die Ecke als zu nah an die Linie", "Lang spielen"],
    focus: ["Taktik"],
    diagram: { items: [kid(0, -11, "A"), kid(0, 11, "B"), kid(5.5, 12.5, "C"), kid(-5.5, -12.5, "D"), cone(-1.5, -7.5), cone(1.5, -7.5), cone(-1.5, -9.5), cone(1.5, -9.5), cone(-1.5, 7.5), cone(1.5, 7.5), cone(-1.5, 9.5), cone(1.5, 9.5), shot(0, 10.5, -3.5, -10)] },
  },
  {
    name: "Rauswerfer",
    phase: "game",
    minutes: 10,
    summary: "Cross im halben Feld: Punkt gibt es, wenn man den Gegner so weit treibt, dass er seitlich aus dem Feld tritt.",
    description:
      "Zwei Paare spielen 1 gegen 1 cross im halben Doppelfeld, ohne Stopp und Volley. Die Grundlinie wird zur Seite verlängert gedacht. Einen Punkt bekommt, wer den Gegner so weit nach außen treibt, dass er mit einem Fuß seitlich aus dem Feld tritt. Natürlich zählen auch normale Punkte.",
    tips: ["Winkel spielen, nicht hart", "Nach dem Schlag zurück zur Mitte", "Kleine Schritte zum Ball"],
    focus: ["Taktik", "Beinarbeit"],
    diagram: { items: [kid(-3, -11, "A"), kid(3, 11, "B"), kid(3, -11, "C"), kid(-3, 11, "D"), shot(-3, -10.5, 5, 7), run(3, 11, 5.8, 8)] },
  },
  {
    name: "Aus 2 wird 1",
    phase: "game",
    minutes: 10,
    summary: "Zwei Einzel gleichzeitig longline. Wer zuerst einen Fehler macht, ruft „Fehler!“ und es geht als Doppel weiter.",
    description:
      "Alle starten an der Grundlinie, A spielt gegen C und B gegen D longline um Punkte, beide Bälle werden gleichzeitig von unten eingespielt. Ist ein Punkt vorbei, ruft der, der den Fehler gemacht hat (oder der Trainer) „Fehler!“ und der andere Ball wird als Doppel weitergespielt. Gut als spielerischer Ausklang.",
    tips: ["Laut „Fehler!“ rufen", "Sofort Doppelposition einnehmen", "Augen auch auf den anderen Ball"],
    focus: ["Taktik", "Ballgefühl"],
    diagram: { items: [kid(-3, -11, "A"), kid(3, -11, "B"), kid(-3, 11, "C"), kid(3, 11, "D"), shot(-3, -10.5, -3, 10.5), shot(3, 10.5, 3, -10.5)] },
  },
  {
    name: "Touch the Fence",
    phase: "game",
    minutes: 10,
    summary: "Doppel um Punkte: Wer einen Fehler macht, muss den Zaun berühren. Das andere Team spielt sofort den nächsten Ball ein.",
    description:
      "Zwei gegen zwei, alle starten an der Grundlinie. Wer einen Fehler macht, muss zum Zaun laufen und ihn berühren, das andere Team darf sofort den nächsten Ball einspielen – auch wenn der Gegner noch unterwegs ist. Variation: Der Trainer spielt auf das Team ein, das den Punkt gewonnen hat.",
    tips: ["Schnell zurück!", "Den freien Platz anspielen", "Fair: erst Zaun, dann spielen"],
    focus: ["Taktik", "Beinarbeit"],
    diagram: { items: [kid(-2.5, -11, "A"), kid(2.5, -11, "B"), kid(-2.5, 11, "C"), kid(2.5, 11, "D"), run(2.5, 11, 2.5, 14.2), shot(-2.5, -10.5, 2.5, 8)] },
  },
  {
    name: "Räubern am Netz",
    phase: "game",
    minutes: 10,
    summary: "Zwei spielen cross an der Grundlinie, die Partner am Netz versuchen, den Ball zu „räubern“.",
    description:
      "A und C spielen an der Grundlinie gegeneinander cross, B und D stehen am Netz und versuchen, mit einem Volley dazwischenzugehen und den Punkt zu machen. Wer räubert, muss auch treffen. Nach 5 Punkten Positionen tauschen. Für Kinder, die schon Volley und Grundschläge können.",
    tips: ["Am Netz: früh entscheiden, dann gehen", "Grundlinie: ruhig cross, ab und zu longline", "Volley nach unten"],
    focus: ["Volley", "Taktik"],
    diagram: { items: [kid(-3, -11, "A"), kid(3, -3, "B"), kid(3, 11, "C"), kid(-3, 3, "D"), shot(-3, -10.5, 3, 10.5), run(-3, 3, -0.5, 2.5)] },
  },
  {
    name: "Minutenspiel",
    phase: "game",
    minutes: 10,
    summary: "Ein Team hat drei Bälle und eine Minute Zeit: Nur seine Punkte zählen, die Bälle holt es sich selbst.",
    description:
      "1 gegen 1 im Feld, Team A/B gegen C/D. Ein Team bekommt drei Bälle und spielt von unten beliebig ein. Gezählt werden nur die Punkte des Teams mit den Bällen, innerhalb einer Minute. Den nächsten Ball muss es sich selbst holen, egal wo er liegt. Dann wechseln die Teams. Welches Team schafft mehr Punkte?",
    tips: ["Schnell den nächsten Ball holen", "Sicher spielen, Fehler kosten Zeit", "Anfeuern!"],
    focus: ["Taktik", "Beinarbeit"],
    diagram: { items: [kid(0, -11, "A"), kid(0, 11, "C"), kid(-5.8, -12.5, "B"), kid(5.8, 12.5, "D"), ball(-2, -12.5), ball(-1, -13), ball(0, -13.3), shot(0, -10.5, 2.5, 9)] },
  },
];

// For how many kids each exercise works: [min, max], null = no limit. Also in
// the migration 20261108000000_tennis_players.sql for already loaded exercises.
export const starterPlayers: Record<string, [number | null, number | null]> = {
  "Linien-Alarm": [2, null],
  "Eierlauf-Staffel": [4, null],
  "Ball-Tippen-Challenge": [null, null],
  "Partner-Werfen übers Netz": [2, null],
  Linienfangen: [3, null],
  Spiegelbild: [2, null],
  "Hütchen umdrehen": [4, null],
  "Mini-Tennis einspielen": [2, null],
  "Vorhand-Zielschießen": [null, null],
  "Rückhand-Zielschießen": [null, null],
  "Pendel: Vorhand – Rückhand": [null, 6],
  "Volley-Fangen": [null, null],
  "Volley-Reihe": [2, 8],
  "Aufschlag-Bowling": [null, null],
  "Aufschlag-Wurf": [null, null],
  "Rein, Schlag, Volley, Raus": [null, 6],
  "Hinter die T-Linie": [2, null],
  "Stationen-Zirkel": [3, null],
  "Cross-Duell": [4, null],
  "Lob über den Trainer": [null, null],
  "Schmetterball-Fangen": [null, null],
  "Hütchen-Sprint mit Schlag": [null, 8],
  "Kurz – Lang": [null, null],
  "Return-Schlange": [null, 8],
  Rundlauf: [3, null],
  "König des Platzes": [3, null],
  "Ziel-Bingo": [4, null],
  "Dosen abräumen": [4, null],
  "Trainer-Doppel": [4, null],
  "Bälle sammeln": [4, null],
  "Volley-Duell": [4, null],
  "Ballwechsel-Rekord": [2, null],
  "Auf- und Absteiger": [4, null],
  "Burg verteidigen": [2, null],
  "Ampel-Tennis": [null, null],
  "Ballsammel-Rennen": [4, null],
  Korbfangen: [null, null],
  "Letzter Aufschlag": [null, null],
  "Abschlussrunde mit Abklatschen": [null, null],
  "Feuer-Wasser-Sturm": [3, null],
  "Staffel Balltransport": [4, null],
  "Eistüten bauen": [1, 8],
  "Halte den Platz frei": [4, null],
  "Formel-1-Rennen": [null, null],
  Rollhockey: [2, null],
  Klappball: [2, null],
  Lenkradvolley: [2, null],
  "Wer kriegt die Dose voll?": [2, null],
  "Aufschlag-Return-Fangen": [2, 8],
  "Mensch ärgere dich nicht": [4, 10],
  Pyramidenspiel: [2, 8],
  Ziehharmonika: [2, 8],
  Hosenträger: [2, 6],
  "Dart-Tennis": [null, 8],
  "California (Superpunkt)": [4, 8],
  "Vier-Länder": [4, 10],
  "Tischtennis-Doppel": [4, 8],
  "Rote Zone": [2, 8],
  Rauswerfer: [2, 8],
  "Aus 2 wird 1": [4, 4],
  "Touch the Fence": [4, 8],
  "Räubern am Netz": [4, 4],
  Minutenspiel: [4, 8],
};


// How each exercise gets easier or harder, or fits fewer or more kids:
// [leichter, schwerer, weniger Kinder, mehr Kinder]. Mostly from the BTV
// course scripts ("Variationen", "Differenzierung"). Keeps a block from
// getting boring: switch to the harder version after a few minutes.
export const starterVariations: Record<string, [string, string, string, string]> = {
  "Linien-Alarm": [
    "Nur zwei Linien rufen (Grundlinie, Netz) und vorher zeigen.",
    "Mit Zusatzaufgabe ankommen: rückwärts, Sidesteps, Ball auf dem Schläger.",
    "Ab 2 Kindern: auf Zeit statt „wer ist Letzter“.",
    "Zwei Gruppen, die abwechselnd laufen; die andere zählt laut.",
  ],
  "Eierlauf-Staffel": [
    "Ball in der Hand tragen oder auf einen größeren Softball wechseln.",
    "Ball auf dem Schläger hüpfen lassen oder auf der Rückhandseite balancieren.",
    "Jeder gegen die Uhr statt Staffel.",
    "Drei oder vier Teams, je ein Hütchen mehr.",
  ],
  "Ball-Tippen-Challenge": [
    "Ball nur auf den Boden prellen.",
    "Abwechselnd Vorhand-/Rückhandseite, Rahmen dazwischen, im Gehen.",
    "Persönlichen Rekord vom letzten Mal schlagen.",
    "Gruppenrekord: alle Treffer zusammenzählen.",
  ],
  "Partner-Werfen übers Netz": [
    "Mit Softball, ohne Netz, kürzerer Abstand.",
    "Mit der Nicht-Schlaghand fangen, seitlich werfen, damit der Partner laufen muss.",
    "Zu dritt im Dreieck werfen.",
    "Mehrere Paare nebeneinander, jedes Paar zählt seine Fänge.",
  ],
  Linienfangen: [
    "Ohne Ausscheiden: wer gefangen wird, tauscht mit dem Fänger.",
    "Kettenfangen: Gefangene werden auch Fänger.",
    "Ab 3 Kindern: der Trainer ist Fänger.",
    "Zwei Fänger, ganzes Feld.",
  ],
  Spiegelbild: [
    "Nur Laufwege spiegeln, ohne Schlag.",
    "Tempo erhöhen, Schläge und Laufrichtungen mischen.",
    "Der Trainer macht vor, alle spiegeln.",
    "Alle gegen einen Vormacher in der Mitte, regelmäßig wechseln.",
  ],
  "Hütchen umdrehen": [
    "Längere Runden, weniger Hütchen.",
    "Hütchen nur mit dem Schläger umdrehen.",
    "1 gegen 1, 30 Sekunden.",
    "Mehr Hütchen, ganzes Feld.",
  ],
  "Mini-Tennis einspielen": [
    "Erst zuwerfen und zurückspielen, dann zuspielen.",
    "Nur Rückhand, oder nur Volley, oder Ziel: 20 am Stück.",
    "Trainer spielt mit dem Kind.",
    "Paare in allen vier Aufschlagfeldern, jedes Paar zählt.",
  ],
  "Vorhand-Zielschießen": [
    "Zuwerfen statt zuspielen, größeres Zielfeld, näher ans Netz.",
    "Nach 5 Minuten: Ziel wechselt longline, nur Treffer hinter der T-Linie zählen, oder Gegenspieler fängt mit dem Hütchen.",
    "Jedes Kind zwei Schläge hintereinander, dann Laufweg um ein Hütchen.",
    "Zweite Reihe auf der anderen Seite, Trainer spielt abwechselnd ein; Wartende sammeln Bälle.",
  ],
  "Rückhand-Zielschießen": [
    "Zuwerfen statt zuspielen, Zone größer.",
    "Nach 5 Minuten: cross und longline im Wechsel, Treffer nur hinter der T-Linie.",
    "Zwei Schläge pro Kind, dann Koordinationsleiter zurück.",
    "Zweite Reihe, die auf der Gegenseite den Ball mit dem Hütchen fängt, dann wechseln.",
  ],
  "Pendel: Vorhand – Rückhand": [
    "Kürzerer Weg, Bälle zuwerfen.",
    "Drei Bälle hintereinander, Ziele cross/longline.",
    "Mehr Bälle pro Durchgang, kurze Pause.",
    "Wer nicht dran ist, sammelt Bälle oder läuft durch die Leiter.",
  ],
  "Volley-Fangen": [
    "Mit beiden Händen fangen, Softball.",
    "Mit dem Hütchen fangen, dann mit Schläger blocken.",
    "Trainer wirft, Kind fängt.",
    "Paare werfen sich gegenseitig zu.",
  ],
  "Volley-Reihe": [
    "Zuwerfen statt zuspielen.",
    "Auf Ziele spielen, Vorhand-/Rückhand-Volley im Wechsel.",
    "Zwei Volleys pro Kind hintereinander.",
    "Zwei Reihen, Wartende werfen sich gegenseitig zu.",
  ],
  "Aufschlag-Bowling": [
    "Näher am Netz aufschlagen, mehr Hütchen.",
    "Nur der erste Aufschlag zählt, Hütchen weiter hinten.",
    "Jeder zwei Aufschläge hintereinander.",
    "Zwei Teams auf beiden Seiten, gleichzeitig.",
  ],
  "Aufschlag-Wurf": [
    "Nur werfen, mit Softball.",
    "Werfen, dann mit kurz gefasstem Schläger, dann ganzer Schläger.",
    "Weitwurf-Wettbewerb gegen den eigenen Rekord.",
    "Werfen auf Ziele, Teams zählen Treffer.",
  ],
  "Rein, Schlag, Volley, Raus": [
    "Nur Schlag oder nur Volley.",
    "Auf Ziele, Tempo erhöhen.",
    "Zwei Durchgänge hintereinander.",
    "Rückweg außen herum mit Ball sammeln.",
  ],
  "Hinter die T-Linie": [
    "Jeder Ball im Feld zählt, Punkte nur für lange extra.",
    "Nur Rückhand, oder nur hinter einer Markierung kurz vor der Grundlinie.",
    "Gegen den Trainer.",
    "Zwei Paare nebeneinander, Seitenwechsel nach 3 Minuten.",
  ],
  "Stationen-Zirkel": [
    "Leichtere Stationen (zuwerfen statt zuspielen).",
    "Stationen auf Zeit (90 Sekunden) mit Punkten auf der Stationskarte.",
    "Weniger Stationen, öfter wechseln.",
    "Mehr Stationen, je 2 Kinder pro Station.",
  ],
  "Cross-Duell": [
    "Miteinander statt gegeneinander: wer schafft 10?",
    "Volley verboten, nur Treffer hinter der T-Linie zählen.",
    "1 gegen 1 im halben Feld.",
    "Wartende wechseln nach jedem Ballwechsel ein.",
  ],
  "Lob über den Trainer": [
    "Ball fallen lassen und schlagen, Trainer kniet.",
    "Trainer springt mit, Treffer nur hinter der T-Linie.",
    "Zwei Lobs pro Kind.",
    "Zweite Reihe, die den Lob auf der anderen Seite fängt.",
  ],
  "Schmetterball-Fangen": [
    "Nur fangen, hohe Bälle vom Trainer zuwerfen.",
    "Mit Schläger, auf Ziele.",
    "Zwei Schmetterbälle pro Kind.",
    "Wartende fangen die Bälle auf der Gegenseite.",
  ],
  "Hütchen-Sprint mit Schlag": [
    "Kürzerer Sprint, Ball zuwerfen.",
    "Zwei Hütchen, Rückhand und Vorhand im Wechsel.",
    "Auf Zeit: wie viele Treffer in 30 Sekunden?",
    "Zwei Startreihen, Trainer spielt abwechselnd.",
  ],
  "Kurz – Lang": [
    "Nur zwei Kommandos, Ziel groß.",
    "Kinder rufen selbst an, Gegner muss reagieren.",
    "Trainer spielt mit dem Kind.",
    "Mehrere Paare, Trainer ruft für alle.",
  ],
  "Return-Schlange": [
    "Trainer schlägt von der T-Linie auf.",
    "Return in zwei Zonen im Wechsel.",
    "Zwei Returns pro Kind.",
    "Zweite Schlange auf der anderen Seite.",
  ],
  Rundlauf: [
    "Ohne Ausscheiden, nur Punkte sammeln.",
    "Nur Rückhand, oder Ball muss hinter die T-Linie.",
    "Ab 3 Kindern im Kleinfeld.",
    "Zwei Rundläufe auf zwei Feldern.",
  ],
  "König des Platzes": [
    "Trainer spielt den Ball weich ein, Punkt bis 2.",
    "Herausforderer müssen zwei Punkte in Folge gewinnen.",
    "1 gegen 1, König nach 3 Punkten.",
    "Doppel-Könige.",
  ],
  "Ziel-Bingo": [
    "Größere Ziele, zuwerfen.",
    "Nur Rückhand, oder zwei Felder pro Treffer nötig.",
    "Jeder spielt für sich.",
    "Drei Teams.",
  ],
  "Dosen abräumen": [
    "Mehr Dosen, näher am Netz.",
    "Nur Volley, oder nur der erste Ball zählt.",
    "Jeder gegen die Uhr.",
    "Zwei Teams, Dosen auf beiden Seiten.",
  ],
  "Trainer-Doppel": [
    "Bis 5, Trainer spielt weich ein.",
    "Mit Aufschlag, Netzspieler muss einmal treffen.",
    "Trainer spielt mit.",
    "Verlierer-Team wechselt nach jedem Punkt aus.",
  ],
  "Bälle sammeln": [
    "Größeres Zielfeld.",
    "Nur Treffer hinter der T-Linie.",
    "Jeder hat ein eigenes Lager.",
    "Drei Teams mit drei Lagern.",
  ],
  "Volley-Duell": [
    "Ball darf einmal aufspringen.",
    "Nur Rückhand-Volley oder Ziel am Boden.",
    "1 gegen 1.",
    "Rotation: Verlierer raus, nächstes Paar rein.",
  ],
  "Ballwechsel-Rekord": [
    "Im Kleinfeld, Ball darf zweimal aufspringen.",
    "Nach jedem Schlag eine Zusatzaufgabe (Netzpfosten berühren), nur hinter die T-Linie, oder nur Rückhand. Nach 5 Minuten die nächste Stufe.",
    "Paare statt Gruppe.",
    "Zwei Gruppen auf zwei Hälften, wer hat den höheren Rekord?",
  ],
  "Auf- und Absteiger": [
    "Bis 3 statt auf Zeit.",
    "Nur cross, oder nur Rückhand.",
    "Ab 4 Kindern in zwei Ligen.",
    "Mehr Felder, auch Kleinfeld quer.",
  ],
  "Burg verteidigen": [
    "Größere Burg, Ball zuwerfen.",
    "Kleinere Burg, nur Rückhand.",
    "1 gegen 1.",
    "Teams verteidigen gemeinsam.",
  ],
  "Ampel-Tennis": [
    "Nur zwei Farben.",
    "Kinder rufen die Farbe für den Gegner.",
    "Trainer spielt mit.",
    "Paare auf allen Feldern.",
  ],
  "Ballsammel-Rennen": [
    "Ohne Team, alle zusammen gegen die Uhr.",
    "Bälle nur mit dem Schläger aufheben.",
    "Ein Korb, Zeit messen.",
    "Drei Teams.",
  ],
  Korbfangen: [
    "Trainer steht näher, Korb tief.",
    "Nur Volley, oder nur mit Lob.",
    "Jeder drei Versuche.",
    "Zwei Körbe.",
  ],
  "Letzter Aufschlag": [
    "Größeres Ziel.",
    "Kleines Ziel ganz hinten.",
    "Zwei Aufschläge pro Kind.",
    "Zwei Teams.",
  ],
  "Abschlussrunde mit Abklatschen": ["", "", "", ""],
  "Feuer-Wasser-Sturm": [
    "Nur zwei Kommandos, langsamer rufen.",
    "Kommandos schneller, neue dazu (z. B. „Blitz“: auf den Boden legen), Laufart wechseln.",
    "Trainer macht mit, wer zuletzt reagiert, ruft das nächste Kommando.",
    "Ganzer Platz, wer zuletzt reagiert, macht eine Zusatzaufgabe.",
  ],
  "Staffel Balltransport": [
    "Ball nur von Kegel 1 zu Kegel 2.",
    "Ball um Kegel 2 wenden, oder zusätzlich das Netz berühren.",
    "Jeder gegen die Uhr.",
    "Drei Teams.",
  ],
  "Eistüten bauen": [
    "Ball mit beiden Händen fangen.",
    "Ohne Aufsprung fangen, weitere Würfe.",
    "Jedes Kind kommt öfter dran.",
    "Ein Kind wirft für die anderen zu, regelmäßig wechseln.",
  ],
  "Halte den Platz frei": [
    "Rollen erlaubt.",
    "Nur mit der Nicht-Wurfhand, oder nur Aufschlagbewegung mit Sprung.",
    "1 gegen 1 mit 10 Bällen.",
    "Mehr Bälle.",
  ],
  "Formel-1-Rennen": [
    "Im Stehen, Ball nur ruhig halten.",
    "Im Laufen um Hütchen, andere Richtung.",
    "Persönlicher Rekord.",
    "Staffel: Ball mit Formel-1-Runden zum Nächsten bringen.",
  ],
  Rollhockey: [
    "Kürzerer Abstand, großer Ball.",
    "Durch die Beine des Partners, auf ein Ziel.",
    "Gegen die Wand rollen.",
    "Zu viert reihum, der Letzte rollt auf ein Ziel.",
  ],
  Klappball: [
    "Ohne Hindernis, Ball fangen und zuwerfen.",
    "Über ein Hindernis (Stange, Netz), oder vor einem Kind zwei Fliesen.",
    "Gegen die Wand auf eine Markierung.",
    "Mehr Paare nebeneinander quer zum Feld.",
  ],
  Lenkradvolley: [
    "Mit Softball, Partner fängt.",
    "Normal am Griff, zuspielen statt zuwerfen, Vorhand/Rückhand im Wechsel.",
    "Trainer wirft zu.",
    "Mehr Paare, alle 2 Minuten Partnerwechsel.",
  ],
  "Wer kriegt die Dose voll?": [
    "Mit Hütchen statt Dose fangen.",
    "Nur Rückhand-Volley, Abstand vergrößern.",
    "Trainer wirft zu.",
    "Als Station im Zirkel.",
  ],
  "Aufschlag-Return-Fangen": [
    "Aufschlag von der T-Linie, Return fangen erlaubt.",
    "Zielfelder für Aufschlag und Return, Bonuspunkt.",
    "Trainer schlägt auf.",
    "Wartende sammeln Bälle und wechseln nach jedem Punkt.",
  ],
  "Mensch ärgere dich nicht": [
    "Näher am Netz aufschlagen, größere Felder.",
    "Größerer Abstand, Seitenwechsel.",
    "Jeder gegen die Uhr.",
    "Drei Teams auf mehreren Feldern.",
  ],
  Pyramidenspiel: [
    "Zielstufe 5.",
    "Fehler bei Stufe X bringt dem Partner X Punkte; ist die Stufe geschafft, wird der Punkt ausgespielt.",
    "Mit dem Trainer.",
    "Paare auf allen Feldern.",
  ],
  Ziehharmonika: [
    "Nur Schläge nach einmaligem Aufsprung.",
    "Mindestens drei Ballkontakte vor der Markierung und zurück, nur Vorhand mit Ball prellen.",
    "Mit dem Trainer.",
    "Paare nebeneinander, wartende sammeln.",
  ],
  Hosenträger: [
    "Trainer spielt longline, Kind spielt cross.",
    "Ziele für die Schläge.",
    "Trainer und Kind.",
    "Reihe: nach drei Schlägen wechselt das nächste Kind ein.",
  ],
  "Dart-Tennis": [
    "Größere Ziele, näher dran.",
    "Genau 20 erreichen, wer drüber ist, fällt auf 10 zurück.",
    "Jeder gegen den eigenen Rekord.",
    "Zwei Wände oder zwei Felder.",
  ],
  "California (Superpunkt)": [
    "Ohne Lob, Trainer spielt weich ein.",
    "Netzteam muss nach dem ersten Punkt sofort wechseln, mit Lob.",
    "2 gegen Trainer, abwechselnd.",
    "Wartende Paare stellen sich hinten an, Verlierer raus.",
  ],
  "Vier-Länder": [
    "Ball darf zweimal aufspringen, Softball.",
    "Nur Volley, oder nur Rückhand.",
    "Drei Länder (ein Feld weglassen).",
    "Wartende kommen ins letzte Land, wer Fehler macht, geht raus.",
  ],
  "Tischtennis-Doppel": [
    "Miteinander: welche Gruppe schafft 10?",
    "Nur cross, oder Ziel am Boden.",
    "2 gegen Trainer.",
    "Verlierer-Team wechselt aus.",
  ],
  "Rote Zone": [
    "Große Zone, hineinspielen erlaubt, nur Punkte für Treffer außerhalb.",
    "Zone nur auf einer Seite, oder kleiner, oder mehrere Zonen.",
    "1 gegen 1 ohne Wechsel.",
    "Schneller Wechsel nach jedem Punkt.",
  ],
  Rauswerfer: [
    "Nur ein Fuß raus reicht.",
    "Mit beiden Füßen aus dem Einzelfeld, oder aus dem Doppelfeld.",
    "1 gegen 1 ohne Wechsel.",
    "Rotation nach jedem Punkt.",
  ],
  "Aus 2 wird 1": [
    "Ohne Doppel: zwei Einzel nebeneinander.",
    "Cross, mit Aufschlag, oder zwei Kinder starten an der T-Linie.",
    "Mit dem Trainer als viertem Spieler.",
    "Wartende wechseln nach jedem Punkt ein.",
  ],
  "Touch the Fence": [
    "Kürzerer Weg (Seitenlinie berühren).",
    "Trainer spielt auf das Team ein, das den Punkt gewonnen hat.",
    "1 gegen 1.",
    "Wartende springen für das laufende Kind ein.",
  ],
  "Räubern am Netz": [
    "Netzspieler dürfen nur einmal pro Punkt räubern.",
    "Grundlinienspieler dürfen auch longline, mit Aufschlag und Return.",
    "Trainer spielt an der Grundlinie.",
    "Paare rotieren nach 5 Punkten.",
  ],
  Minutenspiel: [
    "Zwei Minuten, Trainer holt die Bälle.",
    "30 Sekunden, nur Rückhand.",
    "1 gegen 1.",
    "Teams zu dritt, jeder Punkt Spielerwechsel.",
  ],
};

export const starterExercises: ExerciseInput[] = exercises.map((exercise) => {
  const [easier, harder, fewer, more] = starterVariations[exercise.name] ?? ["", "", "", ""];
  return {
    ...exercise,
    playersMin: starterPlayers[exercise.name]?.[0] ?? null,
    playersMax: starterPlayers[exercise.name]?.[1] ?? null,
    variations: { easier, harder, fewer, more },
  };
});
