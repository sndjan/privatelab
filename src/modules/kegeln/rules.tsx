"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEuro } from "./data";
import { useKegelnData } from "./store";

// How the app calculates, in the team's words, with the amounts from the
// settings. Keep in step with feesOf and analyzeSheet in data.ts.
export function RulesView() {
  const { settings } = useKegelnData();
  const { rates, threshold, team } = settings;
  const rules = [
    { cents: rates.start, title: "Startgebühr", amount: formatEuro(rates.start), text: "Jeder, der gespielt hat." },
    {
      cents: rates.point,
      title: "Punkt verloren",
      amount: formatEuro(rates.point),
      text: `Bei 0 Mannschaftspunkten laut Spielbericht. Unentschieden (0,5 Punkte) kostet die Hälfte, ${formatEuro(Math.round(rates.point / 2))}.`,
    },
    {
      cents: rates.mass,
      title: "Maß",
      amount: formatEuro(rates.mass),
      text: "Wenn auf dem Spielbericht ein handschriftliches „M“ neben dem Namen steht.",
    },
    {
      cents: rates.error,
      title: "Fehler",
      amount: `${formatEuro(rates.error)} pro Fehlwurf`,
      text: "Die Fehler-Summe vom Spielbericht, alle 4 Durchgänge zusammen.",
    },
    {
      cents: rates.under,
      title: `Unter ${threshold} Kegel`,
      amount: formatEuro(rates.under),
      text: `Wenn das Gesamtergebnis unter ${threshold} liegt: ${threshold - 1} kostet, ${threshold} nicht.`,
    },
    {
      cents: rates.two,
      title: "Zweier",
      amount: `${formatEuro(rates.two)} pro Stück`,
      text: "Jede 2 auf das volle Bild, also wenn alle neun stehen: in die Vollen bei jedem Wurf, beim Abräumen beim ersten Wurf nach dem Neuaufstellen.",
    },
    {
      cents: rates.golden,
      title: "Goldener",
      amount: `${formatEuro(rates.golden)} pro Stück`,
      text: "Im 29. Wurf eines Durchgangs an einem einzelnen Kegel vorbei (eine 0, auch als Fehlwurf).",
    },
    {
      cents: rates.conduct,
      title: "Unsportliches Verhalten",
      amount: formatEuro(rates.conduct),
      text: "Kreuzt man beim Spieler von Hand an.",
    },
    {
      cents: rates.late,
      title: "Zu spät gekommen",
      amount: formatEuro(rates.late),
      text: "Kreuzt man beim Spieler von Hand an.",
    },
  ]
    // A fee switched off in the settings (0 €) isn't charged, so it isn't listed.
    .filter((rule) => rule.cents > 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>So wird gerechnet</CardTitle>
          <CardDescription>Pro Spieler und Spiel. Die Beträge stellst du in den Einstellungen ein.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="divide-y">
            {rules.map((rule, index) => (
              <li key={rule.title} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-medium">{rule.title}</span>
                    <span className="text-sm font-semibold tabular-nums">{rule.amount}</span>
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{rule.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gut zu wissen</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Zweier und Goldene stehen nur auf dem Wurfschein. Ohne Wurfschein, etwa auswärts, trägst du sie von Hand ein.</li>
            <li>Gezählt werden nur unsere Spieler (Name enthält „{team}“), egal ob Heim oder Gast.</li>
            <li>
              Bei einer Auswechslung zur Hälfte teilen sich beide Spieler die Kosten: jeder zahlt von allem die Hälfte. Strafen für
              unsportliches Verhalten oder Zuspätkommen zahlt jeder selbst und ganz.
            </li>
            <li>Gespeicherte Spiele behalten die Beträge, mit denen sie eingelesen wurden.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
