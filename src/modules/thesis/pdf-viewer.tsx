"use client";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  Loader2Icon,
  MaximizeIcon,
  MinimizeIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";

// Must be set in the module that renders <Document> (see react-pdf's README).
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

const zoomSteps = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

// PDF viewer built on pdf.js, so it works the same on phones (where browsers
// often can't show PDFs inline). Pages are rendered once they come near the
// visible area; text can be selected and links work.
export default function PdfViewer({ url }: { url: string }) {
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const pages = useRef(new Map<number, HTMLDivElement>());
  const [width, setWidth] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  // Height / width of the first page, for placeholders of pages not rendered yet.
  const [ratio, setRatio] = useState(1.414);
  const [zoom, setZoom] = useState(2);
  const [current, setCurrent] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!scroller) return;
    const observer = new ResizeObserver(() => setWidth(scroller.clientWidth));
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [scroller]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setFullscreen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const pageWidth = Math.max(200, Math.floor((width - 24) * zoomSteps[zoom]));
  const goTo = (number: number) => pages.current.get(number)?.scrollIntoView({ block: "start" });

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex flex-col bg-background"
          : "flex h-[75vh] min-h-96 flex-col overflow-hidden rounded-xl border"
      }
    >
      <div className="flex items-center gap-1 border-b bg-card px-2 py-1.5">
        <Button variant="ghost" size="icon" aria-label="Vorherige Seite" disabled={current <= 1} onClick={() => goTo(current - 1)}>
          <ChevronUpIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Nächste Seite"
          disabled={current >= pageCount}
          onClick={() => goTo(current + 1)}
        >
          <ChevronDownIcon />
        </Button>
        <span className="px-1 font-mono text-sm whitespace-nowrap text-muted-foreground">
          {pageCount > 0 ? `${current} / ${pageCount}` : "–"}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Verkleinern" disabled={zoom === 0} onClick={() => setZoom(zoom - 1)}>
            <ZoomOutIcon />
          </Button>
          <button
            type="button"
            onClick={() => setZoom(2)}
            className="w-12 text-center font-mono text-sm text-muted-foreground hover:text-foreground"
            aria-label="Auf Seitenbreite zurücksetzen"
          >
            {Math.round(zoomSteps[zoom] * 100)}%
          </button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Vergrößern"
            disabled={zoom === zoomSteps.length - 1}
            onClick={() => setZoom(zoom + 1)}
          >
            <ZoomInIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={fullscreen ? "Vollbild beenden" : "Vollbild"}
            onClick={() => setFullscreen(!fullscreen)}
          >
            {fullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
          </Button>
        </span>
      </div>

      <div ref={setScroller} className="min-h-0 flex-1 overflow-auto bg-muted">
        {width > 0 && (
          <Document
            file={url}
            // Without suspense: a page that's still loading would otherwise
            // suspend the whole viewer and reset its scroll position.
            suspense={false}
            onLoadSuccess={async (pdf) => {
              setPageCount(pdf.numPages);
              const viewport = (await pdf.getPage(1)).getViewport({ scale: 1 });
              setRatio(viewport.height / viewport.width);
            }}
            loading={<Status>PDF wird geladen …</Status>}
            error={<Status error>Das PDF konnte nicht geladen werden. Lade es herunter, um es anzusehen.</Status>}
            className="flex w-max min-w-full flex-col items-center gap-3 p-3"
          >
            {Array.from({ length: pageCount }, (_, index) => (
              <LazyPage
                key={index + 1}
                number={index + 1}
                width={pageWidth}
                ratio={ratio}
                root={scroller}
                register={(element) => {
                  if (element) pages.current.set(index + 1, element);
                  else pages.current.delete(index + 1);
                }}
                onCurrent={setCurrent}
              />
            ))}
          </Document>
        )}
      </div>
    </div>
  );
}

type PageProps = {
  number: number;
  width: number;
  ratio: number;
  root: HTMLElement | null;
  register: (element: HTMLDivElement | null) => void;
  onCurrent: (number: number) => void;
};

function LazyPage({ number, width, ratio, root, register, onCurrent }: PageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(number <= 2);

  useEffect(() => {
    const element = ref.current;
    if (!element || !root) return;
    // Rendered once it comes within a screen or so; stays rendered after that.
    const nearObserver = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setNear(true),
      { root, rootMargin: "100% 0px" },
    );
    // The page that crosses the middle of the viewer is the current one.
    const currentObserver = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && onCurrent(number),
      { root, rootMargin: "-50% 0px -50% 0px" },
    );
    nearObserver.observe(element);
    currentObserver.observe(element);
    return () => {
      nearObserver.disconnect();
      currentObserver.disconnect();
    };
  }, [root, number, onCurrent]);

  return (
    <div
      ref={(element) => {
        ref.current = element;
        register(element);
      }}
      data-page={number}
      className="scroll-mt-3 bg-white shadow-sm"
      style={{ width, minHeight: Math.round(width * ratio) }}
    >
      {near && (
        <Page
          suspense={false}
          pageNumber={number}
          width={width}
          loading={<div style={{ height: Math.round(width * ratio) }} />}
        />
      )}
    </div>
  );
}

function Status({ children, error }: { children: React.ReactNode; error?: boolean }) {
  return (
    <p className={`flex items-center gap-2 p-6 text-sm ${error ? "text-destructive" : "text-muted-foreground"}`}>
      {!error && <Loader2Icon className="size-4 animate-spin" />}
      {children}
    </p>
  );
}
