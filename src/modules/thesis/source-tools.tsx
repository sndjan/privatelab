"use client";

import { CheckIcon, CopyIcon, DownloadIcon } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setSourceStatus } from "./actions";
import { sourceStatuses, type SourceStatus } from "./cite";

// Copies text; with `html`, also as rich text, so the italics of an APA
// reference survive pasting into Word or Google Docs.
export function CopyText({ text, html, label }: { text: string; html?: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (html && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([text], { type: "text/plain" }),
            "text/html": new Blob([html], { type: "text/html" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Kopieren hat nicht geklappt. Hier zum manuellen Kopieren:", text);
    }
  }

  return (
    <Button type="button" size="sm" variant="outline" onClick={copy}>
      {copied ? <CheckIcon className="text-brand" /> : <CopyIcon />}
      {copied ? "Kopiert" : label}
    </Button>
  );
}

// Saves the text as a file, e.g. literatur.bib.
export function DownloadText({ text, filename, label }: { text: string; filename: string; label: string }) {
  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button type="button" size="sm" variant="outline" onClick={download}>
      <DownloadIcon /> {label}
    </Button>
  );
}

// Status of a source, saved right away.
export function StatusSelect({ id, status, label }: { id: string; status: SourceStatus; label: string }) {
  const [value, setValue] = useOptimistic(status);
  const [, startTransition] = useTransition();

  return (
    <Select
      value={value}
      onValueChange={(next) =>
        startTransition(async () => {
          setValue(next as SourceStatus);
          await setSourceStatus(id, next as SourceStatus);
        })
      }
    >
      <SelectTrigger aria-label={label} size="sm" className="w-28">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {sourceStatuses.map((entry) => (
          <SelectItem key={entry.value} value={entry.value}>
            {entry.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
