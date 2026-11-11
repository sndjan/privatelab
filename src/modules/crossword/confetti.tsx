"use client";

import { useEffect, useRef } from "react";

const colors = ["#1e6a4e", "#7fd1ac", "#ffd77a", "#f07c9b", "#4f8fe0", "#f0976a"];
const duration = 4500;

type Piece = { x: number; y: number; vx: number; vy: number; size: number; color: string; angle: number; spin: number; round: boolean };

// A burst of confetti over the whole screen, from both lower corners, that
// falls and fades out. Draws on a canvas that ignores taps. Each new `run`
// (a counter) starts a new burst; 0 shows nothing. With reduced motion, it
// shows nothing at all (the message on the page stays).
export function Confetti({ run }: { run: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!run || !canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scale = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);

    const pieces: Piece[] = Array.from({ length: 180 }, (_, i) => {
      const fromLeft = i % 2 === 0;
      const angle = (fromLeft ? -60 : -120) + (Math.random() - 0.5) * 40;
      const speed = 9 + Math.random() * 9;
      return {
        x: fromLeft ? 0 : width,
        y: height * 0.85,
        vx: Math.cos((angle * Math.PI) / 180) * speed,
        vy: Math.sin((angle * Math.PI) / 180) * speed,
        size: 6 + Math.random() * 6,
        color: colors[i % colors.length],
        angle: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.3,
        round: Math.random() < 0.3,
      };
    });

    const start = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, elapsed - duration + 1200) / 1200);
      for (const p of pieces) {
        p.vy += 0.25;
        p.vx *= 0.99;
        p.vy *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.spin;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Flat strips that seem to turn as they fall.
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, (p.size / 2) * Math.abs(Math.cos(p.angle * 2)) + 1);
        }
        ctx.restore();
      }
      if (elapsed < duration) frame = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, width, height);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [run]);

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-50 size-full" />;
}
