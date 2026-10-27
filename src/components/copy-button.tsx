"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

// Copies the given text to the clipboard and briefly shows a check mark.
export function CopyButton({ text, label, title }: { text: string; label?: string; title?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Kopieren hat nicht geklappt. Hier zum manuellen Kopieren:", text);
    }
  }

  return (
    <Button
      type="button"
      size={label ? "sm" : "icon"}
      variant={label ? "outline" : "ghost"}
      className={label ? undefined : "size-8 text-muted-foreground"}
      onClick={copy}
      title={title ?? label}
      aria-label={title ?? label}
    >
      {copied ? <CheckIcon className="text-brand" /> : <CopyIcon />}
      {label && (copied ? "Kopiert" : label)}
    </Button>
  );
}
