import { useId, type ReactNode } from "react";
import type { ThemeId } from "./data";
import { CartoonBomb, CartoonHeart, GoldenDie, Placed, StarOutline, StarSolid, type Place } from "./symbols";

// Themes swap the four main symbols of a sheet for others in the same
// cartoon look (dark outlines, hard shadows): the box (golden die), the star
// on a box (a white outline), the heart and the bomb. "original" keeps the
// symbols of symbols.tsx. Every drawing uses a 100 × 100 grid.

const HEART = "M50 88 C18 66 6 48 10 30 C14 14 34 10 50 26 C66 10 86 14 90 30 C94 48 82 66 50 88 Z";
const HEART_LIT = "M50 81 C21 61 9 46 12 31 C15 17 33 13 48 27 C62 13 80 15 84 28 C87 41 76 58 50 81 Z";
const FUSE = (
  <>
    <path d="M66 32 Q72 16 84 18" fill="none" stroke="#4a3a26" strokeWidth={6.5} strokeLinecap="round" />
    <path d="M66 32 Q72 16 84 18" fill="none" stroke="#8e7656" strokeWidth={3.5} strokeLinecap="round" />
    <polygon
      points="88,8 90.5,14 97,14.5 92,18.5 93.5,25 88,21.5 82.5,25 84,18.5 79,14.5 85.5,14"
      fill="#ffd34a"
      stroke="#c2680a"
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
  </>
);
const BLOCK_OUTLINE =
  "M14.45,37.28 L39.55,26.72 Q46,24 52.84,25.48 L85.16,32.52 Q92,34 92,41 L92,57 Q92,64 85.73,67.14 L62.27,78.86 Q56,82 49.21,80.31 L14.79,71.69 Q8,70 8,63 L8,47 Q8,40 14.45,37.28 Z";

// --- Box -------------------------------------------------------------------------

function boxDrawing(theme: ThemeId, id: string): ReactNode {
  switch (theme) {
    case "hunde":
      // A simple dog house: body with a door under one round red roof beam.
      return (
        <>
          <path d="M20 52 L50 28 L80 52 L80 87 L20 87 Z" fill="#c9955a" stroke="#4a2f17" strokeWidth={5} strokeLinejoin="round" />
          <path d="M40 87 L40 71 Q50 59 60 71 L60 87 Z" fill="#3b2a1d" />
          <path d="M12 54 L50 22 L88 54" fill="none" stroke="#4a1410" strokeWidth={17} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 54 L50 22 L88 54" fill="none" stroke="#d9534a" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "tennis":
      return (
        <>
          <clipPath id={id}>
            <rect x={27} y={20} width={46} height={70} rx={6} />
          </clipPath>
          <g clipPath={`url(#${id})`}>
            <rect x={0} y={0} width={100} height={100} fill="#eef1f5" />
            <rect x={61} y={0} width={20} height={100} fill="#cdd4dc" />
            <rect x={0} y={42} width={100} height={30} fill="#2e8f5a" />
            <rect x={61} y={42} width={20} height={30} fill="#237247" />
          </g>
          <rect x={27} y={20} width={46} height={70} rx={6} fill="none" stroke="#2b3138" strokeWidth={5} />
          <rect x={22} y={11} width={56} height={13} rx={5} fill="#e2524a" stroke="#4a1410" strokeWidth={5} />
          <rect x={62} y={13.5} width={13} height={8} fill="#bd3d36" />
        </>
      );
    case "yoga":
      return (
        <>
          <clipPath id={id}>
            <path d={BLOCK_OUTLINE} />
          </clipPath>
          <g clipPath={`url(#${id})`}>
            <path d="M-10,37 L-10,0 L110,0 L110,27 Q80,40 56,48 Q30,44 -10,37 Z" fill="#e8c793" />
            <path d="M-10,37 Q30,44 56,48 L56,100 L-10,100 Z" fill="#d4a86b" />
            <path d="M56,48 Q80,40 110,27 L110,100 L56,100 Z" fill="#b48a52" />
          </g>
          <g fill="#a87b45">
            <circle cx={22} cy={55} r={1.8} />
            <circle cx={34} cy={63} r={1.5} />
            <circle cx={44} cy={55} r={1.7} />
            <circle cx={40} cy={71} r={1.8} />
            <circle cx={40} cy={34} r={1.6} />
            <circle cx={58} cy={36} r={1.5} />
            <circle cx={72} cy={38} r={1.7} />
            <circle cx={68} cy={60} r={1.6} />
            <circle cx={80} cy={54} r={1.5} />
          </g>
          <path d={BLOCK_OUTLINE} fill="none" stroke="#5a3c1e" strokeWidth={5} strokeLinejoin="round" />
        </>
      );
    case "whisky":
      return (
        <>
          <clipPath id={id}>
            <path d="M27 12 Q18 50 27 88 L73 88 Q82 50 73 12 Z" />
          </clipPath>
          <g clipPath={`url(#${id})`}>
            <rect x={0} y={0} width={100} height={100} fill="#b5743d" />
            <rect x={62} y={0} width={30} height={100} fill="#925a2a" />
            <path d="M38 12 Q34 50 38 88 M50 10 L50 90 M62 12 Q66 50 62 88" fill="none" stroke="#7a4a20" strokeWidth={2} />
            <rect x={0} y={24} width={100} height={8} fill="#4b4f55" />
            <rect x={0} y={68} width={100} height={8} fill="#4b4f55" />
            <rect x={62} y={24} width={30} height={8} fill="#383b40" />
            <rect x={62} y={68} width={30} height={8} fill="#383b40" />
          </g>
          <path d="M27 12 Q18 50 27 88 L73 88 Q82 50 73 12 Z" fill="none" stroke="#4a2a12" strokeWidth={5} strokeLinejoin="round" />
          <circle cx={50} cy={50} r={4} fill="#3b2410" stroke="#4a2a12" strokeWidth={2} />
        </>
      );
    default:
      return null;
  }
}

// The box: golden die, dog house, ball can, yoga block or barrel; ringed for
// the special die that is free at the start.
export function ThemedBox({ theme, ringed, ...place }: Place & { theme: ThemeId; ringed?: boolean }) {
  const id = useId();
  if (theme === "original" || theme === "eigenes") return <GoldenDie {...place} ringed={ringed} />;
  const drawing = boxDrawing(theme, id);
  return (
    <Placed {...place}>
      {ringed ? (
        <>
          <circle cx={50} cy={50} r={47} fill="none" stroke="#7d7d7d" strokeWidth={4.5} />
          <g transform="translate(15 15) scale(0.7)">{drawing}</g>
        </>
      ) : (
        <g transform="translate(5 5) scale(0.9)">{drawing}</g>
      )}
    </Placed>
  );
}

// --- Star (a white outline on a box) ------------------------------------------------

function starDrawing(theme: ThemeId): ReactNode {
  switch (theme) {
    case "hunde":
      return (
        <>
          <path d="M50 52 C37 52 27 65 30 75 C33 84 42 81 50 81 C58 81 67 84 70 75 C73 65 63 52 50 52 Z" />
          <ellipse cx={25} cy={47} rx={7} ry={9.5} transform="rotate(-22 25 47)" />
          <ellipse cx={40} cy={31} rx={7} ry={10} />
          <ellipse cx={60} cy={31} rx={7} ry={10} />
          <ellipse cx={75} cy={47} rx={7} ry={9.5} transform="rotate(22 75 47)" />
        </>
      );
    case "tennis":
      return (
        <>
          <circle cx={50} cy={50} r={36} />
          <path d="M24 26 Q43 50 24 74" />
          <path d="M76 26 Q57 50 76 74" />
        </>
      );
    case "yoga":
      return (
        <>
          <path d="M50 18 Q64 42 50 68 Q36 42 50 18 Z" />
          <path d="M50 68 Q26 64 18 38 Q40 40 50 68" />
          <path d="M50 68 Q74 64 82 38 Q60 40 50 68" />
          <path d="M20 74 Q50 86 80 74" />
        </>
      );
    case "whisky":
      return (
        <>
          <path d="M18 36 L50 21 L82 34 L82 66 L52 81 L18 68 Z" />
          <path d="M18 36 L52 47 L82 34 M52 47 L52 81" />
        </>
      );
    default:
      return null;
  }
}

export function ThemedStar({
  theme,
  edge = "#ffffff",
  solid,
  ...place
}: Place & { theme: ThemeId; edge?: string; solid?: boolean }) {
  if (theme === "original" || theme === "eigenes") return solid ? <StarSolid {...place} edge={edge} /> : <StarOutline {...place} edge={edge} />;
  return (
    <Placed {...place}>
      <g fill="none" stroke={edge} strokeWidth={solid ? 7.5 : 7} strokeLinejoin="round" strokeLinecap="round">
        {/* Paws and tennis balls a little turned, so they look less stiff. */}
        <g transform={theme === "hunde" || theme === "tennis" ? "rotate(-25 50 50)" : undefined}>{starDrawing(theme)}</g>
      </g>
    </Placed>
  );
}

// --- Heart ------------------------------------------------------------------------

const BONE_PARTS = (
  <>
    <rect x={24} y={40} width={52} height={22} />
    <circle cx={22} cy={40} r={12} />
    <circle cx={22} cy={62} r={12} />
    <circle cx={78} cy={40} r={12} />
    <circle cx={78} cy={62} r={12} />
  </>
);

// A heart in the theme's colours with a hard shadow, or pale for the heart row.
function ColouredHeart({ id, fill, shade, ink, pale, strings }: { id: string; fill: string; shade: string; ink: string; pale?: [string, string]; strings?: boolean }) {
  if (pale) {
    return (
      <>
        <path d={HEART} fill={pale[0]} stroke={pale[1]} strokeWidth={6} strokeLinejoin="round" />
        {strings && (
          <>
            <clipPath id={id}>
              <path d={HEART} />
            </clipPath>
            <path
              clipPath={`url(#${id})`}
              d="M30 0 V100 M42 0 V100 M54 0 V100 M66 0 V100 M0 32 H100 M0 44 H100 M0 56 H100 M0 68 H100"
              stroke={pale[1]}
              strokeWidth={2}
              opacity={0.6}
            />
          </>
        )}
      </>
    );
  }
  return (
    <>
      <path d={HEART} fill={shade} />
      <path d={HEART_LIT} fill={fill} />
      {strings && (
        <>
          <clipPath id={id}>
            <path d={HEART_LIT} />
          </clipPath>
          <path
            clipPath={`url(#${id})`}
            d="M26 0 V100 M36 0 V100 M46 0 V100 M56 0 V100 M66 0 V100 M76 0 V100 M0 28 H100 M0 38 H100 M0 48 H100 M0 58 H100 M0 68 H100"
            stroke="#ffffff"
            strokeOpacity={0.55}
            strokeWidth={2}
          />
        </>
      )}
      <path d={HEART} fill="none" stroke={ink} strokeWidth={5} strokeLinejoin="round" />
    </>
  );
}

export function ThemedHeart({ theme, pale, ...place }: Place & { theme: ThemeId; pale?: boolean }) {
  const id = useId();
  if (theme === "original" || theme === "eigenes") return <CartoonHeart {...place} pale={pale} />;
  let drawing: ReactNode = null;
  if (theme === "hunde") {
    drawing = pale ? (
      <g fill="#f1e7d3" stroke="#cbb894" strokeWidth={6}>
        <g strokeWidth={12}>{BONE_PARTS}</g>
        <g stroke="none">{BONE_PARTS}</g>
      </g>
    ) : (
      <>
        <clipPath id={id}>{BONE_PARTS}</clipPath>
        <g fill="#4a3418" stroke="#4a3418" strokeWidth={10}>
          {BONE_PARTS}
        </g>
        <g clipPath={`url(#${id})`}>
          <rect x={0} y={0} width={100} height={100} fill="#d6bf92" />
          <g fill="#f3e6c8" transform="translate(-1.5 -3)">
            {BONE_PARTS}
          </g>
        </g>
      </>
    );
  }
  if (theme === "tennis")
    drawing = <ColouredHeart id={id} fill="#cf544a" shade="#b7433a" ink="#5b1912" pale={pale ? ["#e8c5b2", "#c9a090"] : undefined} strings />;
  if (theme === "yoga") drawing = <ColouredHeart id={id} fill="#e46a9a" shade="#c24f7c" ink="#5e1a35" pale={pale ? ["#f4c9d9", "#d79ab3"] : undefined} />;
  if (theme === "whisky")
    drawing = (
      <>
        <ColouredHeart id={id} fill="#d98a1e" shade="#a8600c" ink="#5a2e06" pale={pale ? ["#f1d7ae", "#d0a868"] : undefined} />
        {!pale && <path d="M18 34 C22 24 32 22 40 28" fill="none" stroke="#f7c56a" strokeWidth={5} strokeLinecap="round" />}
      </>
    );
  return <Placed {...place}>{drawing}</Placed>;
}

// --- Bomb -------------------------------------------------------------------------

export function ThemedBomb({ theme, ...place }: Place & { theme: ThemeId }) {
  const id = useId();
  if (theme === "original" || theme === "eigenes") return <CartoonBomb {...place} />;
  let drawing: ReactNode = null;
  if (theme === "hunde")
    drawing = (
      <>
        {FUSE}
        <clipPath id={id}>
          <circle cx={46} cy={60} r={32} />
        </clipPath>
        <g clipPath={`url(#${id})`}>
          <circle cx={46} cy={60} r={32} fill="#b8322c" />
          <circle cx={41} cy={55} r={29} fill="#e04a40" />
          <path d="M10 52 Q46 70 82 52 L82 63 Q46 81 10 63 Z" fill="#ffd34a" />
          <path d="M10 63 Q46 81 82 63 L82 67 Q46 85 10 67 Z" fill="#d9a82a" />
        </g>
        <circle cx={46} cy={60} r={32} fill="none" stroke="#4a1410" strokeWidth={5} />
        <ellipse cx={33} cy={44} rx={7.5} ry={5} transform="rotate(-25 33 44)" fill="#ff9a8f" />
      </>
    );
  if (theme === "tennis")
    drawing = (
      <>
        {FUSE}
        <clipPath id={id}>
          <circle cx={46} cy={60} r={32} />
        </clipPath>
        <g clipPath={`url(#${id})`}>
          <circle cx={46} cy={60} r={32} fill="#a9b92c" />
          <circle cx={41} cy={55} r={29} fill="#d4e64a" />
          <path d="M18 36 Q38 60 18 84 M74 36 Q54 60 74 84" fill="none" stroke="#ffffff" strokeWidth={4.5} />
        </g>
        <circle cx={46} cy={60} r={32} fill="none" stroke="#3c4416" strokeWidth={5} />
        <ellipse cx={34} cy={44} rx={6.5} ry={4.5} transform="rotate(-25 34 44)" fill="#f1fa9e" />
      </>
    );
  if (theme === "yoga")
    drawing = (
      <>
        <path d="M30 30 Q50 18 70 30 M36 20 Q50 12 64 20" fill="none" stroke="#8a5e1c" strokeWidth={3.5} strokeLinecap="round" />
        <clipPath id={id}>
          <path d="M12 52 L88 52 Q86 88 50 90 Q14 88 12 52 Z" />
        </clipPath>
        <g clipPath={`url(#${id})`}>
          <rect x={0} y={0} width={100} height={100} fill="#b07a22" />
          <path d="M8 52 L80 52 Q78 82 46 86 Q14 82 8 52 Z" fill="#dba545" />
        </g>
        <path d="M12 52 L88 52 Q86 88 50 90 Q14 88 12 52 Z" fill="none" stroke="#4a3410" strokeWidth={5} strokeLinejoin="round" />
        <ellipse cx={50} cy={52} rx={38} ry={8} fill="#6e4a14" stroke="#4a3410" strokeWidth={5} />
        <path d="M66 78 L90 44" stroke="#4a2a12" strokeWidth={10} strokeLinecap="round" />
        <path d="M66 78 L90 44" stroke="#b97a42" strokeWidth={5} strokeLinecap="round" />
        <ellipse cx={28} cy={64} rx={5} ry={3} transform="rotate(-20 28 64)" fill="#f3cf7d" />
      </>
    );
  if (theme === "whisky")
    drawing = (
      <>
        <clipPath id={id}>
          <path d="M41 20 L59 20 L59 34 Q74 40 74 56 L74 87 Q74 91 70 91 L30 91 Q26 91 26 87 L26 56 Q26 40 41 34 Z" />
        </clipPath>
        <g clipPath={`url(#${id})`}>
          <rect x={0} y={0} width={100} height={100} fill="#c06c1c" />
          <rect x={60} y={0} width={20} height={100} fill="#9b5212" />
          <rect x={30} y={20} width={6} height={70} fill="#e09a48" />
        </g>
        <path
          d="M41 20 L59 20 L59 34 Q74 40 74 56 L74 87 Q74 91 70 91 L30 91 Q26 91 26 87 L26 56 Q26 40 41 34 Z"
          fill="none"
          stroke="#3e1f08"
          strokeWidth={5}
          strokeLinejoin="round"
        />
        <rect x={40} y={7} width={20} height={14} rx={3} fill="#c9955a" stroke="#3e1f08" strokeWidth={4.5} />
        <rect x={31} y={56} width={38} height={24} rx={3} fill="#f3e6c8" stroke="#3e1f08" strokeWidth={3.5} />
        <path d="M37 64 H63 M40 71 H60" stroke="#9b5212" strokeWidth={3} strokeLinecap="round" />
      </>
    );
  return <Placed {...place}>{drawing}</Placed>;
}
