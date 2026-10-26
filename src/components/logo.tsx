import { cn } from "@/lib/utils";

// The app icon's Erlenmeyer flask: glass in the text color, liquid in the brand color.
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-6", className)}>
      <path d="M8.6 14 Q10.3 12.8 12 14 T15.4 14 L19 19.6 H5 Z" fill="var(--brand)" />
      <path
        d="M9.6 2.6 V9.6 L2.7 20 Q1.9 21.6 3.6 21.6 H20.4 Q22.1 21.6 21.3 20 L14.4 9.6 V2.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M7.8 2.4 H16.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
