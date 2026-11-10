"use client";

import { Fragment, useMemo } from "react";
import { buildScene, type SceneId } from "./scene-data";
import "./fokus.css";

// One kitchen scene, drawn from above: fixed drawings plus small pieces that
// move with the step's progress. Fills the width of its parent; the motion
// (steam, stirring, the knife) pauses with `playing`.
export function Scene({
  scene,
  progress,
  playing = true,
  flat = false,
  radius = "28px",
}: {
  scene: SceneId;
  progress: number;
  playing?: boolean;
  // Without its own background, for a page that already has the scene's colour.
  flat?: boolean;
  radius?: string;
}) {
  // Rounded so a ticking timer redraws a scene about once a second, not five times.
  const rounded = Math.round(progress * 2000) / 2000;
  const built = useMemo(() => buildScene(scene, rounded), [scene, rounded]);
  const { label, s, content, veil, veilO, steamO, tea, teaO, level, bagIn, bagOut, stain, kelleO, knife, tool, glanz, steam1, steam2, steam3, pieces, pools, tops, bubbles } = built;
  const bg = flat ? "transparent" : built.bg;
  const play = playing ? "running" : "paused";
  const wcss = "100%";

  return (
    <div role="img" aria-label={label} style={{ position: "relative", width: wcss, aspectRatio: "1 / 1", overflow: "hidden", borderRadius: radius, background: bg, transition: "background 900ms linear", isolation: "isolate" }}>

      {s.brett && (<>
        <svg viewBox="0 0 100 100" aria-hidden="true" style={{ position: "absolute", left: "0", top: "0", width: "100%", height: "100%" }}>
          <rect x="9.6" y="17.6" width="82" height="68" rx="9" fill="#1c2b22" fillOpacity="0.09" />
          <path d="M90 44h5a6 6 0 0 1 0 12h-5z" fill="#cf9f66" />
          <rect x="8" y="15" width="82" height="68" rx="9" fill="#d9ad74" />
          <g stroke="#c9995f" strokeWidth="0.9" strokeLinecap="round" fill="none">
            <path d="M16 24h30" /><path d="M54 24h26" /><path d="M18 76h48" /><path d="M14 50h6" /><path d="M76 62h8" />
          </g>
        </svg>
      </>)}
      {s.brettDetail && (<>
        <svg viewBox="0 0 100 100" aria-hidden="true" style={{ position: "absolute", left: "0", top: "0", width: "100%", height: "100%" }}>
          <g stroke="#c48f55" strokeWidth="0.5" strokeLinecap="round" fill="none" strokeOpacity="0.8">
            <path d="M12 30c14-1.5 30 1.5 44 0s22-1 30 0" /><path d="M12 42c18 1 28-1.5 46 0s20 1 28 0" /><path d="M12 58c12-1 34 1.5 48 0s18-1 26 0" /><path d="M12 68c16 1 30-1 44 0s22 1 30 0" />
          </g>
          <ellipse cx="70" cy="30" rx="3" ry="1.6" fill="none" stroke="#c48f55" strokeWidth="0.6" />
          <rect x="8" y="15" width="82" height="68" rx="9" fill="none" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="1" />
        </svg>
      </>)}

      {s.pfanne && (<>
        <svg viewBox="0 0 100 100" aria-hidden="true" style={{ position: "absolute", left: "0", top: "0", width: "100%", height: "100%" }}>
          <rect x="84" y="45" width="16" height="10" rx="4.5" fill="#2b302d" />
          <circle cx="51.8" cy="53.6" r="38" fill="#1c2b22" fillOpacity="0.16" />
          <circle cx="50" cy="50" r="38" fill="#454b47" />
          <circle cx="50" cy="50" r="33.5" fill="#33383a" />
          <circle cx="50" cy="50" r="33.5" fill="none" stroke="#1c2b22" strokeOpacity="0.25" strokeWidth="2" />
          <path d="M18 35a35 35 0 0 1 19-18" fill="none" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </>)}

      {s.grill && (<>
        <svg viewBox="0 0 100 100" aria-hidden="true" style={{ position: "absolute", left: "0", top: "0", width: "100%", height: "100%" }}>
          <rect x="86" y="44" width="14" height="11" rx="4.5" fill="#2b302d" />
          <rect x="9.6" y="13.6" width="78" height="78" rx="11" fill="#1c2b22" fillOpacity="0.16" />
          <rect x="8" y="11" width="78" height="78" rx="11" fill="#454b47" />
          <rect x="13" y="16" width="68" height="68" rx="7" fill="#383d3b" />
          <g stroke="#2c302e" strokeWidth="1.8" strokeLinecap="round">
            <path d="M17 23h60" /><path d="M17 30h60" /><path d="M17 37h60" /><path d="M17 44h60" /><path d="M17 51h60" /><path d="M17 58h60" /><path d="M17 65h60" /><path d="M17 72h60" /><path d="M17 79h60" />
          </g>
          <path d="M12 26a12 12 0 0 1 10-11" fill="none" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </>)}

      {s.topf && (<>
        <svg viewBox="0 0 100 100" aria-hidden="true" style={{ position: "absolute", left: "0", top: "0", width: "100%", height: "100%" }}>
          <rect x="1" y="44" width="14" height="12" rx="5" fill="#4d7a5d" />
          <rect x="85" y="44" width="14" height="12" rx="5" fill="#4d7a5d" />
          <circle cx="51.8" cy="53.6" r="40" fill="#1c2b22" fillOpacity="0.14" />
          <circle cx="50" cy="50" r="40" fill="#5f9473" />
          <circle cx="50" cy="50" r="35.5" fill="#2f3532" />
          <circle cx="50" cy="50" r="33.6" fill={content} style={{ transition: "fill 900ms linear" }} />
          <circle cx="50" cy="50" r="33.6" fill="none" stroke="#1c2b22" strokeOpacity="0.12" strokeWidth="2.4" />
          <path d="M19 34a36 36 0 0 1 20-17" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </>)}

      {s.schale && (<>
        <svg viewBox="0 0 100 100" aria-hidden="true" style={{ position: "absolute", left: "0", top: "0", width: "100%", height: "100%" }}>
          <circle cx="51.8" cy="53.6" r="42" fill="#1c2b22" fillOpacity="0.1" />
          <circle cx="50" cy="50" r="42" fill="#f7f2e8" />
          <circle cx="50" cy="50" r="36" fill="#1c2b22" fillOpacity="0.06" />
          <path d="M17 34a36 36 0 0 1 22-19" fill="none" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </>)}

      {s.teller && (<>
        <svg viewBox="0 0 100 100" aria-hidden="true" style={{ position: "absolute", left: "0", top: "0", width: "100%", height: "100%" }}>
          <circle cx="51.8" cy="53.6" r="44" fill="#1c2b22" fillOpacity="0.08" />
          <circle cx="50" cy="50" r="44" fill="#fffdf8" />
          <circle cx="50" cy="50" r="34" fill="none" stroke="#ebe4d6" strokeWidth="1.2" />
        </svg>
      </>)}

      {s.form && (<>
        <svg viewBox="0 0 100 100" aria-hidden="true" style={{ position: "absolute", left: "0", top: "0", width: "100%", height: "100%" }}>
          <rect x="11.6" y="20.6" width="80" height="64" rx="11" fill="#1c2b22" fillOpacity="0.12" />
          <rect x="10" y="18" width="80" height="64" rx="11" fill="#f7f2e8" />
          <rect x="15" y="23" width="70" height="54" rx="6" fill="#e9e0cf" />
          <rect x="15" y="23" width="70" height="54" rx="6" fill="none" stroke="#1c2b22" strokeOpacity="0.08" strokeWidth="1.6" />
          <path d="M14 30a9 9 0 0 1 7-8" fill="none" stroke="#ffffff" strokeOpacity="0.8" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </>)}

      {s.tisch && (<>
        <svg viewBox="0 0 100 100" aria-hidden="true" style={{ position: "absolute", left: "0", top: "0", width: "100%", height: "100%" }}>
          <rect x="5" y="44" width="90" height="13" rx="2.5" fill="#e3eee5" transform="rotate(-8 50 50)" />
          <rect x="5" y="46" width="90" height="0.8" fill="#4f9d6e" fillOpacity="0.35" transform="rotate(-8 50 50)" />
          <rect x="5" y="54.2" width="90" height="0.8" fill="#4f9d6e" fillOpacity="0.35" transform="rotate(-8 50 50)" />
          <circle cx="29.4" cy="30.6" r="21" fill="#1c2b22" fillOpacity="0.08" />
          <circle cx="28" cy="29" r="21" fill="#fffdf8" />
          <circle cx="28" cy="29" r="16" fill="none" stroke="#ebe4d6" strokeWidth="0.8" />
          <circle cx="73.4" cy="29.6" r="19" fill="#1c2b22" fillOpacity="0.08" />
          <circle cx="72" cy="28" r="19" fill="#fffdf8" />
          <circle cx="72" cy="28" r="13.5" fill="#1c2b22" fillOpacity="0.05" />
          <circle cx="30.4" cy="73.6" r="21" fill="#1c2b22" fillOpacity="0.08" />
          <circle cx="29" cy="72" r="21" fill="#fffdf8" />
          <circle cx="29" cy="72" r="16" fill="none" stroke="#ebe4d6" strokeWidth="0.8" />
          <circle cx="73.4" cy="73.6" r="17" fill="#1c2b22" fillOpacity="0.08" />
          <circle cx="72" cy="72" r="17" fill="#fffdf8" />
          <circle cx="72" cy="72" r="12.5" fill="none" stroke="#ebe4d6" strokeWidth="0.8" />
          <circle cx="51.6" cy="51.4" r="6.6" fill="#1c2b22" fillOpacity="0.1" />
          <circle cx="51" cy="50.5" r="6.6" fill="#ffffff" fillOpacity="0.85" stroke="#dfe6e2" strokeWidth="0.6" />
          <circle cx="51" cy="50.5" r="4.4" fill="#8e2a3a" />
          <path d="M48.4 48.6a3.4 3.4 0 0 1 2.4-1.6" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="0.9" strokeLinecap="round" />
        </svg>
      </>)}

      {s.tasse && (<>
        <svg viewBox="0 0 100 100" aria-hidden="true" style={{ position: "absolute", left: "0", top: "0", width: "100%", height: "100%" }}>
          <circle cx="51.6" cy="53.2" r="40" fill="#1c2b22" fillOpacity="0.09" />
          <circle cx="50" cy="50" r="40" fill="#fffdf8" />
          <circle cx="50" cy="50" r="31" fill="none" stroke="#ebe4d6" strokeWidth="1.2" />
          <g transform="translate(24 73)">
            <circle cx="0" cy="0" r="6.2" fill="#e5b620" /><circle cx="0" cy="0" r="5.2" fill="#fbf2c8" /><circle cx="0" cy="0" r="4.5" fill="#f5d550" />
            <g stroke="#fbf2c8" strokeWidth="0.7"><path d="M0 -4.5v9" /><path d="M-4.5 0h9" /><path d="M-3.2 -3.2l6.4 6.4" /><path d="M3.2 -3.2l-6.4 6.4" /></g>
          </g>
          <g style={{ opacity: bagOut, transition: "opacity 900ms ease" }}>
            <rect x="70" y="68" width="10" height="12" rx="2" fill="#a77a43" transform="rotate(18 75 74)" />
            <path d="M76 69 C80 60 82 56 86 52" fill="none" stroke="#e9e2d2" strokeWidth="0.6" />
            <rect x="83" y="46" width="7" height="6" rx="1" fill="#ffffff" stroke="#e1d9c7" strokeWidth="0.5" transform="rotate(14 86 49)" />
          </g>
          <path d="M71 44.5h9.5a5.5 5.5 0 0 1 0 11H71" fill="none" stroke="#d3e1e6" strokeWidth="4.6" strokeLinecap="round" />
          <circle cx="51.2" cy="52.4" r="25" fill="#1c2b22" fillOpacity="0.1" />
          <circle cx="50" cy="50" r="25" fill="#ffffff" />
          <circle cx="50" cy="50" r="25" fill="none" stroke="#d3e1e6" strokeWidth="1.4" />
          <circle cx="50" cy="50" r="21.4" fill="none" stroke="#b0602a" strokeOpacity={stain} strokeWidth="0.8" />
          <g style={{ transform: `scale(${level})`, opacity: teaO, transformOrigin: "50px 50px", transition: "transform 1200ms ease-in-out, opacity 1200ms ease-in-out" }}>
            <circle cx="50" cy="50" r="22" fill={tea} style={{ transition: "fill 1500ms linear" }} />
            <path d="M37 44a15 15 0 0 1 9-8" fill="none" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1.6" strokeLinecap="round" />
          </g>
          <g style={{ opacity: bagIn, transition: "opacity 900ms ease" }}>
            <rect x="42" y="47" width="11" height="13" rx="2" fill="#a77a43" fillOpacity="0.85" transform="rotate(-12 47 53)" />
            <path d="M49 48 C52 38 54 30 57 22" fill="none" stroke="#e9e2d2" strokeWidth="0.6" />
            <rect x="54" y="13" width="8" height="7" rx="1" fill="#ffffff" stroke="#e1d9c7" strokeWidth="0.5" />
            <path d="M56.4 17.6c1-2.6 2.6-3 3.6-3-0.2 1.8-1.4 3-3.6 3z" fill="#4f9d6e" />
          </g>
        </svg>
      </>)}

      {s.loeffel && (<>
        <svg viewBox="0 0 100 100" aria-hidden="true" style={{ position: "absolute", left: "0", top: "0", width: "100%", height: "100%" }}>
          <g style={{ transformOrigin: "50px 50px", animation: "fk-sway 7s ease-in-out infinite alternate", animationPlayState: play }}>
            <rect x="48.4" y="42" width="3.2" height="16" rx="1.6" fill="#c9995f" />
            <ellipse cx="50" cy="63" rx="5.4" ry="7.2" fill="#d9ad74" />
            <ellipse cx="50" cy="63.6" rx="3.6" ry="5.2" fill="#c9995f" />
            <ellipse cx="50" cy="58" rx="8.6" ry="15" fill={veil} fillOpacity={veilO} style={{ transition: "fill 900ms linear" }} />
          </g>
        </svg>
      </>)}

      {pools.map((q, i) => (<Fragment key={i}>
        <span style={{ position: "absolute", left: `${q.x}%`, top: `${q.y}%`, width: `${q.w}%`, height: `${q.h}%`, background: q.c, borderRadius: q.rad, boxShadow: q.sh, opacity: q.o, clipPath: `inset(${q.cl})`, transform: `translate(-50%, -50%) rotate(${q.r}deg) scale(${q.k})`, animation: q.a, animationPlayState: play, transition: "opacity 900ms ease, transform 900ms ease, background 900ms linear, width 1200ms ease, height 1200ms ease, left 900ms ease, top 900ms ease, clip-path 900ms ease" }} />
      </Fragment>))}
      {pieces.map((q, i) => (<Fragment key={i}>
        <span style={{ position: "absolute", left: `${q.x}%`, top: `${q.y}%`, width: `${q.w}%`, height: `${q.h}%`, background: q.c, borderRadius: q.rad, boxShadow: q.sh, opacity: q.o, clipPath: `inset(${q.cl})`, transform: `translate(-50%, -50%) rotate(${q.r}deg) scale(${q.k})`, animation: q.a, animationPlayState: play, transition: "opacity 700ms ease, transform 900ms cubic-bezier(0.3, 0.7, 0.4, 1.15), background 900ms linear, width 900ms ease, height 900ms ease, left 1100ms cubic-bezier(0.3, 0.7, 0.4, 1), top 1100ms cubic-bezier(0.3, 0.7, 0.4, 1), clip-path 900ms ease" }} />
      </Fragment>))}
      {tops.map((q, i) => (<Fragment key={i}>
        <span style={{ position: "absolute", left: `${q.x}%`, top: `${q.y}%`, width: `${q.w}%`, height: `${q.h}%`, background: q.c, borderRadius: q.rad, boxShadow: q.sh, opacity: q.o, clipPath: `inset(${q.cl})`, transform: `translate(-50%, -50%) rotate(${q.r}deg) scale(${q.k})`, animation: q.a, animationPlayState: play, transition: "opacity 700ms ease, transform 900ms cubic-bezier(0.3, 0.7, 0.4, 1.15), background 900ms linear, width 900ms ease, height 900ms ease, left 1100ms cubic-bezier(0.3, 0.7, 0.4, 1), top 1100ms cubic-bezier(0.3, 0.7, 0.4, 1), clip-path 900ms ease" }} />
      </Fragment>))}
      {bubbles.map((b, i) => (<Fragment key={i}>
        <span style={{ position: "absolute", left: `${b.x}%`, top: `${b.y}%`, width: `${b.s}%`, height: `${b.s}%`, boxSizing: "border-box", border: `1.2px solid ${b.c}`, borderRadius: "50%", opacity: "0", animation: `fk-bubble ${b.dur}s ease-in-out ${b.del}s infinite`, animationPlayState: play }} />
      </Fragment>))}

      {s.loeffel && (<>
        <svg viewBox="0 0 100 100" aria-hidden="true" style={{ position: "absolute", left: "0", top: "0", width: "100%", height: "100%" }}>
          <g style={{ transformOrigin: "50px 50px", animation: "fk-sway 7s ease-in-out infinite alternate", animationPlayState: play }}>
            <rect x="49.4" y="9.6" width="3.2" height="35" rx="1.6" fill="#1c2b22" fillOpacity="0.14" />
            <rect x="48.4" y="8" width="3.2" height="36" rx="1.6" fill="#d9ad74" />
            <path d="M49.2 12v28" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="0.7" strokeLinecap="round" />
            <ellipse cx="50" cy="44.2" rx="3.6" ry="1.3" fill={veil} fillOpacity="0.9" />
            <ellipse cx="50" cy="43.7" rx="2.6" ry="0.7" fill="#ffffff" fillOpacity="0.3" />
          </g>
        </svg>
      </>)}

      {s.wender && (<>
        <svg viewBox="0 0 100 100" aria-hidden="true" style={{ position: "absolute", left: "0", top: "0", width: "100%", height: "100%" }}>
          <g style={{ transformOrigin: "50px 50px", animation: "fk-push 8s ease-in-out infinite alternate", animationPlayState: play }}>
            <g fill="#1c2b22" fillOpacity="0.2" transform="translate(0.7 1.1)">
              <rect x="48.4" y="6" width="3.2" height="40" rx="1.6" />
              <path d="M44.6 45.5 Q50 43 55.4 45.5 L56.8 61 Q50 63.6 43.2 61 Z" />
            </g>
            <rect x="48.4" y="6" width="3.2" height="40" rx="1.6" fill="#d9ad74" />
            <path d="M49.2 10v32" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="0.7" strokeLinecap="round" />
            <path d="M44.6 45.5 Q50 43 55.4 45.5 L56.8 61 Q50 63.6 43.2 61 Z" fill="#d9ad74" />
            <path d="M43.4 59.4 Q50 62 56.6 59.4 L56.8 61 Q50 63.6 43.2 61 Z" fill="#c08d52" />
            <g stroke="#c9995f" strokeWidth="1.1" strokeLinecap="round"><path d="M47.6 49v7" /><path d="M50 48.6v7.6" /><path d="M52.4 49v7" /></g>
          </g>
        </svg>
      </>)}

      {s.besen && (<>
        <svg viewBox="0 0 100 100" aria-hidden="true" style={{ position: "absolute", left: "0", top: "0", width: "100%", height: "100%" }}>
          <g style={{ animation: "fk-orbit 5.5s linear infinite", animationPlayState: play }}>
            <rect x="49.4" y="7.6" width="3.4" height="26" rx="1.7" fill="#1c2b22" fillOpacity="0.14" />
            <rect x="48.3" y="6" width="3.4" height="26" rx="1.7" fill="#4f9d6e" />
            <g fill="none" stroke="#b9c1bc" strokeWidth="0.8">
              <ellipse cx="50" cy="48" rx="2.2" ry="17" /><ellipse cx="50" cy="48" rx="4.6" ry="17" /><ellipse cx="50" cy="48" rx="7" ry="17" />
            </g>
            <ellipse cx="50" cy="58" rx="9.4" ry="8.4" fill={veil} fillOpacity="0.72" style={{ transition: "fill 900ms linear" }} />
          </g>
        </svg>
      </>)}

      {s.messer && (<>
        <div aria-hidden="true" style={{ position: "absolute", left: `${knife.l}%`, top: `${knife.t}%`, width: "12%", height: "58%", transition: "left 1100ms cubic-bezier(0.4, 0, 0.3, 1), top 1100ms cubic-bezier(0.4, 0, 0.3, 1)" }}>
          <svg viewBox="0 0 12 58" style={{ display: "block", width: "100%", height: "100%", overflow: "visible" }}>
            <g transform="translate(0.8 1.4)" fill="#1c2b22" fillOpacity="0.13">
              <path d="M6 1 Q8.6 9 8.4 33 L4.2 33 Q4.1 12 6 1Z" /><rect x="3.8" y="33" width="5.2" height="22" rx="2.6" />
            </g>
            <g style={{ animation: "fk-lift 1.9s ease-in-out infinite alternate", animationPlayState: play }}>
              <path d="M6 1 Q8.6 9 8.4 33 L4.2 33 Q4.1 12 6 1Z" fill="#e3e8e5" />
              <path d="M6 1 Q8.6 9 8.4 33 L7.4 33 Q7.6 12 6 1Z" fill="#c4ccc7" />
              <rect x="3.8" y="33" width="5.2" height="22" rx="2.6" fill="#b98a52" />
              <path d="M5 36v15" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="0.7" strokeLinecap="round" />
            </g>
          </svg>
        </div>
      </>)}

      {s.hammer && (<>
        <div aria-hidden="true" style={{ position: "absolute", left: `${tool.l}%`, top: `${tool.t}%`, width: "16%", height: "40%", opacity: tool.o, transition: "left 1100ms cubic-bezier(0.4, 0, 0.3, 1), top 1100ms cubic-bezier(0.4, 0, 0.3, 1), opacity 700ms ease" }}>
          <svg viewBox="0 0 16 40" style={{ display: "block", width: "100%", height: "100%", overflow: "visible" }}>
            <g fill="#1c2b22" fillOpacity="0.13" transform="translate(0.8 1.4)"><circle cx="8" cy="8" r="6.6" /><rect x="6.4" y="12" width="3.2" height="26" rx="1.6" /></g>
            <g style={{ transformOrigin: "8px 8px", animation: "fk-press 2.4s ease-in-out infinite alternate", animationPlayState: play }}>
              <rect x="6.4" y="12" width="3.2" height="26" rx="1.6" fill="#b98a52" />
              <circle cx="8" cy="8" r="6.6" fill="#8b948f" />
              <circle cx="8" cy="8" r="5" fill="#a9b1ac" />
              <circle cx="8" cy="8" r="1.6" fill="#8b948f" />
              <path d="M4.6 5.6a4.4 4.4 0 0 1 3-2.2" fill="none" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="0.8" strokeLinecap="round" />
            </g>
          </svg>
        </div>
      </>)}

      {s.sieb && (<>
        <div aria-hidden="true" style={{ position: "absolute", left: `${tool.l}%`, top: `${tool.t}%`, width: "30%", height: "40%", opacity: tool.o, transition: "left 1400ms ease-in-out, top 1400ms ease-in-out, opacity 700ms ease" }}>
          <svg viewBox="0 0 30 40" style={{ display: "block", width: "100%", height: "100%", overflow: "visible" }}>
            <g fill="#1c2b22" fillOpacity="0.12" transform="translate(1 1.6)"><circle cx="15" cy="13" r="12" /><rect x="13.5" y="24" width="3" height="15" rx="1.5" /></g>
            <g style={{ animation: "fk-shake 0.9s ease-in-out infinite alternate", animationPlayState: play }}>
              <rect x="13.5" y="24" width="3" height="15" rx="1.5" fill="#7c8580" />
              <circle cx="15" cy="13" r="12" fill="#6b4430" fillOpacity="0.18" />
              <g stroke="#a9b1ac" strokeWidth="0.35" strokeOpacity="0.8">
                <path d="M5 8h20M4 11h22M4 14h22M4 17h22M5 20h20" /><path d="M8 3v20M11 2v22M14 1.5v23M17 1.5v23M20 2v22M23 4v18" />
              </g>
              <circle cx="15" cy="13" r="12" fill="none" stroke="#b9c1bc" strokeWidth="1.6" />
            </g>
          </svg>
        </div>
      </>)}

      {s.kelle && (<>
        <div aria-hidden="true" style={{ position: "absolute", left: "50%", top: "6%", width: "46%", height: "46%", opacity: kelleO, transition: "opacity 800ms ease" }}>
          <svg viewBox="0 0 40 40" style={{ display: "block", width: "100%", height: "100%", overflow: "visible" }}>
            <g fill="#1c2b22" fillOpacity="0.14" transform="translate(0.8 1.4)"><circle cx="12" cy="28" r="8" /><path d="M16 23 L38 1" stroke="#1c2b22" strokeOpacity="0.14" strokeWidth="3" strokeLinecap="round" /></g>
            <path d="M16 23 L38 1" stroke="#a9b1ac" strokeWidth="3" strokeLinecap="round" />
            <circle cx="12" cy="28" r="8" fill="#c4ccc7" />
            <circle cx="12" cy="28" r="6.3" fill="#e2b964" />
            <path d="M8 25a4.6 4.6 0 0 1 3.4-2.4" fill="none" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="0.9" strokeLinecap="round" />
          </svg>
        </div>
      </>)}

      {s.glanz && (<>
        <span aria-hidden="true" style={{ position: "absolute", left: `${glanz.l}%`, top: `${glanz.l}%`, width: `${glanz.d}%`, height: `${glanz.d}%`, borderRadius: "50%", background: "radial-gradient(circle at 34% 28%, rgba(255, 255, 255, 0.26), rgba(255, 255, 255, 0) 46%), radial-gradient(circle at 50% 50%, rgba(28, 43, 34, 0) 80%, rgba(28, 43, 34, 0.1) 100%)" }} />
      </>)}

      {s.dampf && (<>
        <svg viewBox="0 0 100 100" aria-hidden="true" style={{ position: "absolute", left: "0", top: "0", width: "100%", height: "100%", opacity: steamO, transition: "opacity 1500ms linear" }}>
          <g fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round">
            <path d={steam1} style={{ animation: "fk-steam 4.4s ease-in-out infinite", animationPlayState: play }} />
            <path d={steam2} style={{ animation: "fk-steam 5s ease-in-out 1.5s infinite", animationPlayState: play }} />
            <path d={steam3} style={{ animation: "fk-steam 4.7s ease-in-out 2.8s infinite", animationPlayState: play }} />
          </g>
        </svg>
      </>)}
    </div>
  );
}
