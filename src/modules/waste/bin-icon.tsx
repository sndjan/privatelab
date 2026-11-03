import { cn } from "@/lib/utils";
import type { Container } from "./bins";

// A simple drawing of where a thing goes, in the bin's colour: wheelie bin,
// bag, street container, recycling centre, hazardous waste truck or shop.
export function BinIcon({ color, container, className }: { color: string; container: Container; className?: string }) {
  const dark = "rgba(0,0,0,0.28)";
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("size-12 shrink-0", className)}>
      {container === "tonne" && (
        <>
          <rect x="12" y="10" width="40" height="8" rx="2" fill={color} />
          <rect x="12" y="10" width="40" height="8" rx="2" fill={dark} />
          <path d="M14 19h36l-3 36a3 3 0 0 1-3 3H20a3 3 0 0 1-3-3z" fill={color} />
          <path d="M24 26v24M32 26v24M40 26v24" stroke={dark} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="20" cy="58" r="4" fill="#1f2937" />
          <circle cx="44" cy="58" r="4" fill="#1f2937" />
        </>
      )}
      {container === "sack" && (
        <>
          <path d="M26 14c-2-4 1-7 6-7s8 3 6 7z" fill={color} />
          <path d="M26 14c-2-4 1-7 6-7s8 3 6 7z" fill={dark} />
          <path d="M24 15h16c9 8 13 20 11 32-1 7-7 11-19 11S14 54 13 47c-2-12 2-24 11-32z" fill={color} />
          <path d="M22 30c6 3 14 3 20 0M19 42c8 4 18 4 26 0" stroke={dark} strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      )}
      {container === "container" && (
        <>
          <path d="M8 22c0-6 5-10 11-10h26c6 0 11 4 11 10v32H8z" fill={color} />
          <circle cx="22" cy="26" r="5" fill={dark} />
          <circle cx="42" cy="26" r="5" fill={dark} />
          <rect x="8" y="50" width="48" height="6" fill={dark} />
        </>
      )}
      {container === "hof" && (
        <>
          <path d="M6 28 32 10l26 18v28H6z" fill={color} />
          <rect x="22" y="36" width="20" height="20" fill={dark} />
          <path d="M26 24a6 6 0 0 1 10-2m2 6a6 6 0 0 1-10 2" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      )}
      {container === "mobil" && (
        <>
          <rect x="4" y="20" width="36" height="28" rx="2" fill={color} />
          <path d="M40 28h10l8 10v10H40z" fill={color} />
          <path d="M40 28h10l8 10v10H40z" fill={dark} />
          <path d="M22 26 30 40H14z" fill="#fff" />
          <rect x="21" y="30" width="2" height="5" fill={color} />
          <circle cx="16" cy="50" r="5" fill="#1f2937" />
          <circle cx="48" cy="50" r="5" fill="#1f2937" />
        </>
      )}
      {container === "laden" && (
        <>
          <path d="M8 16h48l-4 12H12z" fill={color} />
          <path d="M8 16h48l-4 12H12z" fill={dark} />
          <rect x="12" y="28" width="40" height="28" fill={color} />
          <rect x="26" y="38" width="12" height="18" fill={dark} />
        </>
      )}
    </svg>
  );
}
