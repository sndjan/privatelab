// The sound of a small kitchen timer: two bright "dings", made with Web Audio
// so no audio file is needed. Browsers only let a page make sound after a tap
// or click, so `unlockSound` is called from the buttons.

let context: AudioContext | null = null;

export function unlockSound() {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
  } catch {
    // No Web Audio: the timer stays silent.
  }
}

function bell(ctx: AudioContext, at: number, volume: number) {
  // A struck bell: a fundamental and two inharmonic overtones that die away at different speeds.
  for (const [frequency, gain, seconds] of [[2093, 1, 1.4], [4186 * 1.02, 0.35, 0.7], [2093 * 2.76, 0.18, 0.4]] as const) {
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(volume * gain, at + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
    oscillator.connect(envelope).connect(ctx.destination);
    oscillator.start(at);
    oscillator.stop(at + seconds + 0.05);
  }
}

export function ding() {
  if (!context) return;
  try {
    if (context.state === "suspended") void context.resume();
    const now = context.currentTime + 0.02;
    bell(context, now, 0.16);
    bell(context, now + 0.42, 0.12);
  } catch {
    // Ignore: a missed sound must not stop the timer.
  }
}

// Shows a notification if the user allowed them, through the service worker
// where there is one (needed on phones), otherwise from the page.
export async function notify(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const options = { body, icon: "/icon-192.png", tag: "fokus", data: { url: "/m/fokus" } };
  try {
    const registration = await navigator.serviceWorker?.getRegistration("/");
    if (registration) await registration.showNotification(title, options);
    else new Notification(title, options);
  } catch {
    // Ignore: the page still shows what happened.
  }
}

// Calls back after `ms`, also when the tab is in the background: browsers slow
// a hidden page's own timers down to once a minute, a worker's timer keeps time.
export function alarm(ms: number, onFire: () => void) {
  let worker: Worker | null = null;
  let fallback: ReturnType<typeof setTimeout> | null = null;
  try {
    const source = "onmessage = (e) => setTimeout(() => postMessage(0), e.data);";
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    worker = new Worker(url);
    URL.revokeObjectURL(url);
    worker.onmessage = onFire;
    worker.postMessage(ms);
  } catch {
    fallback = setTimeout(onFire, ms);
  }
  return () => {
    worker?.terminate();
    if (fallback) clearTimeout(fallback);
  };
}
