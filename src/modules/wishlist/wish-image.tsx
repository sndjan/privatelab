"use client";

import { GiftIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

// The shop's own image, linked rather than copied. Many shops refuse images
// requested with a foreign referrer, hence no-referrer; a broken or missing
// image shows a gift icon instead.
export function WishImage({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const show = src && failed !== src;

  return (
    <div className={cn("flex items-center justify-center overflow-hidden bg-white", !show && "bg-muted", className)}>
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element -- external shop images, any host
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setFailed(src)}
          className="size-full object-contain"
        />
      ) : (
        <GiftIcon aria-hidden="true" className="size-8 text-muted-foreground/60" />
      )}
    </div>
  );
}
