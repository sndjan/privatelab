import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { addDays, formatHours, formatShortDate, isoWeek, mondayOf, phaseOn, type LogEntry } from "./data";
import { LogDialog, LogForm } from "./log-dialog";
import { loadLog, loadPhases } from "./queries";

export async function LogTab({ today }: { today: string }) {
  const [phases, log] = await Promise.all([loadPhases(), loadLog()]);
  const total = log.reduce((sum, entry) => sum + entry.hours, 0);

  // Newest week first; entries are already newest first.
  const weeks: { monday: string; entries: LogEntry[] }[] = [];
  for (const entry of log) {
    const monday = mondayOf(entry.day);
    const week = weeks.at(-1);
    if (week?.monday === monday) week.entries.push(entry);
    else weeks.push({ monday, entries: [entry] });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>Neuer Eintrag</h2>
          </CardTitle>
          <CardDescription>
            {log.length === 0 ? "Noch nichts eingetragen." : `${formatHours(total)} in ${log.length} Einträgen`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LogForm phases={phases} today={today} defaultPhaseId={phaseOn(phases, today)?.id ?? null} />
        </CardContent>
      </Card>

      {weeks.map((week) => {
        const hours = week.entries.reduce((sum, entry) => sum + entry.hours, 0);
        return (
          <section key={week.monday} aria-label={`KW ${isoWeek(week.monday)}`} className="space-y-1.5">
            <h2 className="flex items-baseline justify-between px-1 text-sm text-muted-foreground">
              <span>
                <span className="font-medium text-foreground">KW {isoWeek(week.monday)}</span> ·{" "}
                {formatShortDate(week.monday).replace(/^\S+\s/, "")} – {formatShortDate(addDays(week.monday, 6)).replace(/^\S+\s/, "")}
              </span>
              <span className="font-mono font-medium text-foreground">{formatHours(hours)}</span>
            </h2>
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {week.entries.map((entry) => {
                const phase = phases.find((candidate) => candidate.id === entry.phaseId);
                return (
                  <li key={entry.id} className="flex items-start gap-3 px-4 py-3">
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{formatShortDate(entry.day)}</span>
                        <span className="font-mono">{formatHours(entry.hours)}</span>
                        {phase && <span>{phase.name}</span>}
                      </span>
                      <span className="text-sm whitespace-pre-line">{entry.text}</span>
                    </span>
                    <LogDialog key={JSON.stringify(entry)} entry={entry} phases={phases} today={today} />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
