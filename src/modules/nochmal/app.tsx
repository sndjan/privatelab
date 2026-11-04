"use client";

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ChevronLeftIcon, CopyIcon, DicesIcon, PrinterIcon, Trash2Icon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm-dialog";
import { dataQuery } from "@/lib/query/data";
import { ViewLink as Link, useViewNavigate } from "@/lib/query/view-link";
import { cn } from "@/lib/utils";
import { createSheet, deleteSheet, duplicateSheet, saveSheet } from "./actions";
import {
  blankSheet,
  blockPlan,
  defaultOptions,
  generate,
  limits,
  maxScore,
  sizePresets,
  variantOf,
  variants,
  type GeneratorOptions,
  type Sheet,
  type VariantId,
} from "./data";
import { SheetEditor } from "./editor";
import type { SheetEntry } from "./loaders";
import { perPageOptions, printPages, PrintSheets, type PerPage } from "./print";
import { SheetSvg } from "./sheet-svg";
import { BigButton, Choice, display, Heading, Logo, Muted, Panel, Segmented, SmallButton, Stepper, Table, TextField } from "./ui";

const PATH = "/m/nochmal";

// Per variant: three colours for its card and the badge colour.
const variantLook: Record<VariantId, { swatch: string[]; badge: string; short: string }> = {
  klassisch: { swatch: ["#8cc63f", "#ffcf2e", "#5cc6f0"], badge: "#8cc63f", short: "Noch mal!" },
  sogut: { swatch: ["#ef3f80", "#e3a640", "#5cc6f0"], badge: "#ef3f80", short: "So gut!" },
  xmal: { swatch: ["#5cc6f0", "#ffffff", "#f7941d"], badge: "#5cc6f0", short: "X-Mal!" },
  kids: { swatch: ["#8cc63f", "#ffcf2e", "#ef3f80"], badge: "#ffcf2e", short: "Kids" },
};

// The module in the browser: the start page (generator, my sheets, rules) or
// one sheet, by the URL, from the query cache (see index.tsx).
export function NochmalApp() {
  const searchParams = useSearchParams();
  const sheetId = searchParams.get("sheet");
  if (sheetId) return <SheetView key={sheetId} id={sheetId} />;
  return <Home />;
}

// --- Start page ----------------------------------------------------------------

function Home() {
  const { data: sheets } = useSuspenseQuery(dataQuery("nochmal", "list"));

  return (
    <Table>
      <div className="mx-auto max-w-[1320px]">
        <header className="flex flex-wrap items-center gap-4 pb-6">
          <div className="flex items-center gap-3">
            <Logo />
            <h2 className={cn(display, "text-3xl")}>Noch-mal-Blätter</h2>
          </div>
          <nav aria-label="Bereiche" className="ml-auto flex flex-wrap gap-1.5">
            <a href="#neu" className="rounded-full bg-[#ff9a2e] px-4 py-2.5 font-extrabold text-[#1a1205]">
              Neues Blatt
            </a>
            <a href="#meine" className="rounded-full bg-(--nm-chip) px-4 py-2.5 font-bold text-(--nm-text-soft) hover:bg-(--nm-hover)">
              Meine Blätter
            </a>
            <a href="#regeln" className="rounded-full bg-(--nm-chip) px-4 py-2.5 font-bold text-(--nm-text-soft) hover:bg-(--nm-hover)">
              Kurzregeln
            </a>
          </nav>
        </header>

        <Generator />

        <section id="meine" className="mt-12 scroll-mt-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <Heading className="text-3xl">Meine Blätter</Heading>
            <Muted>
              {sheets.length} {sheets.length === 1 ? "Blatt" : "Blätter"}
            </Muted>
          </div>
          {sheets.length === 0 ? (
            <div className="rounded-[20px] border-2 border-dashed border-(--nm-line) p-8 text-center font-bold text-(--nm-muted)">
              Noch kein Blatt. Würfel oben eins zusammen und leg es an.
            </div>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
              {sheets.map((entry) => (
                <li key={entry.id}>
                  <SheetCard entry={entry} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <Rules />
      </div>
    </Table>
  );
}

function SheetCard({ entry }: { entry: SheetEntry }) {
  const look = variantLook[entry.sheet.variant];
  return (
    <Link
      href={`${PATH}?sheet=${entry.id}`}
      className="flex flex-col overflow-hidden rounded-[20px] border border-(--nm-line) bg-(--nm-panel) transition-colors hover:border-[#ff9a2e]"
    >
      <div className="bg-(--nm-well) p-3">
        <SheetSvg sheet={entry.sheet} className="block h-auto w-full" />
      </div>
      <div className="flex items-center justify-between gap-2 px-4 py-3.5">
        <div className="min-w-0">
          <p className={cn(display, "truncate text-lg")}>{entry.name}</p>
          <p className="text-[13px] font-bold text-(--nm-muted)">
            {entry.sheet.cols} × {entry.sheet.rows} · {new Date(entry.updatedAt).toLocaleDateString("de-DE")}
          </p>
        </div>
        <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-black text-[#111417]" style={{ background: look.badge }}>
          {look.short}
        </span>
      </div>
    </Link>
  );
}

// --- Generator -------------------------------------------------------------------

function Generator() {
  const navigate = useViewNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [options, setOptions] = useState<GeneratorOptions>(() => ({ ...defaultOptions, seed: Math.floor(Math.random() * 1e9) }));
  // "random": a generated plan; "blank": every box set by hand in the editor.
  const [start, setStart] = useState<"random" | "blank">("random");
  const [pending, startTransition] = useTransition();
  // Big sheets take a moment to lay out; the controls stay quick meanwhile.
  const deferred = useDeferredValue(options);
  const blank = start === "blank";
  const preview = useMemo(() => (blank ? blankSheet(deferred) : generate(deferred)), [deferred, blank]);
  const set = (patch: Partial<GeneratorOptions>) => setOptions((current) => ({ ...current, ...patch }));

  function pickVariant(id: VariantId) {
    const variant = variantOf(id);
    set({ variant: id, ...variant.options });
  }

  function create() {
    startTransition(async () => {
      const id = await createSheet(name || `Blatt ${new Date().toLocaleDateString("de-DE")}`, blank ? blankSheet(options) : generate(options));
      await queryClient.invalidateQueries({ queryKey: ["nochmal"] });
      navigate(`${PATH}?sheet=${id}`);
    });
  }

  const total = options.cols * options.rows;
  const plan = blockPlan(Math.floor(total / 5), options.maxBlock);

  return (
    <section id="neu" className="flex scroll-mt-6 flex-wrap items-start gap-6">
      <Panel className="flex max-w-[460px] flex-[1_1_380px] flex-col gap-6">
        <div className="space-y-2.5">
          <Heading>Wie anfangen?</Heading>
          <div className="grid grid-cols-2 gap-2">
            <Choice active={!blank} onClick={() => setStart("random")}>
              <span className="text-sm font-extrabold">Zufällig würfeln</span>
              <span className="text-xs text-(--nm-muted)">Fertiger Plan zum Anpassen</span>
            </Choice>
            <Choice active={blank} onClick={() => setStart("blank")}>
              <span className="text-sm font-extrabold">Von Grund auf</span>
              <span className="text-xs text-(--nm-muted)">Leere Kästchen, alles selbst setzen</span>
            </Choice>
          </div>
        </div>

        <div className="space-y-2.5">
          <Heading>Welches Spiel?</Heading>
          <div className="grid grid-cols-2 gap-2">
            {variants.map((variant) => (
              <Choice key={variant.id} active={options.variant === variant.id} onClick={() => pickVariant(variant.id)} className="min-h-24 gap-1.5 p-3">
                <span className="flex gap-[3px]" aria-hidden="true">
                  {variantLook[variant.id].swatch.map((color) => (
                    <span key={color} className="size-3 rounded-[3px]" style={{ background: color }} />
                  ))}
                </span>
                <span className={cn(display, "text-[17px]")}>{variant.name}</span>
                <span className="text-[12.5px] leading-snug text-(--nm-muted)">{variant.hint}</span>
              </Choice>
            ))}
          </div>
        </div>

        <div className="space-y-2.5">
          <Heading>Größe</Heading>
          <div className="flex flex-wrap gap-1.5">
            {sizePresets.map((preset) => (
              <Choice
                key={preset.id}
                active={options.cols === preset.cols && options.rows === preset.rows}
                onClick={() => set({ cols: preset.cols, rows: preset.rows })}
              >
                <span className="text-sm font-extrabold">{preset.name}</span>
                <span className="text-xs text-(--nm-muted)">
                  {preset.cols} × {preset.rows}
                </span>
              </Choice>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stepper label="Spalten" value={options.cols} {...limits.cols} onChange={(cols) => set({ cols })} />
            <Stepper label="Reihen" value={options.rows} {...limits.rows} onChange={(rows) => set({ rows })} />
          </div>
        </div>

        {blank ? (
          <>
            <Muted className="font-semibold leading-relaxed">
              Im Editor malst du jedes Kästchen in einer der fünf Farben an und setzt die Sterne selbst. Gut spielbar wird es mit{" "}
              {plan.join(" + ")} Kästchen großen Blöcken je Farbe; die Prüfliste dort hilft dabei.
            </Muted>
            <Stepper label="Joker" value={options.jokers} {...limits.jokers} onChange={(jokers) => set({ jokers })} />
          </>
        ) : (
          <>
            <div className="space-y-2.5">
              <Heading>Farbblöcke</Heading>
              <Segmented
                label="Größter Block"
                value={String(options.maxBlock)}
                options={[4, 5, 6].map((n) => ({ id: String(n), name: `${n} Kästchen` }))}
                onChange={(value) => set({ maxBlock: Number(value) })}
              />
              <Muted className="font-semibold">Jede Farbe bekommt dieselben Blöcke: {plan.join(" + ")}.</Muted>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Segmented
                label="Sterne pro Spalte"
                value={String(options.starsPerColumn)}
                options={[0, 1, 2].map((n) => ({ id: String(n), name: String(n) }))}
                onChange={(value) => set({ starsPerColumn: Number(value) })}
              />
              <Stepper label="Joker" value={options.jokers} {...limits.jokers} onChange={(jokers) => set({ jokers })} />
            </div>
          </>
        )}

        <TextField label="Name" placeholder="z. B. Waldlauf" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
      </Panel>

      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
        <div className="flex flex-col items-center gap-6 rounded-[26px] border border-(--nm-stage-line) bg-(image:--nm-stage) px-5 py-8 sm:px-8">
          <div className={cn("w-full max-w-3xl -rotate-1 drop-shadow-[0_24px_40px_var(--nm-shadow)] transition-opacity", deferred !== options && "opacity-70")}>
            <SheetSvg sheet={preview} className="block h-auto w-full" />
          </div>
          <div className="flex flex-wrap justify-center gap-2.5">
            {!blank && (
              <BigButton tone="white" onClick={() => set({ seed: Math.floor(Math.random() * 1e9) })}>
                <DicesIcon /> Neu würfeln
              </BigButton>
            )}
            <BigButton onClick={create} disabled={pending}>
              {pending ? "Wird angelegt …" : blank ? "Leeres Blatt anlegen" : "Blatt anlegen"}
            </BigButton>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(blank
            ? [`${total} Kästchen`, `${Math.floor(total / 5)}${total % 5 ? "–" + Math.ceil(total / 5) : ""} je Farbe`, `max. ${maxScore(preview)} Punkte`]
            : [
                `${total} Kästchen`,
                `${Math.floor(total / 5)}${total % 5 ? "–" + Math.ceil(total / 5) : ""} je Farbe`,
                `Größter Block ${Math.max(...plan)}`,
                `max. ${maxScore(preview)} Punkte`,
              ]
          ).map((text) => (
            <span key={text} className="flex items-center gap-2 rounded-full border border-(--nm-line) bg-(--nm-panel) px-3.5 py-2 text-sm font-bold">
              <span className="size-2 rounded-full bg-[#8cc63f]" />
              {text}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// The rules in short, from the rule books, so printed sheets can be played
// without the box at hand.
function Rules() {
  return (
    <section id="regeln" className="mt-12 scroll-mt-6">
      <Panel className="p-6">
        <Heading className="mb-4 text-2xl">Kurzregeln</Heading>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5 text-[15px] leading-relaxed text-(--nm-text-soft)">
          <p>
            <strong className="text-(--nm-text)">Würfeln.</strong> Wer dran ist, würfelt alle Würfel und nimmt 1 Farb- und 1 Zahlenwürfel. Alle
            anderen wählen aus dem Rest. In den ersten 3 Würfen dürfen alle aus allen Würfeln wählen. Passen geht immer.
          </p>
          <p>
            <strong className="text-(--nm-text)">Ankreuzen.</strong> Genau so viele Kästchen wie die Zahl, zusammenhängend in einem Farbblock,
            waagerecht oder senkrecht an Kreuze oder die Startspalte angrenzend. Der erste Wurf muss in die Startspalte. Höchstens 5 pro Wurf.
          </p>
          <p>
            <strong className="text-(--nm-text)">Joker.</strong> „?“ ist eine Zahl von 1 bis 5, das schwarze Kreuz eine Farbe nach Wahl. Pro Joker ein
            Ausrufezeichen streichen; übrige zählen am Ende je 1 Punkt.
          </p>
          <p>
            <strong className="text-(--nm-text)">Werten.</strong> Volle Spalte: obere Zahl für die Ersten, alle späteren die untere. Volle Farbe: 5
            bzw. 3. Leere Sterne −2. Schluss, sobald jemand die zweite Farbe voll hat.
          </p>
          <p>
            <strong className="text-(--nm-text)">Noch mal so gut!</strong> Goldene Würfelfelder schalten Sonderwürfel frei (Bombe 2×2, Herz, 2 Sterne,
            3 in einer Zeile, ganzer Farbblock). Volle Zeile: 5 Punkte, der Erste bekommt den Zeilenbonus. Herzen erhöhen den Bonus für jede
            später volle Spalte; ungenutzte Sonderwürfel +2.
          </p>
          <p>
            <strong className="text-(--nm-text)">Solo.</strong> Nur 2 Farb- und 2 Zahlenwürfel. Nach jedem Wurf einen Strich in ein Buchstabenfeld,
            je Feld zwei (/ und \). Nach 30 Würfen wird gewertet.
          </p>
        </div>
      </Panel>
    </section>
  );
}

// --- One sheet -----------------------------------------------------------------------

type Tab = "edit" | "generate" | "print";
const tabs: { id: Tab; name: string }[] = [
  { id: "edit", name: "Bearbeiten" },
  { id: "generate", name: "Neu würfeln" },
  { id: "print", name: "Drucken" },
];

function SheetView({ id }: { id: string }) {
  const { data: entry } = useSuspenseQuery(dataQuery("nochmal", "sheet", { id }));
  if (!entry) {
    return (
      <Table>
        <div className="mx-auto max-w-2xl space-y-3">
          <BackLink />
          <p className="font-bold text-(--nm-muted)">Dieses Blatt gibt es nicht (mehr).</p>
        </div>
      </Table>
    );
  }
  return <SheetScreen id={id} initialName={entry.name} initialSheet={entry.sheet} />;
}

function BackLink() {
  return (
    <Link href={PATH} className="inline-flex items-center gap-1.5 px-1 py-2.5 font-bold text-(--nm-muted) hover:text-(--nm-text)">
      <ChevronLeftIcon className="size-4" /> Alle Blätter
    </Link>
  );
}

function SheetScreen({ id, initialName, initialSheet }: { id: string; initialName: string; initialSheet: Sheet }) {
  const queryClient = useQueryClient();
  const navigate = useViewNavigate();
  const [sheet, setSheet] = useState(initialSheet);
  const [name, setName] = useState(initialName);
  const [tab, setTab] = useState<Tab>("edit");
  const [perPage, setPerPage] = useState<PerPage>("2");
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

  const look = variantLook[sheet.variant];

  return (
    <>
      <Table>
        <div className="mx-auto flex max-w-[1320px] flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <BackLink />
            <span className="ml-auto flex items-center gap-1.5 text-[13px] font-extrabold" aria-live="polite">
              <span className={cn("size-2 rounded-full", status === "saved" ? "bg-[#8cc63f]" : status === "error" ? "bg-[#ff4d4d]" : "bg-[#ffcf2e]")} />
              <span className={status === "saved" ? "text-(--nm-ok)" : status === "error" ? "text-(--nm-danger)" : "text-(--nm-warn)"}>
                {status === "saved" ? "Gespeichert" : status === "error" ? "Speichern fehlgeschlagen, versuche es weiter …" : "Speichert …"}
              </span>
            </span>
            <SmallButton onClick={duplicate}>
              <CopyIcon /> Kopie
            </SmallButton>
            <SmallButton onClick={remove} className="text-(--nm-danger)">
              <Trash2Icon /> Löschen
            </SmallButton>
            <BigButton className="h-11 px-5 text-base" onClick={() => setTab("print")}>
              <PrinterIcon /> Drucken
            </BigButton>
          </div>

          <div className="flex flex-wrap items-center gap-3.5">
            <input
              aria-label="Name"
              value={name}
              maxLength={80}
              onChange={(event) => {
                dirty.current = true;
                setName(event.target.value);
              }}
              className={cn(
                display,
                "w-full max-w-md min-w-0 border-0 border-b-2 border-dashed border-(--nm-line-strong) bg-transparent py-0.5 text-4xl text-(--nm-text) outline-none focus:border-[#ff9a2e]",
              )}
            />
            <span className="rounded-full px-3 py-1.5 text-[13px] font-black text-[#111417]" style={{ background: look.badge }}>
              {variantOf(sheet.variant).name} · {sheet.cols} × {sheet.rows}
            </span>
          </div>

          <div role="tablist" className="flex max-w-lg gap-1 rounded-xl bg-(--nm-panel) p-1">
            {tabs.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={tab === entry.id}
                onClick={() => setTab(entry.id)}
                className={cn(
                  "min-h-11 flex-1 cursor-pointer rounded-[9px] px-3 text-sm font-extrabold whitespace-nowrap transition-colors",
                  tab === entry.id ? "bg-[#ff9a2e] text-[#1a1205]" : "text-(--nm-text-soft) hover:bg-(--nm-hover)",
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
            <div className="flex flex-wrap items-start gap-6">
              <Panel className="flex max-w-[440px] flex-[1_1_340px] flex-col gap-5">
                <div className="space-y-2.5">
                  <Heading>Format</Heading>
                  <div className="grid grid-cols-2 gap-2">
                    {perPageOptions.map((option) => (
                      <Choice key={option.id} active={perPage === option.id} onClick={() => setPerPage(option.id)}>
                        <span className={cn(display, "text-[17px]")}>{option.name}</span>
                        <span className="text-xs text-(--nm-muted)">{option.hint}</span>
                      </Choice>
                    ))}
                  </div>
                </div>
                <Stepper label="Wie viele Blätter?" value={copies} min={1} max={60} onChange={setCopies} />
                <Muted className="font-semibold leading-relaxed">
                  {printPages(perPage, copies)} {printPages(perPage, copies) === 1 ? "Seite" : "Seiten"}{" "}
                  {perPageOptions.find((option) => option.id === perPage)!.paper}. Alle spielen auf demselben Plan, deshalb ist jedes Blatt gleich.
                  Falls die Farben fehlen: im Druckdialog „Hintergrundgrafiken“ einschalten.
                </Muted>
                <BigButton onClick={() => window.print()}>
                  <PrinterIcon /> Drucken
                </BigButton>
              </Panel>
              <div className="min-w-0 flex-[999_1_520px] rounded-[26px] border border-(--nm-stage-line) bg-(image:--nm-stage) p-6 sm:p-8">
                <SheetSvg sheet={sheet} title={name} className="block h-auto w-full -rotate-1 drop-shadow-[0_24px_40px_var(--nm-shadow)]" />
              </div>
            </div>
          )}
        </div>
      </Table>
      <PrintSheets sheet={sheet} name={name} perPage={perPage} copies={copies} />
    </>
  );
}

function Regenerate({ sheet, onApply }: { sheet: Sheet; onApply: (sheet: Sheet) => void }) {
  const [options, setOptions] = useState<GeneratorOptions>(() => ({
    ...defaultOptions,
    ...variantOf(sheet.variant).options,
    variant: sheet.variant,
    cols: sheet.cols,
    rows: sheet.rows,
    jokers: sheet.jokers,
    seed: Math.floor(Math.random() * 1e9),
  }));
  const deferred = useDeferredValue(options);
  const preview = useMemo(() => generate(deferred), [deferred]);
  const set = (patch: Partial<GeneratorOptions>) => setOptions((current) => ({ ...current, ...patch }));

  return (
    <div className="flex flex-wrap items-start gap-6">
      <Panel className="flex max-w-[440px] flex-[1_1_340px] flex-col gap-5">
        <Muted className="font-semibold leading-relaxed">
          Ein neuer Plan in derselben Größe ({sheet.cols} × {sheet.rows}). Farben, Sterne und Sonderfelder werden ersetzt.
        </Muted>
        <Segmented
          label="Größter Block"
          value={String(options.maxBlock)}
          options={[4, 5, 6].map((n) => ({ id: String(n), name: `${n} Kästchen` }))}
          onChange={(value) => set({ maxBlock: Number(value) })}
        />
        <Segmented
          label="Sterne pro Spalte"
          value={String(options.starsPerColumn)}
          options={[0, 1, 2].map((n) => ({ id: String(n), name: String(n) }))}
          onChange={(value) => set({ starsPerColumn: Number(value) })}
        />
        <div className="flex flex-wrap gap-2.5">
          <BigButton tone="white" onClick={() => set({ seed: Math.floor(Math.random() * 1e9) })}>
            <DicesIcon /> Neu würfeln
          </BigButton>
          <BigButton
            onClick={async () => {
              if (
                !(await confirmDialog({
                  title: "Blatt ersetzen?",
                  description: "Der Plan wird durch den neuen Entwurf ersetzt.",
                  confirmLabel: "Ersetzen",
                }))
              )
                return;
              onApply({ ...generate(options), art: sheet.art });
            }}
          >
            Übernehmen
          </BigButton>
        </div>
        <button
          type="button"
          className="self-start py-2 text-sm font-extrabold text-(--nm-muted) underline underline-offset-4 hover:text-(--nm-text)"
          onClick={async () => {
            if (
              !(await confirmDialog({
                title: "Alle Kästchen leeren?",
                description: "Farben, Sterne und Sonderfelder werden entfernt, damit du das Blatt von Grund auf selbst gestalten kannst.",
                confirmLabel: "Leeren",
              }))
            )
              return;
            onApply({ ...blankSheet(options), art: sheet.art });
          }}
        >
          Stattdessen leer machen und alles selbst setzen
        </button>
      </Panel>
      <div className="min-w-0 flex-[999_1_520px] rounded-[26px] border border-(--nm-stage-line) bg-(image:--nm-stage) p-6 sm:p-8">
        <SheetSvg sheet={preview} className="block h-auto w-full -rotate-1 drop-shadow-[0_24px_40px_var(--nm-shadow)]" />
      </div>
    </div>
  );
}
