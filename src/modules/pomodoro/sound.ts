// The Pomodoro's sounds, made with Web Audio so no audio file is needed:
// a bell when a phase ends, a soft rising chime for the 20-20-20 rule (falling
// again when the 20 seconds are over) and a water drop for drinking. Browsers
// only let a page make sound after a tap or click, so `unlockSound` is called
// from the buttons. Volumes go from 0 to 100.

let context: AudioContext | null = null;

export function unlockSound() {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
  } catch {
    // No Web Audio: the timer stays silent.
  }
}

// Runs `play` with an output at the given volume. Loudness feels logarithmic,
// so the slider is squared: 50 sounds about half as loud as 100.
function withVolume(volume: number, play: (ctx: AudioContext, out: AudioNode, at: number) => void) {
  if (volume <= 0) return;
  unlockSound();
  if (!context) return;
  try {
    const out = context.createGain();
    out.gain.value = (Math.min(100, volume) / 100) ** 2;
    out.connect(context.destination);
    play(context, out, context.currentTime + 0.03);
  } catch {
    // Ignore: a missed sound must not stop the timer.
  }
}

// One sine tone with a quick attack and an exponential fade.
function tone(ctx: AudioContext, out: AudioNode, at: number, frequency: number, gain: number, seconds: number, attack = 0.006) {
  const oscillator = ctx.createOscillator();
  const envelope = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  envelope.gain.setValueAtTime(0.0001, at);
  envelope.gain.exponentialRampToValueAtTime(gain, at + attack);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  oscillator.connect(envelope).connect(out);
  oscillator.start(at);
  oscillator.stop(at + seconds + 0.05);
}

// A struck bell: a fundamental and two inharmonic overtones.
function bell(ctx: AudioContext, out: AudioNode, at: number, gain: number) {
  tone(ctx, out, at, 1568, 0.5 * gain, 1.6);
  tone(ctx, out, at, 1568 * 2.02, 0.18 * gain, 0.8);
  tone(ctx, out, at, 1568 * 2.76, 0.09 * gain, 0.45);
}

export function playBell(volume: number) {
  withVolume(volume, (ctx, out, at) => {
    bell(ctx, out, at, 1);
    bell(ctx, out, at + 0.45, 0.85);
    bell(ctx, out, at + 0.9, 0.7);
  });
}

// Look into the distance: three soft notes going up (E5, G#5, B5).
export function playEyes(volume: number) {
  withVolume(volume, (ctx, out, at) => {
    [659, 831, 988].forEach((frequency, i) => tone(ctx, out, at + i * 0.22, frequency, 0.35, 1.2, 0.04));
  });
}

// The 20 seconds are over: the same notes going down.
export function playEyesDone(volume: number) {
  withVolume(volume, (ctx, out, at) => {
    [988, 659].forEach((frequency, i) => tone(ctx, out, at + i * 0.22, frequency, 0.28, 0.9, 0.03));
  });
}

// The countdown before looking away: a short tick for 5…1, a higher one for "now".
export function playTick(volume: number, go = false) {
  withVolume(volume, (ctx, out, at) => {
    tone(ctx, out, at, go ? 1319 : 880, go ? 0.45 : 0.3, go ? 0.5 : 0.15, 0.004);
  });
}

// Two water drops: a short sine whose pitch jumps up, like a "plop".
export function playDrink(volume: number) {
  withVolume(volume, (ctx, out, at) => {
    for (const [offset, from, to] of [[0, 420, 1300], [0.28, 520, 1600]] as const) {
      const oscillator = ctx.createOscillator();
      const envelope = ctx.createGain();
      const start = at + offset;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(from, start);
      oscillator.frequency.exponentialRampToValueAtTime(to, start + 0.09);
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(0.6, start + 0.01);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      oscillator.connect(envelope).connect(out);
      oscillator.start(start);
      oscillator.stop(start + 0.3);
    }
  });
}

// Shows a notification if the user allowed them, through the service worker
// where there is one, otherwise from the page.
export async function notify(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const options = { body, icon: "/icon-192.png", tag: "pomodoro", data: { url: "/m/pomodoro" } };
  try {
    const registration = await navigator.serviceWorker?.getRegistration("/");
    if (registration) await registration.showNotification(title, options);
    else new Notification(title, options);
  } catch {
    // Ignore: the page still shows what happened.
  }
}

// Calls back right away and then every `ms`, also when the tab is in the background: browsers slow
// a hidden page's own timers down to once a minute, a worker's timer keeps time.
export function ticker(ms: number, onTick: () => void) {
  let worker: Worker | null = null;
  let fallback: ReturnType<typeof setInterval> | null = null;
  try {
    const source = "onmessage = (e) => { postMessage(0); setInterval(() => postMessage(0), e.data); };";
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    worker = new Worker(url);
    URL.revokeObjectURL(url);
    worker.onmessage = onTick;
    worker.postMessage(ms);
  } catch {
    fallback = setInterval(onTick, ms);
    queueMicrotask(onTick);
  }
  return () => {
    worker?.terminate();
    if (fallback) clearInterval(fallback);
  };
}
