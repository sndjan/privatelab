"use client";

import { CopyIcon, PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ViewLink as Link, useViewNavigate } from "@/lib/query/view-link";
import { deleteGame, setPaid } from "./actions";
import { displayName, feesOf, formatEuro, gameSum, nameKey, openSum, type Game } from "./data";
import { GameEditor } from "./editor";
import { FeeTable } from "./fee-table";
import { RulesView } from "./rules";
import { SettingsView } from "./settings";
import { PATH, useKegelnData, usePatch, useRefresh } from "./store";

const tabs = [
  { id: "games", label: "Spiele" },
  { id: "season", label: "Saison" },
  { id: "rules", label: "Regeln" },
  { id: "settings", label: "Einstellungen" },
] as const;

const dateFormat = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
const formatDate = (date: string | null) => (date ? dateFormat.format(new Date(`${date}T12:00:00`)) : "");

export function gameTitle(game: Pick<Game, "matchday" | "opponent">) {
  return [game.matchday ? `${game.matchday}. Spieltag` : "Spiel", game.opponent && `gegen ${game.opponent}`].filter(Boolean).join(" ");
}

// The module in the browser: views switch by search params, without the
// server, and render from the query cache (see index.tsx).
export function KegelnApp() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const id = searchParams.get("id");
  const tab = tabs.find((entry) => entry.id === searchParams.get("tab"))?.id ?? "games";
  const { games } = useKegelnData();

  if (view === "new") return <Page title="Neues Spiel" back={PATH}><GameEditor /></Page>;
  const game = id ? games.find((entry) => entry.id === id) : undefined;
  if (view === "edit" && game) {
    return (
      <Page title="Spiel bearbeiten" back={`${PATH}?view=game&id=${game.id}`}>
        <GameEditor game={game} />
      </Page>
    );
  }
  if (view === "game" && game) return <GameView game={game} />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav aria-label="Bereiche">
        <ul className="flex gap-1 rounded-lg bg-muted p-1">
          {tabs.map((entry) => (
            <li key={entry.id} className="flex-1">
              <Link
                href={entry.id === "games" ? PATH : `${PATH}?tab=${entry.id}`}
                aria-current={entry.id === tab ? "page" : undefined}
                className={`flex h-9 items-center justify-center rounded-md px-2 text-sm whitespace-nowrap sm:px-3 transition-colors ${
                  entry.id === tab ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {entry.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {tab === "games" && <GamesList />}
      {tab === "season" && <SeasonView />}
      {tab === "rules" && <RulesView />}
      {tab === "settings" && <SettingsView />}
    </div>
  );
}

function Page({ title, back, children }: { title: string; back: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href={back} className="text-sm text-muted-foreground hover:text-foreground">
          ← Zurück
        </Link>
        <h2 className="mt-1 text-xl font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function GamesList() {
  const { games } = useKegelnData();
  return (
    <div className="space-y-4">
      <Button asChild size="lg" className="h-14 w-full text-base">
        <Link href={`${PATH}?view=new`}>
          <PlusIcon className="size-5" /> Neues Spiel einlesen
        </Link>
      </Button>
      {games.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Noch keine Spiele. Fotografier nach dem Spiel den Spielbericht, dann rechnet die App aus, wer was in die Kasse zahlt.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {games.map((game) => {
            const open = openSum(game);
            return (
              <li key={game.id}>
                <Link href={`${PATH}?view=game&id=${game.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{gameTitle(game)}</p>
                    <p className="text-xs text-muted-foreground">
                      {[formatDate(game.playedOn), game.home === true ? "Heim" : game.home === false ? "Auswärts" : ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="text-right tabular-nums">
                    <p className="font-semibold">{formatEuro(gameSum(game))}</p>
                    <p className="text-xs text-muted-foreground">{open > 0 ? `${formatEuro(open)} offen` : "bezahlt"}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function GameView({ game }: { game: Game }) {
  const { settings } = useKegelnData();
  const patch = usePatch();
  const refresh = useRefresh();
  const navigate = useViewNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const total = gameSum(game);

  function togglePaid(index: number, paid: boolean) {
    patch((data) => ({
      ...data,
      games: data.games.map((entry) =>
        entry.id === game.id ? { ...entry, lines: entry.lines.map((line, i) => (i === index ? { ...line, paid } : line)) } : entry,
      ),
    }));
    setPaid(game.id, index, paid)
      .catch(() => toast.error("Nicht gespeichert."))
      .finally(() => void refresh());
  }

  // For the team chat: one line per player who owes something.
  function copy() {
    const lines = game.lines
      .map((line) => ({ name: displayName(line.name, settings.nicknames), sum: feesOf(line, game.rates, game.threshold).sum }))
      .filter((line) => line.sum > 0)
      .map((line) => `${line.name}: ${formatEuro(line.sum)}`);
    const text = [`${gameTitle(game)}${game.playedOn ? ` (${formatDate(game.playedOn)})` : ""}`, ...lines, `Gesamt: ${formatEuro(total)}`].join("\n");
    navigator.clipboard.writeText(text).then(
      () => toast.success("Kopiert"),
      () => toast.error("Kopieren hat nicht geklappt."),
    );
  }

  async function remove() {
    await deleteGame(game.id).catch(() => toast.error("Nicht gelöscht."));
    await refresh();
    navigate(PATH, { replace: true });
  }

  return (
    <Page title={gameTitle(game)} back={PATH}>
      <p className="-mt-3 text-sm text-muted-foreground">
        {[formatDate(game.playedOn), game.home === true ? "Heim" : game.home === false ? "Auswärts" : "", game.season && `Saison ${game.season}`]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-baseline justify-between gap-2">
            <span>Kasse</span>
            <span className="tabular-nums">{formatEuro(total)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FeeTable lines={game.lines} rates={game.rates} threshold={game.threshold} nicknames={settings.nicknames} onPaid={togglePaid} />
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={copy}>
          <CopyIcon /> Als Text kopieren
        </Button>
        <Button asChild variant="outline">
          <Link href={`${PATH}?view=edit&id=${game.id}`}>
            <PencilIcon /> Bearbeiten
          </Link>
        </Button>
        {confirmDelete ? (
          <Button variant="destructive" onClick={() => void remove()}>
            <TrashIcon /> Wirklich löschen
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
            <TrashIcon /> Löschen
          </Button>
        )}
      </div>
    </Page>
  );
}

function SeasonView() {
  const { games, settings } = useKegelnData();
  const seasons = useMemo(() => [...new Set(games.map((game) => game.season || "ohne Saison"))].sort().reverse(), [games]);
  const [chosen, setChosen] = useState<string | null>(null);
  const season = chosen && seasons.includes(chosen) ? chosen : seasons[0];
  const inSeason = games.filter((game) => (game.season || "ohne Saison") === season);

  const players = useMemo(() => {
    const byKey = new Map<string, { name: string; games: number; errors: number; sum: number; open: number }>();
    for (const game of inSeason) {
      for (const line of game.lines) {
        const key = nameKey(line.name);
        const entry = byKey.get(key) ?? { name: line.name, games: 0, errors: 0, sum: 0, open: 0 };
        const fee = feesOf(line, game.rates, game.threshold).sum;
        entry.games += line.started ? 1 : 0;
        entry.errors += line.errors;
        entry.sum += fee;
        entry.open += line.paid ? 0 : fee;
        byKey.set(key, entry);
      }
    }
    return [...byKey.values()].sort((a, b) => b.sum - a.sum);
  }, [inSeason]);

  if (games.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Noch keine Spiele.</p>;
  const total = players.reduce((sum, player) => sum + player.sum, 0);
  const open = players.reduce((sum, player) => sum + player.open, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saison {season}</CardTitle>
        <CardDescription>
          {inSeason.length} {inSeason.length === 1 ? "Spiel" : "Spiele"} · {formatEuro(total)} in der Kasse
          {open > 0 && ` · ${formatEuro(open)} noch offen`}
        </CardDescription>
        {seasons.length > 1 && (
          <div className="flex flex-wrap gap-1 pt-2">
            {seasons.map((entry) => (
              <Button key={entry} size="sm" variant={entry === season ? "default" : "outline"} onClick={() => setChosen(entry)}>
                {entry}
              </Button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th scope="col" className="py-2 text-left font-medium">Spieler</th>
              <th scope="col" className="hidden py-2 pl-3 text-right font-medium sm:table-cell">Spiele</th>
              <th scope="col" className="py-2 pl-3 text-right font-medium">Fehler</th>
              <th scope="col" className="py-2 pl-3 text-right font-medium">Gesamt</th>
              <th scope="col" className="py-2 pl-3 text-right font-medium">offen</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.name} className="border-b last:border-0">
                <th scope="row" className="py-2 text-left font-medium">{displayName(player.name, settings.nicknames)}</th>
                <td className="hidden py-2 pl-3 text-right whitespace-nowrap sm:table-cell">{player.games}</td>
                <td className="py-2 pl-3 text-right whitespace-nowrap">{player.errors}</td>
                <td className="py-2 pl-3 text-right whitespace-nowrap font-semibold">{formatEuro(player.sum)}</td>
                <td className="py-2 pl-3 text-right whitespace-nowrap text-muted-foreground">{player.open > 0 ? formatEuro(player.open) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
