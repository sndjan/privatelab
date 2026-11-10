// What a kitchen scene looks like at one moment. A scene is a few fixed
// drawings (board, pan, pot ...) plus lists of small pieces laid out in
// percent of the square; `progress` (0-1) is how far the step is. The same
// scene and progress always give the same picture, so the timer can be
// resumed anywhere.

export const sceneIds = [
  "tomaten", "marinieren", "roesten", "bruschetta", "zucchini", "grillen", "antipasti",
  "pilze", "pilzeBraten", "reis", "bruehe", "risotto",
  "plattieren", "saltimbocca", "sosse", "creme", "schichten", "kakao",
  "tisch", "tee",
] as const;
export type SceneId = (typeof sceneIds)[number];

export type Piece = {
  x: string; y: string; w: string; h: string;
  c: string; rad: string; r: number; sh: string; a: string; cl: string;
  o: number | string; k: number;
};
export type Bubble = { x: string; y: string; s: string; c: string; dur: string; del: string };

type Part =
  | "brett" | "brettDetail" | "pfanne" | "grill" | "topf" | "schale" | "teller" | "form" | "tisch" | "tasse"
  | "loeffel" | "wender" | "besen" | "messer" | "hammer" | "sieb" | "kelle" | "glanz" | "dampf";

// A piece before it is rounded to strings. `on: false` hides it (it fades and shrinks to k0).
type Q = {
  x: number; y: number; w: number; h?: number;
  c: string; rad?: string; r?: number; sh?: string; a?: string; cl?: string;
  o?: number | string; k?: number; k0?: number; on?: boolean; flat?: boolean;
};

type SliceJob = {
  list: Piece[]; cx: number; cy: number; W: number; H: number; n: number; cut: number;
  skin: string; face: string; rad: string;
  hOf: (x: number) => number;
  fallAfter: number; fallAll: boolean;
  fallTo: (i: number, h: number) => Q;
};

// Deterministic random numbers: the same scene always lays its pieces out the same way.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mixHex(a: string, b: string, t: number) {
  const k = Math.min(1, Math.max(0, t));
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * k));
  return "#" + out.map((n) => n.toString(16).padStart(2, "0")).join("");
}

// Background colour of a scene, also used for the page around it.
export function sceneBackground(kind: SceneId, progress: number) {
  const BG: Partial<Record<SceneId, string>> = {
    marinieren: "#f3e0e0", roesten: "#f7e3d4", zucchini: "#e3eee5", grillen: "#ebe8e2", antipasti: "#f5eecf",
    pilzeBraten: "#ebe8e2", reis: "#f5eecf", bruehe: "#f5eecf", risotto: "#f5eecf", plattieren: "#f3e0e0",
    saltimbocca: "#f7e3d4", sosse: "#f7e3d4", creme: "#f5eecf", schichten: "#dfe9ef", tee: "#e3eee5",
  };
  if (kind === "kakao") return progress > 0.88 ? "#dfe9ef" : "#ebe8e2";
  return BG[kind] ?? "#f2ebde";
}

export function buildScene(kind: SceneId, progress: number) {
const p = Math.min(1, Math.max(0, progress));
  const cl = (x: number) => Math.min(1, Math.max(0, x));
  const seg = (a: number, b: number) => cl((p - a) / (b - a));
  const segOf = (v: number, a: number, b: number) => cl((v - a) / (b - a));
  const mix = mixHex;
  let seed = 11;
  for (const ch of kind) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rand = rng(seed);
  const T0 = "rgba(0, 0, 0, 0)";

  const pieces: Piece[] = [], pools: Piece[] = [], tops: Piece[] = [];
  const bubbles: Bubble[] = [];
  const put = (list: Piece[], q: Q) => {
    let c = q.c;
    let sh = q.sh || "0 0.5px 1px rgba(28, 43, 34, 0.25)";
    // A soft light from the top left on every piece that is not marked flat.
    if (!q.flat) {
      c = "radial-gradient(circle at 32% 26%, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0) 58%), " + c;
      if (!q.sh) sh = "0 0.8px 1.5px rgba(28, 43, 34, 0.28)";
    }
    list.push({
      x: q.x.toFixed(2), y: q.y.toFixed(2), w: Math.max(0, q.w).toFixed(2), h: Math.max(0, q.h ?? q.w).toFixed(2),
      c, rad: q.rad || "22%", r: Math.round(q.r || 0), sh,
      a: q.a || "none",
      cl: q.cl || "0% 0% 0% 0%",
      o: q.on === false ? 0 : (q.o ?? 1),
      k: q.on === false ? (q.k0 ?? 0.3) : (q.k ?? 1),
    });
  };
  const disc = (cx: number, cy: number, R: number): [number, number] => {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * R;
    return [cx + Math.cos(a) * d, cy + Math.sin(a) * d];
  };
  const bub = (n: number, cx: number, cy: number, R: number, c: string, s0: number, s1: number) => {
    for (let i = 0; i < n; i++) {
      const [x, y] = disc(cx, cy, R);
      bubbles.push({ x: x.toFixed(2), y: y.toFixed(2), s: (s0 + rand() * (s1 - s0)).toFixed(2), c, dur: (2.6 + rand() * 2).toFixed(2), del: (rand() * 3).toFixed(2) });
    }
  };

  // ---------- Ingredients, reused by the cooking scenes and by the table at the end ----------
  const BREAD = (toast: number) => mix("#f1e2bf", "#d49852", toast);
  const bread = (list: Piece[], x: number, y: number, w: number, h: number, r: number, toast: number, stripes: number, on: boolean) => {
    const a = (0.55 * stripes).toFixed(2);
    put(list, { x, y, w, h, r, on, c: "repeating-linear-gradient(-28deg, " + T0 + " 0 15%, rgba(96, 52, 20, " + a + ") 15% 21%), radial-gradient(ellipse at 50% 50%, " + mix("#fbf1d8", "#e7b874", toast) + " 0 45%, " + T0 + " 75%), " + BREAD(toast), rad: "46% 54% 50% 48% / 52% 48% 52% 48%", sh: "inset 0 0 0 1px rgba(170, 110, 45, 0.45), 0 0.6px 1.2px rgba(28, 43, 34, 0.22)" });
  };
  const DICE = ["#d8432c", "#e0553a", "#c93a25", "#ea6a4c"];
  const topping = (list: Piece[], x: number, y: number, w: number, h: number, frac: number, leaf: boolean) => {
    for (let i = 0; i < 10; i++) {
      const a = rand() * Math.PI * 2, d = Math.sqrt(rand());
      put(list, { x: x + Math.cos(a) * d * w * 0.3, y: y + Math.sin(a) * d * h * 0.28, w: w * 0.12, c: DICE[i % 4], rad: "28%", r: rand() * 90, on: frac >= (i + 1) / 10 });
    }
    if (leaf) put(list, { x: x + w * 0.08, y: y - h * 0.08, w: w * 0.26, h: w * 0.13, c: "#3f8a4d", rad: "80% 0", r: -30, on: frac >= 1 });
  };
  const zucRound = (list: Piece[], x: number, y: number, d: number, grill: number, on: boolean, r?: number) => {
    const a = (0.6 * grill).toFixed(2);
    put(list, { x, y, w: d, r: r ?? 0, on, c: "repeating-linear-gradient(35deg, " + T0 + " 0 17%, rgba(70, 58, 30, " + a + ") 17% 25%), radial-gradient(circle, " + mix("#f4f1cf", "#ecd58c", grill) + " 0 47%, " + mix("#dfe5a6", "#cfc073", grill) + " 48% 62%, #9cb867 63% 69%, #46703a 70%)", rad: "50%" });
  };
  const shroom = (list: Piece[], x: number, y: number, w: number, brown: number, r: number, on: boolean) => {
    put(list, { x, y, w, h: w * 0.82, r, on, c: "linear-gradient(90deg, " + T0 + " 0 37%, " + mix("#f8f1e2", "#e8c48a", brown) + " 37% 63%, " + T0 + " 63%) center bottom / 100% 46% no-repeat, " + mix("#ece0c8", "#c48a46", brown), rad: "50% 50% 22% 22% / 64% 64% 36% 36%" });
  };
  const escalope = (list: Piece[], x: number, y: number, w: number, h: number, r: number, brown: number, ham: number, sage: number, pick: number) => {
    put(list, { x, y, w, h, r, c: mix("#eaa99b", "#c98a5c", brown), rad: "48% 52% 46% 54% / 55% 45% 55% 45%", sh: "inset 0 0 0 " + (0.4 + brown).toFixed(2) + "px rgba(140, 80, 40, 0.5), 0 0.6px 1.2px rgba(28, 43, 34, 0.22)" });
    put(list, { x: x + w * 0.02, y, w: w * 0.86, h: h * 0.78, r: r + 4, on: ham > 0, k: 0.94, c: "linear-gradient(" + (110 + r) + "deg, " + T0 + " 0 36%, rgba(248, 232, 226, 0.95) 36% 44%, " + T0 + " 44% 70%, rgba(248, 232, 226, 0.8) 70% 74%, " + T0 + " 74%), " + mix("#d97b7b", "#b85a4c", brown * 0.8), rad: "46% 54% 50% 50% / 55% 45% 55% 45%" });
    put(list, { x: x - w * 0.05, y: y - h * 0.05, w: w * 0.42, h: w * 0.2, r: r - 24, on: sage > 0, c: mix("#8aa77f", "#566f4a", brown), rad: "80% 0" });
    put(list, { x, y, w: w * 0.56, h: 0.8, r: r + 32, on: pick > 0, c: "#e9d3a8", rad: "999px", sh: "none" });
  };
  const mound = (list: Piece[], x: number, y: number, w: number, glaze: number) => {
    put(list, { x, y, w, h: w * 0.94, c: "radial-gradient(circle at 44% 38%, #fbf3dc 0 26%, " + mix("#f1e2b8", "#f3e4bb", glaze) + " 70%)", rad: "48% 52% 50% 47%", sh: "0 1px 2px rgba(28, 43, 34, 0.14)" });
    for (let i = 0; i < Math.round(w * 1.1); i++) {
      const [gx, gy] = disc(x, y, w * 0.42);
      put(list === pools ? pieces : tops, { x: gx, y: gy, w: 1.9, h: 1.1, c: "#fbf6e8", rad: "50%", r: rand() * 180, sh: "none", o: 0.85, flat: true });
    }
  };

  // Cuts a shape from right to left. Every slice is the whole shape, clipped to its strip.
  // The knife sits exactly on the cut line.
  const slicer = (o: SliceJob) => {
    const L = o.cx - o.W / 2, R = o.cx + o.W / 2, sw = o.W / o.n;
    const cutX = R - o.cut * o.W;
    const strip = (a: number) => ((a - L) / o.W * 100).toFixed(2) + "%";
    const clipOf = (a: number, b: number) => "0% " + ((R - b) / o.W * 100).toFixed(2) + "% 0% " + strip(a);
    put(o.list, { x: o.cx, y: o.cy, w: o.W, h: o.H, c: o.skin, rad: o.rad, cl: clipOf(L, Math.max(L, cutX)), on: cutX > L + 0.3 });
    for (let i = o.n - 1; i >= 0; i--) {
      const a = L + i * sw, b = a + sw, xc = a + sw / 2;
      const cut = a >= cutX - 0.05;
      const fall = cut && (xc - cutX > o.fallAfter * sw || o.fallAll);
      if (fall) {
        const f = o.fallTo(i, o.hOf(xc));
        put(o.list, f);
      } else {
        put(o.list, { x: o.cx + (cut ? 0.8 + (xc - cutX) * 0.05 : 0), y: o.cy, w: o.W, h: o.H, c: o.skin, rad: o.rad, cl: clipOf(a, b), on: cut, k0: 1, sh: "inset 0.8px 0 0 " + o.face + ", 0 0.5px 1px rgba(28, 43, 34, 0.25)" });
      }
    }
    return cutX;
  };

  const s: Partial<Record<Part, boolean>> = {};
  let bg = "#f2ebde", content = "#e9dcbf", veil = "#e9dcbf", veilO = 0.55;
  let steamO: number | string = 1;
  let tea = "#f4e6b5", kelleO = 0, bagIn = 0, bagOut = 0;
  let teaO: number | string = 1, level: number | string = 1, stain: number | string = 0;
  let knife: { l: number | string; t: number | string } = { l: 76, t: 18 };
  let tool: { l: number | string; t: number | string; o: number } = { l: 80, t: 60, o: 1 };
  let steam = ["M34 36c-3-4 3-6 0-10", "M46 30c-3-4 3-6 0-10", "M40 62c-3-4 3-6 0-10"];
  const knifeAt = (x: number, y: number) => { knife = { l: (x - 6).toFixed(2), t: (y - 17).toFixed(2) }; };
  const knifeRest = () => knifeAt(86, 40);

  const LABEL: Record<SceneId, string> = {
    tomaten: "Schneidebrett, eine Tomate wird in Scheiben und dann in Würfel geschnitten",
    marinieren: "Schüssel mit Tomatenwürfeln, Knoblauch, Basilikum und Olivenöl",
    roesten: "Grillpfanne mit vier Scheiben Ciabatta, die golden werden",
    bruschetta: "Geröstetes Brot auf dem Brett, Tomaten kommen darauf",
    zucchini: "Eine Zucchini wird in Scheiben geschnitten",
    grillen: "Zucchinischeiben bekommen Streifen in der Grillpfanne",
    antipasti: "Teller mit Bruschetta und gegrillter Zucchini",
    pilze: "Champignons werden auf dem Brett in Scheiben geschnitten",
    pilzeBraten: "Pilze braten golden in der Pfanne",
    reis: "Topf mit Schalotte und Reis, Weißwein kommt dazu",
    bruehe: "Risotto im Topf, Kelle für Kelle kommt Brühe dazu",
    risotto: "Pilzrisotto auf dem Teller mit Parmesan",
    plattieren: "Kalbsschnitzel werden flach geklopft und belegt",
    saltimbocca: "Saltimbocca braten in Butter",
    sosse: "Weißwein in der Pfanne kocht zu einer Soße ein",
    creme: "Mascarponecreme wird in der Schüssel aufgeschlagen",
    schichten: "Tiramisu wird in der Form geschichtet",
    kakao: "Kakao wird über das Tiramisu gesiebt",
    tisch: "Der gedeckte Tisch mit allen drei Gängen",
    tee: "Teetasse von oben: aufgießen, ziehen lassen, trinken",
  };

  if (kind === "tomaten") {
    s.brett = s.messer = true;
    const tomSkin = "radial-gradient(20% 5% at 50% 50%, #4f7f35 98%, " + T0 + " 100%), radial-gradient(5% 20% at 50% 50%, #4f7f35 98%, " + T0 + " 100%), radial-gradient(circle at 34% 30%, #f28a6f 0 8%, rgba(242, 138, 111, 0) 42%), #d8432c";
    const cutX = slicer({
      list: tops, cx: 40, cy: 40, W: 27, H: 27, n: 7, cut: seg(0.04, 0.5), skin: tomSkin, face: "#f59b84", rad: "50%",
      hOf: (x: number) => 2 * Math.sqrt(Math.max(0, 13.5 * 13.5 - (x - 40) * (x - 40))),
      fallAfter: 1.6, fallAll: p > 0.53,
      fallTo: (i: number, h: number) => {
        const x = 22 + i * 6.6, y = 70;
        const diced = p >= 0.58 && x > 70 - seg(0.6, 0.93) * 54;
        return { x, y, w: Math.max(9, h * 0.9), r: i * 23, rad: "50%", on: !diced, k0: 0.6, c: "radial-gradient(circle, #f6b29b 0 14%, #e5583c 15% 34%, #f7a68c 35% 40%, #e14d33 41% 70%, #c63824 71%)" };
      },
    });
    const cut2 = 70 - seg(0.6, 0.93) * 54;
    for (let i = 0; i < 7; i++) {
      const x = 22 + i * 6.6;
      const on = p >= 0.58 && x > cut2;
      for (let j = 0; j < 5; j++) {
        put(tops, { x: x + (rand() - 0.5) * 6, y: 70 + (rand() - 0.5) * 6, w: 2.6 + rand(), c: DICE[(i + j) % 4], rad: "26%", r: rand() * 90, on });
      }
    }
    if (p < 0.51) knifeAt(cutX, 40);
    else if (p < 0.59) knifeRest();
    else if (p < 0.94) knifeAt(cut2, 70);
    else knifeRest();
  } else if (kind === "marinieren") {
    s.schale = s.loeffel = true;
    bg = "#f3e0e0";
    veil = "#d8543b"; veilO = 0.32;
    put(pools, { x: 50, y: 52, w: 58, c: "radial-gradient(circle, rgba(214, 70, 46, 0.28) 0 55%, rgba(214, 70, 46, 0) 72%)", rad: "50%", sh: "none", flat: true });
    for (let i = 0; i < 44; i++) {
      const [x, y] = disc(50, 52, 25);
      put(pieces, { x, y, w: 3 + rand() * 0.8, c: DICE[i % 4], rad: "26%", r: rand() * 90 });
    }
    for (let i = 0; i < 6; i++) {
      const [x, y] = disc(50, 52, 20);
      put(tops, { x, y, w: 3.4, h: 2.4, c: "#f6efdc", rad: "50%", r: rand() * 180, on: p >= 0.08 + i * 0.04 });
    }
    for (let i = 0; i < 6; i++) {
      const [x, y] = disc(50, 52, 21);
      put(tops, { x, y, w: 6.4 - i * 0.4, h: 3.4 - i * 0.2, c: i % 2 ? "#3f8a4d" : "#4a9a58", rad: "80% 0", r: rand() * 180, on: p >= 0.35 + i * 0.05 });
    }
    put(tops, { x: 46, y: 47, w: 44 * seg(0.62, 0.8), c: "radial-gradient(circle, rgba(240, 206, 96, 0.38) 0 38%, rgba(240, 206, 96, 0) 70%)", rad: "50%", sh: "none", flat: true, on: p > 0.62 });
    for (let i = 0; i < 12; i++) {
      const [x, y] = disc(50, 52, 22);
      put(tops, { x, y, w: 0.9, c: "#ffffff", rad: "20%", sh: "none", flat: true, on: p >= 0.86 + i * 0.01 });
    }
  } else if (kind === "roesten") {
    s.grill = s.dampf = true;
    bg = "#f7e3d4";
    steamO = (0.55 * seg(0.25, 0.8)).toFixed(2);
    const pos: [number, number, number][] = [[31, 33, -6], [63, 34, 5], [31, 66, 4], [63, 66, -5]];
    pos.forEach(([x, y, r], i) => bread(pieces, x, y, 27, 19, r, seg(0.05 + i * 0.03, 0.95), seg(0.25 + i * 0.03, 0.9), p >= i * 0.03));
    bub(8, 47, 50, 32, "rgba(255, 236, 200, 0.6)", 1.2, 2.2);
    steam = ["M30 30c-3-4 3-6 0-10", "M62 32c-3-4 3-6 0-10", "M46 64c-3-4 3-6 0-10"];
  } else if (kind === "bruschetta") {
    s.brett = true;
    bg = "#f2ebde";
    put(pools, { x: 79, y: 50, w: 22, c: "#f7f2e8", rad: "50%", sh: "0 1px 2px rgba(28, 43, 34, 0.16), inset 0 0 0 2.2px #ffffff" });
    for (let i = 0; i < 16; i++) {
      const [x, y] = disc(79, 50, 7);
      put(pieces, { x, y, w: 2.6, c: DICE[i % 4], rad: "26%", r: rand() * 90, on: p < 0.25 + i * 0.045 });
    }
    const pos: [number, number, number][] = [[27, 33, -5], [53, 31, 6], [28, 64, 4], [54, 65, -6]];
    pos.forEach(([x, y, r], j) => {
      bread(pieces, x, y, 24, 17, r, 1, 1, true);
      topping(tops, x, y, 24, 17, seg(0.1 + j * 0.2, 0.28 + j * 0.2), true);
    });
  } else if (kind === "zucchini") {
    s.brett = s.messer = true;
    bg = "#e3eee5";
    const skin = "radial-gradient(circle at 99% 50%, #c9d79a 0 3%, " + T0 + " 4%), linear-gradient(180deg, #6f9d54 0 28%, #4f7c3d 29% 74%, #416a33 75%)";
    const cutX = slicer({
      list: tops, cx: 47, cy: 38, W: 56, H: 12, n: 11, cut: seg(0.03, 0.86), skin, face: "#dfe7ae", rad: "999px",
      hOf: () => 12,
      fallAfter: 1.4, fallAll: p > 0.9,
      fallTo: (i: number) => {
        const k = 10 - i;
        const row = k < 6 ? 0 : 1;
        const col = row ? k - 6 : k;
        return { x: 24 + col * 7 + row * 3.5, y: 64 + row * 9, w: 10.5, r: 0, rad: "50%", k0: 1, c: "radial-gradient(circle, #f4f1cf 0 47%, #dfe5a6 48% 62%, #9cb867 63% 69%, #46703a 70%)" };
      },
    });
    if (p < 0.88) knifeAt(cutX, 38);
    else knifeRest();
  } else if (kind === "grillen") {
    s.grill = s.dampf = true;
    bg = "#ebe8e2";
    steamO = (0.5 * seg(0.15, 0.6)).toFixed(2);
    for (let i = 0; i < 9; i++) {
      const x = 28 + (i % 3) * 19, y = 31 + Math.floor(i / 3) * 19;
      zucRound(pieces, x, y, 15, seg(0.1 + (i % 3) * 0.04, 0.9), p >= i * 0.015, (i * 37) % 40);
    }
    bub(10, 47, 50, 30, "rgba(255, 240, 200, 0.55)", 1, 2);
  } else if (kind === "antipasti") {
    s.teller = true;
    bg = "#f5eecf";
    bread(pieces, 37, 38, 25, 17, -14, 1, 1, true);
    topping(tops, 37, 38, 25, 17, 1, true);
    bread(pieces, 38, 62, 25, 17, 10, 1, 1, p >= 0.06);
    topping(tops, 38, 62, 25, 17, p >= 0.06 ? 1 : 0, true);
    for (let i = 0; i < 6; i++) {
      const a = -1.15 + i * 0.46;
      zucRound(pieces, 50 + Math.cos(a) * 20, 50 + Math.sin(a) * 23, 11, 1, p >= 0.14 + i * 0.07, i * 20);
    }
    for (let i = 0; i < 9; i++) {
      const [x, y] = disc(64, 50, 12);
      put(tops, { x, y, w: 3.4, h: 0.8, c: "#f1d14a", rad: "999px", r: rand() * 180, sh: "none", on: p >= 0.62 + i * 0.012 });
    }
    for (let i = 0; i < 4; i++) {
      const [x, y] = disc(62, 50, 12);
      put(tops, { x, y, w: 5, h: 2.8, c: "#6fb36b", rad: "80% 0", r: rand() * 180, on: p >= 0.75 + i * 0.03 });
    }
    for (let i = 0; i < 14; i++) {
      const [x, y] = disc(50, 50, 24);
      put(tops, { x, y, w: 0.9, c: "#ffffff", rad: "20%", sh: "none", flat: true, on: p >= 0.9 });
    }
  } else if (kind === "pilze") {
    s.brett = s.messer = true;
    bg = "#f2ebde";
    const cap = "radial-gradient(circle, #d9c7a3 0 12%, " + T0 + " 13%), radial-gradient(circle at 38% 32%, #fbf4e6 0 18%, rgba(251, 244, 230, 0) 55%), #ebdcc0";
    const M: [number, number][] = [[70, 36], [48, 34], [27, 37]];
    let kx = 86, ky = 40;
    M.forEach(([cx, cy], j) => {
      const a = 0.04 + j * 0.29, b = a + 0.25;
      const cutX = slicer({
        list: tops, cx, cy, W: 17, H: 17, n: 5, cut: seg(a, b), skin: cap, face: "#f8f0de", rad: "50%",
        hOf: (x: number) => 2 * Math.sqrt(Math.max(0, 8.5 * 8.5 - (x - cx) * (x - cx))),
        fallAfter: 1.2, fallAll: p > b + 0.02,
        fallTo: (i: number, h: number) => {
          const g = j * 5 + (4 - i);
          return { x: 22 + g * 3.9, y: 66 + (g % 2) * 7 + (g % 3), w: Math.max(7, h * 0.62), h: Math.max(5.6, h * 0.5), r: (g * 29) % 50 - 25, k0: 1, rad: "50% 50% 22% 22% / 64% 64% 36% 36%", c: "linear-gradient(90deg, " + T0 + " 0 37%, #f8f1e2 37% 63%, " + T0 + " 63%) center bottom / 100% 46% no-repeat, #ece0c8" };
        },
      });
      if (p >= a && p < b + 0.01) { kx = cutX; ky = cy; }
    });
    if (kx === 86) knifeRest(); else knifeAt(kx, ky);
  } else if (kind === "pilzeBraten") {
    s.pfanne = s.wender = s.dampf = true;
    bg = "#ebe8e2";
    steamO = (0.5 * seg(0.2, 0.7)).toFixed(2);
    for (let i = 0; i < 18; i++) {
      const [x, y] = disc(50, 50, 25);
      shroom(pieces, x, y, 8, seg(0.08 + (i % 4) * 0.04, 0.95), rand() * 360, true);
    }
    bub(10, 50, 50, 26, "rgba(255, 236, 200, 0.45)", 0.8, 1.5);
  } else if (kind === "reis") {
    s.topf = s.loeffel = s.dampf = true;
    bg = "#f5eecf";
    content = mix("#e3d3b0", "#ece0c4", p);
    veil = content; veilO = 0.6;
    steamO = (seg(0.58, 0.64) * (1 - 0.7 * seg(0.82, 1))).toFixed(2);
    for (let i = 0; i < 16; i++) {
      const [x, y] = disc(50, 50, 24);
      put(pieces, { x, y, w: 2.6, c: i % 3 ? "#efe0ea" : "#d9b8cf", rad: "26%", r: rand() * 90, o: 0.95 });
    }
    for (let i = 0; i < 80; i++) {
      const [x, y] = disc(50, 50, 27);
      put(pieces, { x, y, w: 2.5, h: 1.3, c: mix("#fbf8f0", "#f3e8cc", seg(0.2, 0.55)), rad: "50%", r: rand() * 180, sh: "0 0.3px 0.6px rgba(28, 43, 34, 0.2)", on: p >= 0.03 + (i / 80) * 0.22 });
    }
    put(tops, { x: 48, y: 52, w: 62 * seg(0.58, 0.68), c: "radial-gradient(circle, rgba(226, 196, 110, 0.5) 0 50%, rgba(226, 196, 110, 0) 72%)", rad: "50%", sh: "none", flat: true, on: p > 0.58, o: (1 - 0.85 * seg(0.7, 1)).toFixed(2) });
    if (p > 0.58) bub(8, 50, 50, 24, "rgba(255, 250, 230, 0.8)", 1.6, 3);
  } else if (kind === "bruehe") {
    s.topf = s.loeffel = s.kelle = s.dampf = true;
    bg = "#f5eecf";
    content = mix("#e7d8b7", "#f2e3bb", p);
    veil = content; veilO = 0.62;
    steamO = 0.7;
    const n = 7, j = Math.min(n - 1, Math.floor(p * n)), local = p * n - j;
    kelleO = local < 0.16 ? 1 : 0;
    for (let k = 0; k < n; k++) {
      const [x, y] = disc(54, 46, 8);
      const cur = k === j;
      put(pools, { x, y, w: cur ? 18 + 34 * segOf(local, 0, 0.16) : 18, c: "radial-gradient(circle, rgba(226, 184, 96, 0.5) 0 46%, rgba(226, 184, 96, 0) 72%)", rad: "50%", sh: "none", flat: true, on: cur, o: cur ? (1 - segOf(local, 0.18, 0.95)).toFixed(2) : 0 });
    }
    for (let i = 0; i < 95; i++) {
      const [x, y] = disc(50, 50, 28);
      put(pieces, { x, y, w: 2.4 + 0.6 * p, h: 1.25 + 0.45 * p, c: mix("#f6f1e2", "#fbf2d6", p), rad: "50%", r: rand() * 180, sh: "0 0.3px 0.6px rgba(28, 43, 34, 0.16)", flat: true });
    }
    bub(7, 50, 50, 24, "rgba(255, 250, 230, 0.8)", 1.6, 3);
  } else if (kind === "risotto") {
    s.teller = s.dampf = true;
    bg = "#f5eecf";
    steamO = 0.6;
    steam = ["M40 36c-3-4 3-6 0-10", "M52 30c-3-4 3-6 0-10", "M60 40c-3-4 3-6 0-10"];
    mound(pools, 50, 50, 54, p);
    put(tops, { x: 50, y: 47, w: 9 * (1 - seg(0.02, 0.32)) + 0.01, c: "linear-gradient(135deg, #fbeeb0, #f1d77a)", rad: "18%", r: 12, on: p < 0.32 });
    put(tops, { x: 50, y: 48, w: 30 * seg(0.06, 0.3), c: "radial-gradient(circle, rgba(246, 220, 130, 0.45) 0 45%, rgba(246, 220, 130, 0) 72%)", rad: "50%", sh: "none", flat: true, o: (1 - seg(0.3, 0.6)).toFixed(2) });
    for (let i = 0; i < 10; i++) {
      const [x, y] = disc(50, 50, 18);
      put(tops, { x, y, w: 4.4, h: 1.5, c: "#f5e9bd", rad: "40%", r: rand() * 180, on: p >= 0.32 + i * 0.02 });
    }
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + 0.3;
      shroom(tops, 50 + Math.cos(a) * 11, 48 + Math.sin(a) * 10, 9, 0.7, (i * 61) % 360, p >= 0.55 + i * 0.045);
    }
    for (let i = 0; i < 10; i++) {
      const [x, y] = disc(50, 50, 20);
      put(tops, { x, y, w: 1.3, c: "#4f8a3e", rad: "50%", sh: "none", on: p >= 0.86 + i * 0.008 });
    }
    for (let i = 0; i < 12; i++) {
      const [x, y] = disc(50, 50, 22);
      put(tops, { x, y, w: 0.7, c: "#2f3532", rad: "50%", sh: "none", flat: true, on: p >= 0.94 });
    }
  } else if (kind === "plattieren") {
    s.brett = s.hammer = true;
    bg = "#f3e0e0";
    const pos: [number, number, number][] = [[31, 34, -8], [63, 33, 6], [31, 65, 5], [63, 65, -4]];
    let cur = -1;
    pos.forEach(([x, y, r], i) => {
      const a = 0.02 + i * 0.09, flat = seg(a, a + 0.08);
      if (p >= a && p < a + 0.09) cur = i;
      escalope(pieces, x, y, 20 + 6 * flat, 14 + 4 * flat, r, 0, seg(0.42 + i * 0.06, 0.43 + i * 0.06), seg(0.68 + i * 0.05, 0.69 + i * 0.05), seg(0.9 + i * 0.022, 0.91 + i * 0.022));
    });
    if (cur >= 0) tool = { l: (pos[cur][0] - 8).toFixed(2), t: (pos[cur][1] - 8).toFixed(2), o: 1 };
    else tool = { l: 76, t: 52, o: p < 0.42 ? 1 : 0 };
  } else if (kind === "saltimbocca") {
    s.pfanne = s.wender = s.dampf = true;
    bg = "#f7e3d4";
    steamO = 0.6;
    // Butter foams around each piece; it is not a pool.
    for (const [x, y] of [[33, 36], [60, 31], [34, 64], [63, 60]]) {
      put(pools, { x, y, w: 30, h: 23, c: "radial-gradient(ellipse, rgba(248, 228, 170, 0.34) 0 52%, rgba(248, 228, 170, 0) 72%)", rad: "50%", sh: "none", flat: true });
    }
    const pos: [number, number, number][] = [[33, 36, -8], [60, 31, 6], [34, 64, 5], [63, 60, -4]];
    pos.forEach(([x, y, r], i) => {
      const flip = p >= 0.5 + i * 0.03;
      escalope(pieces, x, y, 22, 15, r, flip ? 0.8 : seg(0, 0.5) * 0.3, flip ? 1 : 0, flip ? 1 : 0, flip ? 1 : 0);
    });
    bub(12, 50, 50, 29, "rgba(255, 244, 214, 0.7)", 0.9, 1.7);
  } else if (kind === "sosse") {
    s.pfanne = s.dampf = true;
    bg = "#f7e3d4";
    steamO = (1 - 0.6 * seg(0.25, 1)).toFixed(2);
    const wine = seg(0, 0.18), red = seg(0.25, 1);
    put(pools, { x: 50, y: 50, w: 68 * wine - 22 * red, c: "radial-gradient(circle, " + (red > 0.5 ? "rgba(150, 88, 40, 0.88)" : "rgba(232, 200, 120, 0.82)") + " 0 52%, rgba(200, 150, 80, 0) 72%)", rad: "50%", sh: "none", flat: true, on: p > 0.005 });
    const pos: [number, number, number][] = [[33, 36, -8], [60, 31, 6], [34, 64, 5], [63, 60, -4]];
    pos.forEach(([x, y, r]) => escalope(pieces, x, y, 22, 15, r, 0.85, 1, 1, 1));
    bub(Math.round(14 - 8 * red), 50, 50, 28, "rgba(255, 236, 200, 0.85)", 1.4, 2.6);
  } else if (kind === "creme") {
    s.schale = s.besen = true;
    bg = "#f5eecf";
    const foam = seg(0.05, 0.4), smooth = seg(0.55, 0.95);
    const cream = mix(mix("#f2c443", "#f8e6a2", foam), "#fbf3dc", smooth);
    veil = cream;
    put(pools, { x: 50, y: 52, w: 36 + 10 * foam + 8 * smooth, c: cream, rad: "48% 52% 50% 47%", sh: "inset 0 -2px 3px rgba(170, 130, 50, 0.18), 0 1px 2px rgba(28, 43, 34, 0.12)" });
    for (let i = 0; i < 4; i++) {
      const [x, y] = disc(50, 52, 9);
      put(pieces, { x, y, w: 7.4, c: "radial-gradient(circle at 40% 36%, #ffd36b 0 22%, #f2a922 60%)", rad: "50%", o: (1 - seg(0.02, 0.14)).toFixed(2) });
    }
    for (let i = 0; i < 14; i++) {
      const [x, y] = disc(50, 52, 16);
      put(pieces, { x, y, w: 1, c: "#ffffff", rad: "20%", sh: "none", flat: true, o: (1 - seg(0.06, 0.2)).toFixed(2) });
    }
    for (let i = 0; i < 5; i++) {
      const [x, y] = disc(50, 52, 14);
      put(pieces, { x, y, w: 9, h: 8, c: "radial-gradient(circle at 40% 36%, #ffffff 0 30%, #f6f1e4 70%)", rad: "46% 54% 52% 48%", on: p >= 0.42 + i * 0.03, o: (1 - seg(0.62, 0.85)).toFixed(2) });
    }
    for (let i = 0; i < 4; i++) {
      put(tops, { x: 50, y: 52, w: 14 + i * 7, c: "none", rad: "50%", sh: "inset 0 0 0 0.8px rgba(220, 196, 140, 0.55)", flat: true, o: (0.9 * seg(0.6, 1)).toFixed(2), r: i * 30 });
    }
  } else if (kind === "schichten" || kind === "kakao") {
    s.form = true;
    const CREAM = "repeating-linear-gradient(172deg, rgba(255, 255, 255, 0) 0 9%, rgba(226, 206, 160, 0.3) 9% 10%), #fbf3dc";
    const BISC = "radial-gradient(circle at 30% 24%, #f7ecd0 0 7%, " + T0 + " 8%), radial-gradient(circle at 66% 52%, #f7ecd0 0 6%, " + T0 + " 7%), radial-gradient(circle at 36% 80%, #f7ecd0 0 6%, " + T0 + " 7%), #a76d3b";
    if (kind === "schichten") {
      bg = "#dfe9ef";
      put(pools, { x: 86, y: 86, w: 15, c: "radial-gradient(circle, #3e2418 0 46%, #ffffff 47% 64%, #e3e8e5 65%)", rad: "50%", sh: "0 1px 2px rgba(28, 43, 34, 0.18)" });
      for (let i = 0; i < 12; i++) {
        const c = i % 6, row = Math.floor(i / 6);
        put(pieces, { x: 22.5 + c * 11, y: 37 + row * 26, w: 9.6, h: 21, c: BISC, rad: "999px", r: (i % 3) - 1, on: p >= i * 0.034 });
      }
      put(pieces, { x: 50, y: 50, w: 69, h: 53, c: CREAM, rad: "6%", sh: "none", flat: true, o: seg(0.43, 0.56).toFixed(2) });
      for (let i = 0; i < 12; i++) {
        const c = i % 6, row = Math.floor(i / 6);
        put(tops, { x: 23.5 + c * 11, y: 38 + row * 26, w: 9.6, h: 21, c: BISC, rad: "999px", r: 1 - (i % 3), on: p >= 0.58 + i * 0.02 });
      }
      put(tops, { x: 50, y: 50, w: 69, h: 53, c: CREAM, rad: "6%", sh: "none", flat: true, o: seg(0.84, 0.98).toFixed(2) });
    } else {
      s.sieb = true;
      bg = p > 0.88 ? "#dfe9ef" : "#ebe8e2";
      const sweep = seg(0.03, 0.78);
      const sx = 16 + 68 * sweep;
      put(pools, { x: 50, y: 50, w: 69, h: 53, c: CREAM, rad: "6%", sh: "none", flat: true });
      put(pools, { x: 50, y: 50, w: 69, h: 53, c: "linear-gradient(90deg, rgba(110, 68, 42, 0.82) 0 " + ((sx - 15.5) / 69 * 100).toFixed(1) + "%, rgba(110, 68, 42, 0) " + ((sx - 9) / 69 * 100).toFixed(1) + "%)", rad: "6%", sh: "none", flat: true });
      for (let i = 0; i < 110; i++) {
        const x = 17 + rand() * 66, y = 25 + rand() * 50;
        put(tops, { x, y, w: 0.8 + rand() * 0.9, c: "#5e3a26", rad: "50%", sh: "none", flat: true, on: x < sx - 2 });
      }
      put(tops, { x: 50, y: 50, w: 82, h: 66, c: "linear-gradient(125deg, rgba(255, 255, 255, 0) 30%, rgba(255, 255, 255, 0.5) 42%, rgba(255, 255, 255, 0) 54%), rgba(255, 255, 255, 0.14)", rad: "11%", sh: "none", flat: true, o: seg(0.86, 0.96).toFixed(2) });
      tool = { l: (sx - 15).toFixed(2), t: (38 + Math.sin(p * 30) * 3).toFixed(2), o: p < 0.8 ? 1 : 0 };
    }
  } else if (kind === "tisch") {
    s.tisch = s.dampf = true;
    bg = "#f2ebde";
    steamO = 0.55;
    steam = ["M68 22c-3-4 3-6 0-10", "M76 24c-3-4 3-6 0-10", "M30 66c-3-4 3-6 0-10"];
    bread(pieces, 23, 23, 15, 10.5, -16, 1, 1, true); topping(tops, 23, 23, 15, 10.5, 1, true);
    bread(pieces, 22, 34, 15, 10.5, 8, 1, 1, true); topping(tops, 22, 34, 15, 10.5, 1, true);
    for (let i = 0; i < 5; i++) { const a = -1 + i * 0.5; zucRound(pieces, 30 + Math.cos(a) * 7, 29 + Math.sin(a) * 9, 7.4, 1, true, i * 20); }
    mound(pools, 72, 28, 22, 1);
    for (let i = 0; i < 5; i++) { const [x, y] = disc(72, 27, 6); shroom(tops, x, y, 4.6, 0.9, rand() * 360, true); }
    for (let i = 0; i < 6; i++) { const [x, y] = disc(72, 28, 8); put(tops, { x, y, w: 0.9, c: "#4f8a3e", rad: "50%", sh: "none" }); }
    put(pools, { x: 29, y: 72, w: 26, h: 20, c: "radial-gradient(circle, rgba(168, 104, 46, 0.55) 0 50%, rgba(168, 104, 46, 0) 72%)", rad: "50%", sh: "none", flat: true });
    escalope(pieces, 25, 69, 16, 11, -10, 0.85, 1, 1, 1);
    escalope(pieces, 33, 77, 16, 11, 8, 0.85, 1, 1, 1);
    put(pieces, { x: 72, y: 72, w: 17, h: 14, c: "radial-gradient(circle at 30% 30%, #7d5136 0 10%, " + T0 + " 11%), radial-gradient(circle at 70% 64%, #7d5136 0 9%, " + T0 + " 10%), #6b4430", rad: "10%", r: -6, sh: "0 0 0 1.2px #f6ecd2, 0 1px 2px rgba(28, 43, 34, 0.2)" });
    put(tops, { x: 76, y: 68, w: 5, h: 2.8, c: "#6fb36b", rad: "80% 0", r: -30 });
  } else if (kind === "tee") {
    // Fifteen minutes: one to pour, eight to steep, six to drink it in small sips.
    s.tasse = s.dampf = true;
    bg = "#e3eee5";
    const pour = seg(0, 1 / 15), steep = seg(1 / 15, 9 / 15);
    const drink = segOf(p, 9 / 15, 1);
    let sips = 0;
    for (let j = 0; j < 6; j++) sips += segOf(drink, (j + 0.72) / 6, (j + 1) / 6);
    level = p < 1 / 15 ? (0.12 + 0.88 * pour).toFixed(3) : (1 - 0.42 * Math.min(sips, 5) / 5).toFixed(3);
    teaO = (1 - segOf(sips, 5, 6)).toFixed(2);
    tea = p < 1 / 15 ? "#edf1ea" : mix("#ebe2bd", "#ad5d27", 1 - (1 - steep) * (1 - steep));
    bagIn = p >= 1 / 15 && p < 9 / 15 ? 1 : 0;
    bagOut = p >= 9 / 15 ? 1 : 0;
    stain = (0.45 * seg(0.62, 1)).toFixed(2);
    steamO = (p < 9 / 15 ? 1 : 1 - 0.8 * drink).toFixed(2);
  }

  if (s.brett) s.brettDetail = true;
  let glanz: { l: number | string; d: number | string } = { l: 0, d: 0 };
  if ((s.topf || s.pfanne || s.schale || s.teller)) {
    s.glanz = true;
    const r = s.teller ? 44 : s.schale ? 36 : 33.6;
    glanz = { l: (50 - r).toFixed(1), d: (2 * r).toFixed(1) };
  }

  return {
    label: LABEL[kind], bg, s, content, veil, veilO, steamO, tea, teaO, level, bagIn, bagOut, stain, kelleO, knife, tool, glanz,
    steam1: steam[0], steam2: steam[1], steam3: steam[2],
    pieces, pools, tops, bubbles,
  };
}
