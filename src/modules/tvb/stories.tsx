"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { stories } from "./data";
import { display, serif } from "./site";

// "Wusstest du?": one story from the club at a time, the next on a tap.
export function DidYouKnow() {
  const [index, setIndex] = useState(0);
  const story = stories[index % stories.length];
  return (
    <section className="mx-auto w-full max-w-[1240px] px-4 pt-10 pb-2 sm:px-8 lg:px-12">
      <div className="flex flex-col gap-8 rounded-[20px] bg-(--tvb-deep) px-7 py-9 text-white lg:flex-row lg:items-center lg:gap-10 lg:px-11 lg:py-10">
        <div className="flex shrink-0 flex-col gap-1.5">
          <h2 className={cn(display, "text-[40px] leading-none")}>Wusstest du?</h2>
          <span className="text-[15px] opacity-75">
            Geschichten vom Platz · {(index % stories.length) + 1} von {stories.length}
          </span>
        </div>
        <figure className="min-w-0 flex-1 border-l-4 border-[#d7e34a] pl-6" aria-live="polite">
          <blockquote className={cn(serif, "text-[23px] leading-snug lg:text-[25px]")}>{story.text}</blockquote>
          <figcaption className="mt-3 text-[15px] opacity-80">{story.source}</figcaption>
        </figure>
        <button
          type="button"
          onClick={() => setIndex((value) => value + 1)}
          className="min-h-12 shrink-0 self-start rounded-full border-2 border-white/70 px-5 font-bold transition hover:bg-white/10 lg:self-center"
        >
          Nächste Geschichte →
        </button>
      </div>
    </section>
  );
}
