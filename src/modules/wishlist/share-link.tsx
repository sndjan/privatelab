"use client";

import { ExternalLinkIcon, Share2Icon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";

const subscribe = () => () => {};

// The public link with this site's address, plus the phone's share sheet.
export function ShareLink({ token, title }: { token: string; title: string }) {
  const origin = useSyncExternalStore(subscribe, () => window.location.origin, () => "");
  const canShare = useSyncExternalStore(subscribe, () => typeof navigator.share === "function", () => false);
  const url = `${origin}/w/${token}`;

  return (
    <div className="space-y-2">
      <p className="truncate rounded-md bg-muted px-3 py-2 font-mono text-xs">{url}</p>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={url} label="Link kopieren" />
        {canShare && (
          <Button size="sm" variant="outline" onClick={() => navigator.share({ title, url }).catch(() => {})}>
            <Share2Icon /> Teilen
          </Button>
        )}
        <Button asChild size="sm" variant="ghost" className="text-muted-foreground">
          <a href={`/w/${token}`} target="_blank" rel="noreferrer">
            <ExternalLinkIcon /> Ansehen
          </a>
        </Button>
      </div>
    </div>
  );
}
