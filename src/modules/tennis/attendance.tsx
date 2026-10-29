"use client";

import { DicesIcon, Loader2Icon, RefreshCwIcon, UsersIcon } from "lucide-react";
import { ViewLink as Link } from "@/lib/query/view-link";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { replanSession, restorePlan, setAbsent } from "./actions";
import { fitsPlayers, type Exercise, type Player } from "./data";
import { tennisQuery } from "./query";
import { useLive } from "./session-plan";

const PATH = "/m/tennis";

// "Wer kommt?" on a session: tap a kid who cancelled, and the session can be
// re-planned for the ones who are there, also during the training (only what
// hasn't happened yet changes).
export function Attendance({
  sessionId,
  groupId,
  date,
  startTime,
  players,
  absent: savedAbsent,
  items,
}: {
  sessionId: string;
  groupId: string;
  date: string;
  startTime: string;
  players: Player[];
  absent: string[];
  items: { exercise: Exercise; minutes: number }[];
}) {
  const queryClient = useQueryClient();
  const key = tennisQuery("sessions").queryKey;
  const absent = new Set(savedAbsent);
  // Saves run one after another, each with the list as it was after its tap.
  const saving = useRef(Promise.resolve());
  const [replanning, startReplan] = useTransition();
  const live = useLive({ date, startTime, plan: items });

  if (players.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
        <UsersIcon className="size-4 shrink-0" />
        <span>
          Trag die Kinder der{" "}
          <Link href={`${PATH}?group=${groupId}`} className="underline underline-offset-4">
            Gruppe
          </Link>{" "}
          ein, dann kannst du hier Absagen abhaken und die Stunde passend umplanen.
        </span>
      </p>
    );
  }

  const present = players.filter((player) => !absent.has(player.id));
  const boys = present.filter((player) => player.gender === "m").length;
  const girls = present.filter((player) => player.gender === "f").length;
  // During the session only the current exercise and later ones can change.
  const from = live?.kind === "running" ? live.index : 0;
  const over = live?.kind === "over";
  const unfit = items.slice(from).filter((item) => !fitsPlayers(item.exercise, present.length));

  // The tap shows in the cached session at once (no round trip, so nothing
  // flickers back); the server catches up in the background.
  function flip(player: Player) {
    const next = absent.has(player.id) ? savedAbsent.filter((id) => id !== player.id) : [...savedAbsent, player.id];
    void queryClient.cancelQueries({ queryKey: key });
    queryClient.setQueryData(key, (sessions) =>
      sessions?.map((session) => (session.id === sessionId ? { ...session, absent: next } : session)),
    );
    saving.current = saving.current
      .then(() => setAbsent(sessionId, next))
      .catch(() => {
        toast.error("Konnte nicht gespeichert werden.");
        void queryClient.invalidateQueries({ queryKey: key });
      });
  }

  function replan(all: boolean) {
    startReplan(async () => {
      try {
        await saving.current;
        const result = await replanSession(sessionId, { from: all && live?.kind === "running" ? from + 1 : from, all });
        if (result.changed === 0) {
          toast.info(all ? "Keine anderen Übungen gefunden." : "Keine passenden Übungen in der Sammlung gefunden.");
          return;
        }
        toast.success(result.changed === 1 ? "1 Übung ersetzt" : `${result.changed} Übungen ersetzt`, {
          action: {
            label: "Rückgängig",
            onClick: () => {
              restorePlan(sessionId, result.previous).then(
                () => toast.success("Alter Plan wiederhergestellt"),
                () => toast.error("Rückgängig hat nicht geklappt."),
              );
            },
          },
        });
      } catch {
        toast.error("Umplanen hat nicht geklappt.");
      }
    });
  }

  return (
    <section aria-label="Wer kommt?" className="space-y-3 rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-baseline gap-2">
        <h3 className="flex-1 font-semibold">Wer kommt?</h3>
        <p className="text-sm text-muted-foreground">
          <span className="font-mono text-foreground">{present.length}</span> von {players.length}
          {players.some((player) => player.gender) && ` · ${boys} J, ${girls} M`}
        </p>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {players.map((player) => {
          const away = absent.has(player.id);
          return (
            <li key={player.id}>
              <button
                type="button"
                aria-pressed={!away}
                onClick={() => flip(player)}
                className={cn(
                  "h-9 cursor-pointer rounded-full border px-3 text-sm transition-colors",
                  away ? "bg-card text-muted-foreground line-through decoration-2" : "border-brand bg-good text-good-foreground",
                )}
              >
                {player.name}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">Tippe auf ein Kind, das abgesagt hat.</p>

      {!over && (
        <div className="space-y-2 border-t pt-3">
          {unfit.length > 0 ? (
            <p className="text-sm text-debt">
              {unfit.length === 1 ? "1 Übung passt" : `${unfit.length} Übungen passen`} nicht für {present.length}{" "}
              {present.length === 1 ? "Kind" : "Kinder"}: {unfit.map((item) => item.exercise.name).join(", ")}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Alle {live?.kind === "running" ? "restlichen " : ""}Übungen passen für {present.length}{" "}
              {present.length === 1 ? "Kind" : "Kinder"}.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {unfit.length > 0 && (
              <Button variant="brand" disabled={replanning} onClick={() => replan(false)}>
                {replanning ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
                Passend umplanen
              </Button>
            )}
            <Button variant="outline" disabled={replanning} onClick={() => replan(true)}>
              <DicesIcon /> {live?.kind === "running" ? "Rest neu würfeln" : "Alles neu würfeln"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
