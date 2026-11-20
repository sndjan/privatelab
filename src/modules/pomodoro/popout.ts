"use client";

import { useCallback, useEffect, useState } from "react";

// A small window with only the timer, like a mini player. Where the browser
// has Document Picture-in-Picture (Chrome, Edge) it floats above all other
// windows; elsewhere it is a small popup window. Either way it is an empty
// page of the same origin that the app renders into with a portal, so the
// timer keeps running in the main tab and both always show the same clock.

type DocumentPip = { requestWindow(options: { width: number; height: number }): Promise<Window> };

const WIDTH = 320;
const HEIGHT = 300;

async function openWindow(): Promise<Window | null> {
  let win: Window | null = null;
  const pip = (window as Window & { documentPictureInPicture?: DocumentPip }).documentPictureInPicture;
  if (pip) {
    try {
      win = await pip.requestWindow({ width: WIDTH, height: HEIGHT });
    } catch {
      win = null;
    }
  }
  if (!win) {
    const left = Math.max(0, window.screenX + window.outerWidth - WIDTH - 40);
    const top = Math.max(0, window.screenY + 80);
    win = window.open("", "pomodoro-mini", `popup=yes,width=${WIDTH},height=${HEIGHT},left=${left},top=${top}`);
    if (!win) return null;
    win.document.open();
    win.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Pomodoro</title></head><body></body></html>');
    win.document.close();
  }
  copyLook(win.document);
  return win;
}

// The new page starts empty: give it the app's stylesheets, fonts and theme.
function copyLook(target: Document) {
  const base = target.createElement("base");
  base.href = location.origin;
  target.head.appendChild(base);
  for (const node of document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style')) {
    if (node instanceof HTMLLinkElement) {
      const link = target.createElement("link");
      link.rel = "stylesheet";
      link.href = node.href;
      target.head.appendChild(link);
    } else {
      const style = target.createElement("style");
      style.textContent = node.textContent;
      target.head.appendChild(style);
    }
  }
  for (const attribute of ["class", "data-theme", "style", "lang"]) {
    const value = document.documentElement.getAttribute(attribute);
    if (value !== null) target.documentElement.setAttribute(attribute, value);
  }
  target.body.className = `${document.body.className} bg-background text-foreground antialiased`;
}

export function usePopout() {
  const [win, setWin] = useState<Window | null>(null);

  const open = useCallback(async () => {
    if (win && !win.closed) {
      win.focus();
      return true;
    }
    const opened = await openWindow();
    setWin(opened);
    return Boolean(opened);
  }, [win]);

  const close = useCallback(() => {
    win?.close();
    setWin(null);
  }, [win]);

  useEffect(() => {
    if (!win) return;
    const closed = () => setWin(null);
    const closeWithPage = () => win.close();
    win.addEventListener("pagehide", closed);
    window.addEventListener("pagehide", closeWithPage);
    // A popup does not always say goodbye: look whether it is still there.
    const poll = setInterval(() => {
      if (win.closed) closed();
    }, 1000);
    return () => {
      win.removeEventListener("pagehide", closed);
      window.removeEventListener("pagehide", closeWithPage);
      clearInterval(poll);
    };
  }, [win]);

  return { win, open, close };
}
