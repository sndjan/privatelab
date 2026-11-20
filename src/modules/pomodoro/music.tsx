"use client";

import { useEffect, useRef } from "react";

// Lo-fi music from YouTube (a long mix or a 24/7 live stream), played in an
// embedded player that loops a video when it ends.
// The page talks to it through the IFrame API's postMessage commands for the
// volume; starting and stopping mounts and unmounts it (a live stream has no
// position to keep). Any other video or stream can be pasted as a link.

export const stations = [
  { id: "lofi", name: "Lofi", video: "rFZHOHl-L8A" },
  { id: "lofigirl", name: "Lofi Girl", video: "jfKfPfyJRdk" },
  { id: "synthwave", name: "Synthwave", video: "4xDzrJKXOOY" },
  { id: "sleep", name: "Chill", video: "28KRPhVzCus" },
] as const;

// The video id from a YouTube link (watch, youtu.be, live, embed, shorts) or an id.
export function youtubeId(input: string) {
  const text = input.trim();
  if (/^[\w-]{11}$/.test(text)) return text;
  const match = text.match(/(?:v=|youtu\.be\/|\/live\/|\/embed\/|\/shorts\/)([\w-]{11})/);
  return match?.[1] ?? null;
}

export function stationVideo(station: string, custom: string) {
  if (station === "custom") return youtubeId(custom);
  return stations.find((s) => s.id === station)?.video ?? stations[0].video;
}

export function stationName(station: string) {
  return station === "custom" ? "Eigener Link" : (stations.find((s) => s.id === station)?.name ?? stations[0].name);
}

function command(frame: HTMLIFrameElement | null, func: string, args: unknown[] = []) {
  frame?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
}

// The player itself. Rendered only while music should be heard.
// A volume change fades in over about half a second (at once in a background
// tab, where the browser slows timers down).
export function YoutubePlayer({ video, volume, className }: { video: string; volume: number; className?: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const volumeRef = useRef(volume);

  useEffect(() => {
    const set = (value: number) => {
      volumeRef.current = value;
      command(frame.current, "setVolume", [Math.round(value)]);
    };
    if (document.visibilityState === "hidden") {
      set(volume);
      return;
    }
    const step = (volume - volumeRef.current) / 8;
    if (Math.abs(step) < 0.5) {
      set(volume);
      return;
    }
    const fade = setInterval(() => {
      const next = volumeRef.current + step;
      const done = step > 0 ? next >= volume : next <= volume;
      set(done ? volume : next);
      if (done) clearInterval(fade);
    }, 60);
    return () => clearInterval(fade);
  }, [volume]);

  // The player takes commands only once it has loaded: say hello and set
  // the volume a few times while it starts up.
  const onLoad = () => {
    const el = frame.current;
    el?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1 }), "*");
    for (const delay of [0, 500, 1500, 3000, 6000]) {
      setTimeout(() => command(el, "setVolume", [volumeRef.current]), delay);
    }
  };

  return (
    <iframe
      ref={frame}
      key={video}
      title="Lo-Fi-Musik"
      src={`https://www.youtube.com/embed/${video}?autoplay=1&enablejsapi=1&playsinline=1&rel=0&controls=0&loop=1&playlist=${video}`}
      allow="autoplay; encrypted-media; picture-in-picture"
      referrerPolicy="strict-origin-when-cross-origin"
      onLoad={onLoad}
      className={className}
    />
  );
}
