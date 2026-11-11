"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Confetti } from "./confetti";
import type { PublicCrossword } from "./puzzles";

type Word = PublicCrossword["words"][number];
type Cell = { row: number; col: number };

const cellsOf = (word: Word): Cell[] =>
  Array.from({ length: word.answer.length }, (_, i) =>
    word.dir === "across" ? { row: word.row, col: word.col + i } : { row: word.row + i, col: word.col },
  );

const key = (row: number, col: number) => `${row},${col}`;

function emptyGrid(puzzle: PublicCrossword) {
  return puzzle.grid.map((line) => [...line].map((ch) => (ch === "." ? "." : "")));
}

// Keeps the page light while the puzzle is open, whatever the device's theme
// (the solver should see the puzzle the same way everywhere). Restores the
// setting when leaving. The inline script in page.tsx does the same before
// the first paint.
function useLightTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const meta = document.querySelector('meta[name="theme-color"]');
    const force = () => {
      if (root.dataset.theme !== "light") root.dataset.theme = "light";
      if (meta && meta.getAttribute("content") !== "#ffffff") meta.setAttribute("content", "#ffffff");
    };
    force();
    const observer = new MutationObserver(force);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      observer.disconnect();
      window.dispatchEvent(new Event("themechange"));
    };
  }, []);
}

// The crossword for the solver: tap a cell (tap again to switch between
// across and down), type with the phone keyboard. No checking or revealing
// (filled clues are greyed, right or wrong); once every letter is right it
// says so. Progress stays in this browser.
export function CrosswordPlayer({ puzzle }: { puzzle: PublicCrossword }) {
  useLightTheme();
  const storageKey = `crossword:${puzzle.code}`;
  const [letters, setLetters] = useState<string[][]>(() => emptyGrid(puzzle));
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<Word | null>(null);
  const [cursor, setCursor] = useState<Cell | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  // Counts the moments the last right letter went in; each starts the confetti.
  const [celebrations, setCelebrations] = useState(0);

  const ordered = useMemo(
    () => [...puzzle.words.filter((w) => w.dir === "across"), ...puzzle.words.filter((w) => w.dir === "down")],
    [puzzle],
  );
  const numbers = useMemo(() => {
    const map = new Map<string, number>();
    puzzle.words.forEach((w) => map.set(key(w.row, w.col), w.n));
    return map;
  }, [puzzle]);

  // Saved progress is read after mounting, so the server and the first
  // render in the browser match.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (Array.isArray(saved) && saved.length === puzzle.rows) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from storage
        setLetters(saved);
      }
    } catch {}
    setLoaded(true);
  }, [storageKey, puzzle.rows]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(letters));
    } catch {}
  }, [letters, loaded, storageKey]);

  const solved = puzzle.grid.every((line, r) => [...line].every((ch, c) => ch === "." || letters[r]?.[c] === ch));
  const isFilled = (word: Word) => cellsOf(word).every(({ row, col }) => letters[row][col]);
  const wordsAt = (row: number, col: number) =>
    puzzle.words.filter((w) => cellsOf(w).some((cell) => cell.row === row && cell.col === col));

  function focusKeyboard() {
    const input = inputRef.current;
    if (!input) return;
    input.value = " ";
    input.focus({ preventScroll: true });
  }

  function select(word: Word, cell?: Cell, grid = letters) {
    const cells = cellsOf(word);
    setSelected(word);
    setCursor(cell ?? cells.find(({ row, col }) => !grid[row][col]) ?? cells[0]);
    focusKeyboard();
  }

  function tapCell(row: number, col: number) {
    const here = wordsAt(row, col);
    let word = here[0];
    const onCursor = cursor?.row === row && cursor?.col === col;
    if (selected && here.includes(selected)) word = onCursor && here.length > 1 ? here.find((w) => w !== selected)! : selected;
    select(word, { row, col });
  }

  // One handler for the whole board (the cells carry their position).
  function onBoardClick(event: React.MouseEvent<HTMLDivElement>) {
    const cell = (event.target as HTMLElement).closest<HTMLElement>("[data-row]");
    if (cell) tapCell(Number(cell.dataset.row), Number(cell.dataset.col));
  }

  function moveWord(step: number, grid = letters, skipFilled = false) {
    let index = selected ? ordered.indexOf(selected) : -1;
    for (let tries = 0; tries < ordered.length; tries++) {
      index = (index + step + ordered.length) % ordered.length;
      if (!skipFilled || !cellsOf(ordered[index]).every(({ row, col }) => grid[row][col])) break;
    }
    select(ordered[index], undefined, grid);
  }

  function type(letter: string) {
    if (!selected || !cursor) return;
    const next = letters.map((line) => [...line]);
    next[cursor.row][cursor.col] = letter;
    setLetters(next);
    const wasSolved = puzzle.grid.every((line, r) => [...line].every((ch, c) => ch === "." || letters[r][c] === ch));
    const nowSolved = puzzle.grid.every((line, r) => [...line].every((ch, c) => ch === "." || next[r][c] === ch));
    if (nowSolved && !wasSolved) {
      setCelebrations((count) => count + 1);
      inputRef.current?.blur();
      setSelected(null);
      setCursor(null);
      return;
    }
    const cells = cellsOf(selected);
    const index = cells.findIndex((cell) => cell.row === cursor.row && cell.col === cursor.col);
    if (index < cells.length - 1) setCursor(cells[index + 1]);
    else if (cells.every(({ row, col }) => next[row][col])) moveWord(1, next, true);
  }

  function erase() {
    if (!selected || !cursor) return;
    const next = letters.map((line) => [...line]);
    let target = cursor;
    if (!next[cursor.row][cursor.col]) {
      const cells = cellsOf(selected);
      const index = cells.findIndex((cell) => cell.row === cursor.row && cell.col === cursor.col);
      if (index > 0) target = cells[index - 1];
    }
    next[target.row][target.col] = "";
    setLetters(next);
    setCursor(target);
  }

  function onInput(event: React.FormEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const value = input.value;
    if (value.length === 0) erase();
    else {
      const found = value
        .toUpperCase()
        .replace(/Ä/g, "A")
        .replace(/Ö/g, "O")
        .replace(/Ü/g, "U")
        .match(/[A-Z]/g);
      if (found) type(found[found.length - 1]);
    }
    input.value = " ";
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    const moves: Record<string, [number, number, Word["dir"]]> = {
      ArrowRight: [0, 1, "across"],
      ArrowLeft: [0, -1, "across"],
      ArrowDown: [1, 0, "down"],
      ArrowUp: [-1, 0, "down"],
    };
    const move = moves[event.key];
    if (move && cursor) {
      event.preventDefault();
      const row = cursor.row + move[0];
      const col = cursor.col + move[1];
      const ch = puzzle.grid[row]?.[col];
      if (ch && ch !== ".") {
        const here = wordsAt(row, col);
        select(here.find((w) => w.dir === move[2]) ?? here[0], { row, col });
      }
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      moveWord(event.shiftKey ? -1 : 1);
    }
  }

  const inWord = new Set(selected ? cellsOf(selected).map(({ row, col }) => key(row, col)) : []);

  const clueList = (dir: Word["dir"], title: string) => (
    <section className="min-w-0">
      <h2 className="mb-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{title}</h2>
      <ol className="flex flex-col gap-0.5">
        {puzzle.words
          .filter((w) => w.dir === dir)
          .map((w) => (
            <li key={`${dir}${w.n}`}>
              <button
                type="button"
                onClick={() => {
                  select(w);
                  boardRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                }}
                className={cn(
                  "grid w-full grid-cols-[1.5rem_1fr_auto] gap-1.5 rounded-md px-2 py-1.5 text-left text-sm",
                  w === selected && "bg-[#d4ebe1]",
                )}
              >
                <span className="font-semibold text-brand tabular-nums">{w.n}</span>
                <span className={cn(isFilled(w) && "text-muted-foreground")}>{w.clue}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{w.answer.length}</span>
              </button>
            </li>
          ))}
      </ol>
    </section>
  );

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-3">
      <h1 className="text-2xl font-bold tracking-tight">🧩 Kreuzwort Rätsel</h1>
      <div className="sticky top-[env(safe-area-inset-top)] z-10 grid min-h-14 grid-cols-[2.5rem_1fr_2.5rem] items-center rounded-xl bg-brand text-brand-foreground">
        <button type="button" aria-label="Vorheriger Begriff" className="flex h-full items-center justify-center" onClick={() => moveWord(-1)}>
          <ChevronLeftIcon className="size-5" />
        </button>
        <div className="py-2 text-sm">
          {selected ? (
            <>
              <span className="block text-[0.7rem] font-semibold tracking-wider opacity-80">
                {selected.n} {selected.dir === "across" ? "WAAGERECHT" : "SENKRECHT"} · {selected.answer.length} BUCHSTABEN
              </span>
              {selected.clue}
            </>
          ) : (
            "Tippe auf ein Feld oder einen Begriff"
          )}
        </div>
        <button type="button" aria-label="Nächster Begriff" className="flex h-full items-center justify-center" onClick={() => moveWord(1)}>
          <ChevronRightIcon className="size-5" />
        </button>
      </div>

      <div
        ref={boardRef}
        className="grid touch-manipulation rounded-lg bg-[#22313a] p-[3px] select-none"
        style={{ gridTemplateColumns: `repeat(${puzzle.cols}, 1fr)` }}
        onClick={onBoardClick}
      >
        {puzzle.grid.flatMap((line, row) =>
          [...line].map((ch, col) => {
            if (ch === ".") return <div key={key(row, col)} className="aspect-square" />;
            const current = cursor?.row === row && cursor?.col === col;
            return (
              <button
                key={key(row, col)}
                type="button"
                tabIndex={-1}
                data-row={row}
                data-col={col}
                className={cn(
                  "relative m-px aspect-square rounded-[2px] bg-white",
                  inWord.has(key(row, col)) && "bg-[#d4ebe1]",
                  current && "bg-[#ffd77a]",
                )}
                aria-label={`Feld ${row + 1}/${col + 1}`}
              >
                {numbers.has(key(row, col)) && (
                  <span className="absolute top-px left-0.5 text-[clamp(7px,2vw,10px)] leading-none font-medium text-muted-foreground">
                    {numbers.get(key(row, col))}
                  </span>
                )}
                <span className="absolute inset-0 grid place-items-center pt-0.5 text-[clamp(15px,5.2vw,24px)] leading-none font-bold text-[#16201c]">
                  {letters[row][col]}
                </span>
              </button>
            );
          }),
        )}
      </div>

      <div aria-live="polite">
        {loaded && solved && (
          <div
            key={celebrations}
            className={cn(
              "rounded-xl bg-[#e3f2ea] px-4 py-3 text-center text-[#134634]",
              celebrations > 0 && "animate-in duration-500 zoom-in-75 fade-in motion-reduce:animate-none",
            )}
          >
            <p className="text-lg font-bold">🎉 Geschafft!</p>
            <p className="text-sm">Alle Wörter stimmen.</p>
          </div>
        )}
      </div>
      <Confetti run={celebrations} />

      <div className="grid gap-4 sm:grid-cols-2">
        {clueList("across", "Waagerecht")}
        {clueList("down", "Senkrecht")}
      </div>

      <input
        ref={inputRef}
        type="text"
        aria-label="Buchstabe eingeben"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck={false}
        defaultValue=" "
        onInput={onInput}
        onKeyDown={onKeyDown}
        className="fixed top-1/3 left-0 size-px border-0 p-0 text-base opacity-0"
      />
    </div>
  );
}
