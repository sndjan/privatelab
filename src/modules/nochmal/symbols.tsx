import { useId, type ReactNode } from "react";

// The cartoon symbols of the sheet (golden die, stars, hearts, bomb, jokers,
// diamond, the start column's coins), drawn like the reference picture:
// dark outlines and hard shadows instead of gradients. Each is drawn on a
// 100 × 100 grid and placed by its centre and size in sheet units.

export type Place = { cx: number; cy: number; size: number };

export function Placed({ cx, cy, size, children }: Place & { children: ReactNode }) {
  return (
    <g transform={`translate(${cx - size / 2} ${cy - size / 2}) scale(${size / 100})`} pointerEvents="none">
      {children}
    </g>
  );
}

export const STAR_POINTS = "50,8 62.93,36.2 93.75,39.79 70.92,60.8 77.04,91.21 50,76 22.96,91.21 29.08,60.8 6.25,39.79 37.07,36.2";
const CUBE_OUTLINE =
  "M19.05,25.71 L38.95,16.29 Q48,12 57.48,15.16 L80.52,22.84 Q90,26 89.57,36 L88.43,62 Q88,72 79.15,76.65 L58.85,87.35 Q50,92 40.95,87.71 L21.05,78.29 Q12,74 11.55,64 L10.45,40 Q10,30 19.05,25.71 Z";
const HEART = "M50 88 C18 66 6 48 10 30 C14 14 34 10 50 26 C66 10 86 14 90 30 C94 48 82 66 50 88 Z";

// The golden die: a rounded box with a light top, a lighter left and a dark
// right side; ringed, the special die that is free at the start.
export function GoldenDie({ ringed, ...place }: Place & { ringed?: boolean }) {
  const clip = useId();
  const cube = (
    <>
      <clipPath id={clip}>
        <path d={CUBE_OUTLINE} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <path d="M-1.4,25.8 L48,-10 L102.6,20.6 Q75,34 48,44 Q22,38 -1.4,25.8 Z" fill="#cba878" />
        <path d="M-1.4,25.8 Q22,38 48,44 L50.5,104 L-10,104 Z" fill="#ac8a5e" />
        <path d="M48,44 Q75,34 102.6,20.6 L110,104 L50.5,104 Z" fill="#8f7350" />
      </g>
      <path d={CUBE_OUTLINE} fill="none" stroke="#5a3c1e" strokeWidth={ringed ? 7 : 5.5} strokeLinejoin="round" />
    </>
  );
  return (
    <Placed {...place}>
      {ringed ? (
        <>
          <circle cx={50} cy={50} r={47} fill="none" stroke="#7d7d7d" strokeWidth={4.5} />
          <g transform="translate(14 14) scale(0.72)">{cube}</g>
        </>
      ) : (
        cube
      )}
    </Placed>
  );
}

// A star on a box: only a white outline, the box's colour shows through
// (grey on a box without a colour yet).
export function StarOutline({ edge = "#ffffff", ...place }: Place & { edge?: string }) {
  return (
    <Placed {...place}>
      <polygon points={STAR_POINTS} fill="none" stroke={edge} strokeWidth={7} strokeLinejoin="round" />
    </Placed>
  );
}

// The star of the final score: plain white (outlined on a light card).
export function StarSolid({ edge = "#ffffff", ...place }: Place & { edge?: string }) {
  return (
    <Placed {...place}>
      <polygon points={STAR_POINTS} fill="#ffffff" stroke={edge} strokeWidth={edge === "#ffffff" ? 4 : 6} strokeLinejoin="round" />
    </Placed>
  );
}

// Red heart with a hard shadow; pale for the heart row under the columns.
export function CartoonHeart({ pale, ...place }: Place & { pale?: boolean }) {
  return (
    <Placed {...place}>
      {pale ? (
        <path d={HEART} fill="#e8c5b2" stroke="#c9a090" strokeWidth={6} strokeLinejoin="round" />
      ) : (
        <>
          <path d={HEART} fill="#b7433a" />
          <path d="M50 81 C21 61 9 46 12 31 C15 17 33 13 48 27 C62 13 80 15 84 28 C87 41 76 58 50 81 Z" fill="#cf544a" />
          <path d={HEART} fill="none" stroke="#5b1912" strokeWidth={5} strokeLinejoin="round" />
        </>
      )}
    </Placed>
  );
}

export function CartoonBomb(place: Place) {
  const clip = useId();
  return (
    <Placed {...place}>
      <clipPath id={clip}>
        <circle cx={44} cy={60} r={34} />
      </clipPath>
      <path d="M70 24 Q76 10 84 14 T96 4" fill="none" stroke="#4a3a26" strokeWidth={6.5} strokeLinecap="round" />
      <path d="M70 24 Q76 10 84 14 T96 4" fill="none" stroke="#8e7656" strokeWidth={3.5} strokeLinecap="round" />
      <rect x={58} y={22} width={17} height={14} rx={2.5} transform="rotate(38 66.5 29)" fill="#3d4248" stroke="#1e2126" strokeWidth={4.5} />
      <g clipPath={`url(#${clip})`}>
        <circle cx={44} cy={60} r={34} fill="#343a41" />
        <circle cx={39} cy={55} r={31} fill="#4f5862" />
      </g>
      <circle cx={44} cy={60} r={34} fill="none" stroke="#1e2126" strokeWidth={5} />
      <ellipse cx={31} cy={44} rx={8.5} ry={6} transform="rotate(-25 31 44)" fill="#7a838d" />
    </Placed>
  );
}

// A gem with hard light-blue facets.
export function CartoonDiamond(place: Place) {
  return (
    <Placed {...place}>
      <path d="M28 20 L50 40 L8 40 Z" fill="#d4effa" />
      <path d="M28 20 L72 20 L50 40 Z" fill="#f2fbff" />
      <path d="M72 20 L92 40 L50 40 Z" fill="#a9dcf0" />
      <path d="M8 40 L50 40 L50 90 Z" fill="#bfe6f6" />
      <path d="M50 40 L92 40 L50 90 Z" fill="#83c1de" />
      <path d="M28 20 L50 40 L72 20 M8 40 L92 40 M50 40 L50 90" fill="none" stroke="#2f5d73" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      <path d="M19 37 L28 27" fill="none" stroke="#ffffff" strokeWidth={4} strokeLinecap="round" />
      <path d="M28 20 L72 20 L92 40 L50 90 L8 40 Z" fill="none" stroke="#2f5d73" strokeWidth={5.5} strokeLinejoin="round" />
    </Placed>
  );
}

// The dark joker tiles: "?" for any number, "X" for any colour.
export function JokerTile({ kind, ...place }: Place & { kind: "number" | "color" }) {
  return (
    <Placed {...place}>
      <rect x={5} y={5} width={90} height={90} rx={18} fill="#484848" stroke="#2b2b2b" strokeWidth={5} />
      {kind === "number" ? (
        <>
          <path
            d="M35 37 C35 24 44 19 51 19 C61 19 67 26 67 34 C67 43 59 46 55 49 C52 52 51 55 51 61"
            fill="none"
            stroke="#ffffff"
            strokeWidth={13}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={51} cy={79} r={7.5} fill="#ffffff" />
        </>
      ) : (
        <path d="M28 28 L72 72 M72 28 L28 72" fill="none" stroke="#ffffff" strokeWidth={17} />
      )}
    </Placed>
  );
}

// A joker to strike off, like the original: a thin ring with nothing
// inside, a slanted "!" wedge (wide at the top) and its dot a little to
// the left. ink: dark on the light joker bar, light on a dark card.
export function JokerMark({ ink = "#2c2e3a", ...place }: Place & { ink?: string }) {
  return (
    <Placed {...place}>
      <circle cx={50} cy={50} r={44} fill="none" stroke={ink} strokeWidth={5} />
      <path d="M37 19 L66 19 Q69 19 68 22 L54.5 58.5 Q53.8 61 51.3 61 L44.5 61 Q42 61 41.7 58.6 L34.4 22 Q34 19 37 19 Z" fill={ink} />
      <circle cx={46.5} cy={76.5} r={8.3} fill={ink} />
    </Placed>
  );
}

// The red coin behind the start column's points.
export function Coin({ value, ...place }: Place & { value?: ReactNode }) {
  return (
    <Placed {...place}>
      <circle cx={50} cy={50} r={46} fill="#cd5648" stroke="#9f3a33" strokeWidth={4} />
      <circle cx={50} cy={50} r={34} fill="#f4ddd8" stroke="#b2443c" strokeWidth={4} />
      {value !== undefined && (
        <text
          x={50}
          y={53}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={56}
          fill="#d65a4c"
          stroke="#8f2e28"
          strokeWidth={3.5}
          paintOrder="stroke"
        >
          {value}
        </text>
      )}
    </Placed>
  );
}
