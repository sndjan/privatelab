"use client";

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ChevronLeftIcon, CopyIcon, DicesIcon, PlusIcon, PrinterIcon, Trash2Icon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dataQuery } from "@/lib/query/data";
import { ViewLink as Link, useViewNavigate } from "@/lib/query/view-link";
import { cn } from "@/lib/utils";
import { createSheet, deleteSheet, duplicateSheet, saveSheet } from "./actions";
import {
  blockStyles,
  defaultOptions,
  generate,
  limits,
  maxScore,
  sizePresets,
  type BlockStyle,
  type GeneratorOptions,
  type Sheet,
} from "./data";
import { NumberField, SheetEditor } from "./editor";
import { perPageOptions, PrintSheets, type PerPage } from "./print";
import { SheetSvg } from "./sheet-svg";

const PATH = "/m/nochmal";

// The module in the browser: the list of sheets, a new sheet, or one sheet,
// by the URL, from the query cache (see index.tsx for the server side).
export function NochmalApp() {
  const searchParams = useSearchParams();
  const sheetId = searchParams.get("sheet");
  if (sheetId) return <SheetView key={sheetId} id={sheetId} />;
  if (searchParams.get("new") === "1") return <NewSheet />;
  return <Overview />;
}

// --- Overview ---------------------------------------------------------------

function Overview() {
  const { data: sheets } = useSuspenseQuery(dataQuery("nochmal", "list"));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground">Neue Spielblätter für „Noch mal!“: generieren, von Hand anpassen, ausdrucken.</p>
        <Button asChild>
          <Link href={`${PATH}?new=1`}>
            <PlusIcon /> Neues Blatt
          </Link>
        </Button>
      </div>

      {sheets.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          Noch kein Blatt. Leg eins an – der Generator macht dir einen spielbaren Entwurf.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sheets.map((entry) => (
            <li key={entry.id}>
              <Link href={`${PATH}?sheet=${entry.id}`} className="block overflow-hidden rounded-xl border bg-card transition-colors hover:border-brand">
                <div className="border-b bg-white">
                  <SheetSvg sheet={entry.sheet} className="block h-auto w-full" />
                </div>
                <div className="p-3">
                  <p className="font-medium">{entry.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {entry.sheet.cols}×{entry.sheet.rows} Kästchen · {entry.sheet.stars.length} Sterne · max. {maxScore(entry.sheet)} Punkte
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Rules />
    </div>
  );
}

// The rules in short, so the printed sheets can be played without the box
// at hand. Sizes and points follow the sheet.
function Rules() {
  return (
    <details className="rounded-xl border bg-card p-4 text-sm">
      <summary className="cursor-pointer font-medium">Kurzregeln</summary>
      <div className="mt-3 space-y-2 text-muted-foreground">
        <p>
          Wer dran ist, wirft drei Farbwürfel und drei Zahlenwürfel und nimmt sich ein Paar aus Farbe und Zahl. Danach dürfen alle anderen
          sich ein Paar aus den übrigen Würfeln nehmen (in den ersten drei Runden aus allen).
        </p>
        <p>
          Man kreuzt genau so viele Kästchen der gewählten Farbe an, wie die Zahl zeigt. Sie müssen in einem Farbblock liegen,
          zusammenhängen (waagerecht oder senkrecht) und an ein schon angekreuztes Kästchen oder an die Startspalte grenzen. Der erste
          Haken überhaupt kommt in die Startspalte. Passen geht immer.
        </p>
        <p>
          Das Fragezeichen auf dem Zahlenwürfel und das schwarze Kreuz auf dem Farbwürfel sind Joker. Für jeden genutzten Joker wird ein
          Ausrufezeichen gestrichen; sind alle weg, gibt es keine Joker mehr.
        </p>
        <p>
          Eine volle Spalte bringt die eingekreiste Zahl, wenn man sie als Erstes schafft, sonst die untere. Eine komplette Farbe bringt den
          Farbbonus (zuerst bzw. später). Jedes übrige Ausrufezeichen zählt 1 Punkt, jeder leere Stern kostet Punkte.
        </p>
        <p>Das Spiel endet, sobald jemand zwei Farben komplett hat. Die meisten Punkte gewinnen.</p>
        <p className="text-xs">Kurzfassung in eigenen Worten; maßgeblich ist die Anleitung aus der Spielschachtel.</p>
      </div>
    </details>
  );
}

// --- Generator form ------------------------------------------------------------

function GeneratorForm({
  options,
  onOptions,
  lockSize = false,
}: {
  options: GeneratorOptions;
  onOptions: (options: GeneratorOptions) => void;
  lockSize?: boolean;
}) {
  const set = (patch: Partial<GeneratorOptions>) => onOptions({ ...options, ...patch });
  const preview = useMemo(() => generate(options), [options]);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
      <div className="space-y-5">
        {!lockSize && (
          <div className="space-y-2">
            <Label>Größe</Label>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {sizePresets.map((preset) => (
                <Choice
                  key={preset.id}
                  active={options.cols === preset.cols && options.rows === preset.rows}
                  onClick={() => set({ cols: preset.cols, rows: preset.rows })}
                >
                  <span className="font-medium">
                    {preset.name} <span className="font-normal text-muted-foreground">{preset.cols}×{preset.rows}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{preset.hint}</span>
                </Choice>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Spalten" value={options.cols} {...limits.cols} onChange={(cols) => set({ cols })} />
              <NumberField label="Reihen" value={options.rows} {...limits.rows} onChange={(rows) => set({ rows })} />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Farbblöcke</Label>
          <div className="grid grid-cols-3 gap-1.5">
            {blockStyles.map((style) => (
              <Choice key={style.id} active={options.blockStyle === style.id} onClick={() => set({ blockStyle: style.id as BlockStyle })}>
                <span className="font-medium">{style.name}</span>
                <span className="text-xs text-muted-foreground">{style.hint}</span>
              </Choice>
            ))}
          </div>
        </div>

        <Segmented
          label="Größter Block"
          value={String(options.maxBlock)}
          options={[4, 5, 6].map((n) => ({ id: String(n), name: `${n} Kästchen` }))}
          onChange={(value) => set({ maxBlock: Number(value) })}
        />
        <Segmented
          label="Sterne pro Spalte"
          value={String(options.starsPerColumn)}
          options={[0, 1, 2].map((n) => ({ id: String(n), name: n === 0 ? "keine" : String(n) }))}
          onChange={(value) => set({ starsPerColumn: Number(value) })}
        />
        <NumberField label="Joker (Ausrufezeichen)" value={options.jokers} {...limits.jokers} onChange={(jokers) => set({ jokers })} />
      </div>

      <div className="space-y-2">
        <div className="overflow-hidden rounded-xl border bg-white">
          <SheetSvg sheet={preview} className="block h-auto w-full" />
        </div>
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            {preview.cols * preview.rows} Kästchen · max. {maxScore(preview)} Punkte
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => set({ seed: Math.floor(Math.random() * 1e9) })}>
            <DicesIcon /> Neu würfeln
          </Button>
        </div>
      </div>
    </div>
  );
}

function NewSheet() {
  const navigate = useViewNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [options, setOptions] = useState<GeneratorOptions>(() => ({ ...defaultOptions, seed: Math.floor(Math.random() * 1e9) }));
  const [pending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      const id = await createSheet(name, generate(options));
      await queryClient.invalidateQueries({ queryKey: ["nochmal"] });
      navigate(`${PATH}?sheet=${id}`, { replace: true });
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <BackLink />
      <div className="space-y-1.5">
        <Label htmlFor="sheet-name">Name</Label>
        <Input
          id="sheet-name"
          placeholder="z. B. Blatt Nr. 1, Spieleabend Mini"
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="max-w-md"
        />
      </div>
      <GeneratorForm options={options} onOptions={setOptions} />
      <Button type="button" onClick={create} disabled={pending}>
        Dieses Blatt anlegen
      </Button>
    </div>
  );
}

function BackLink() {
  return (
    <Link href={PATH} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden">
      <ChevronLeftIcon className="size-4" /> Alle Blätter
    </Link>
  );
}

// --- One sheet ---------------------------------------------------------------

type Tab = "edit" | "generate" | "print";
const tabs: { id: Tab; name: string }[] = [
  { id: "edit", name: "Bearbeiten" },
  { id: "generate", name: "Neu generieren" },
  { id: "print", name: "Drucken" },
];

function SheetView({ id }: { id: string }) {
  const { data: entry } = useSuspenseQuery(dataQuery("nochmal", "sheet", { id }));
  if (!entry) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <BackLink />
        <p className="text-muted-foreground">Dieses Blatt gibt es nicht (mehr).</p>
      </div>
    );
  }
  return <SheetScreen id={id} initialName={entry.name} initialSheet={entry.sheet} />;
}

function SheetScreen({ id, initialName, initialSheet }: { id: string; initialName: string; initialSheet: Sheet }) {
  const queryClient = useQueryClient();
  const navigate = useViewNavigate();
  const [sheet, setSheet] = useState(initialSheet);
  const [name, setName] = useState(initialName);
  const [tab, setTab] = useState<Tab>("edit");
  const [perPage, setPerPage] = useState<PerPage>(2);
  const [copies, setCopies] = useState(6);
  const [status, setStatus] = useState<"saved" | "pending" | "saving" | "error">("saved");
  const dirty = useRef(false);
  const latest = useRef({ sheet, name });
  useLayoutEffect(() => {
    latest.current = { sheet, name };
  }, [sheet, name]);

  async function flush() {
    if (!dirty.current) return;
    dirty.current = false;
    setStatus("saving");
    try {
      await saveSheet(id, latest.current.name, latest.current.sheet);
      setStatus(dirty.current ? "pending" : "saved");
      void queryClient.invalidateQueries({ queryKey: ["nochmal", "list"] });
    } catch {
      dirty.current = true;
      setStatus("error");
    }
  }

  // Saves a moment after the last change, and right away when leaving.
  useEffect(() => {
    if (!dirty.current) return;
    setStatus("pending");
    const timer = setTimeout(() => void flush(), 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, name]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      void flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function change(next: Sheet) {
    dirty.current = true;
    setSheet(next);
  }

  async function remove() {
    if (!(await confirmDialog({ title: `„${name}“ löschen?` }))) return;
    dirty.current = false;
    await deleteSheet(id);
    await queryClient.invalidateQueries({ queryKey: ["nochmal"] });
    navigate(PATH, { replace: true });
  }

  async function duplicate() {
    await flush();
    const copy = await duplicateSheet(id);
    await queryClient.invalidateQueries({ queryKey: ["nochmal"] });
    toast.success("Kopie angelegt");
    navigate(`${PATH}?sheet=${copy}`);
  }

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-4 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <BackLink />
          <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
            {status === "saved" ? "Gespeichert" : status === "error" ? "Speichern fehlgeschlagen, versuche es weiter …" : "Speichert …"}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={duplicate}>
            <CopyIcon /> Kopie
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={remove} className="text-destructive">
            <Trash2Icon /> Löschen
          </Button>
        </div>

        <Input
          aria-label="Name"
          value={name}
          maxLength={80}
          onChange={(event) => {
            dirty.current = true;
            setName(event.target.value);
          }}
          className="h-11 max-w-md text-lg font-medium"
        />

        <div role="tablist" className="flex gap-1 overflow-x-auto rounded-lg border bg-muted p-1">
          {tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              onClick={() => setTab(entry.id)}
              className={cn(
                "flex-1 cursor-pointer rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
                tab === entry.id ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {entry.name}
            </button>
          ))}
        </div>

        {tab === "edit" && <SheetEditor sheet={sheet} onChange={change} />}
        {tab === "generate" && (
          <Regenerate
            sheet={sheet}
            onApply={(next) => {
              change(next);
              setTab("edit");
            }}
          />
        )}
        {tab === "print" && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Blätter pro Seite</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {perPageOptions.map((option) => (
                    <Choice key={option.id} active={perPage === option.id} onClick={() => setPerPage(option.id)}>
                      <span className="font-medium">{option.name}</span>
                      <span className="text-xs text-muted-foreground">{option.hint}</span>
                    </Choice>
                  ))}
                </div>
              </div>
              <NumberField label="Wie viele Blätter?" value={copies} min={1} max={60} onChange={setCopies} />
              <p className="text-sm text-muted-foreground">
                {Math.ceil(copies / perPage)} {Math.ceil(copies / perPage) === 1 ? "Seite" : "Seiten"} A4. Alle Blätter sind gleich – bei
                „Noch mal!“ spielen alle auf demselben Plan. Falls die Farben fehlen: im Druckdialog „Hintergrundgrafiken“ einschalten.
              </p>
              <Button type="button" onClick={() => window.print()}>
                <PrinterIcon /> Drucken
              </Button>
            </div>
            <div className="overflow-hidden rounded-xl border bg-white">
              <SheetSvg sheet={sheet} title={name} className="block h-auto w-full" />
            </div>
          </div>
        )}
      </div>
      <PrintSheets sheet={sheet} name={name} perPage={perPage} copies={copies} />
    </>
  );
}

function Regenerate({ sheet, onApply }: { sheet: Sheet; onApply: (sheet: Sheet) => void }) {
  const [options, setOptions] = useState<GeneratorOptions>(() => ({
    ...defaultOptions,
    cols: sheet.cols,
    rows: sheet.rows,
    jokers: sheet.jokers,
    seed: Math.floor(Math.random() * 1e9),
  }));
  return (
    <div className="space-y-4">
      <GeneratorForm options={options} onOptions={setOptions} />
      <Button
        type="button"
        onClick={async () => {
          if (
            !(await confirmDialog({
              title: "Blatt ersetzen?",
              description: "Farben, Sterne und Punkte werden durch den neuen Entwurf ersetzt. Rückgängig geht danach im Editor nicht.",
              confirmLabel: "Ersetzen",
            }))
          )
            return;
          onApply(generate(options));
        }}
      >
        Diesen Entwurf übernehmen
      </Button>
    </div>
  );
}

// --- Small controls -------------------------------------------------------------

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex cursor-pointer flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
        active ? "border-brand bg-good text-good-foreground" : "bg-card hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; name: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-1 rounded-lg border bg-muted p-1">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={value === option.id}
            onClick={() => onChange(option.id)}
            className={cn(
              "flex-1 cursor-pointer rounded-md px-3 py-1 text-sm transition-colors",
              value === option.id ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.name}
          </button>
        ))}
      </div>
    </div>
  );
}
