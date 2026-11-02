"use client";

import { BellIcon, BellOffIcon, SendIcon, TimerIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendTestPush } from "./push-actions";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type Support = "checking" | "unsupported" | "ios-not-installed" | "supported";

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

// The layout only registers the service worker in production; here it is
// registered on demand so the test also works with `next dev` on localhost.
async function getRegistration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (!existing) await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  return navigator.serviceWorker.ready;
}

// Admin-only test of web push: allow notifications on this device, show one
// locally, and send a real push through the server (now or in 10 s, so the
// app can be closed or the phone locked first).
export function PushTest() {
  const [support, setSupport] = useState<Support>("checking");
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [title, setTitle] = useState("Test vom Tennisverein 🎾");
  const [body, setBody] = useState("Platz 3 ist jetzt frei.");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    let next: Support = "supported";
    if (isIOS && !standalone) next = "ios-not-installed";
    else if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) next = "unsupported";

    // Reads browser-only state once after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupport(next);
    if (next !== "supported") return;
    setPermission(Notification.permission);
    navigator.serviceWorker
      .getRegistration("/")
      .then((registration) => registration?.pushManager.getSubscription())
      .then((existing) => setSubscription(existing ?? null));
  }, []);

  async function subscribe() {
    if (!vapidPublicKey) return;
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        toast.error("Benachrichtigungen wurden nicht erlaubt. Das lässt sich in den Website-Einstellungen ändern.");
        return;
      }
      const registration = await getRegistration();
      const created = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      setSubscription(created);
      toast.success("Dieses Gerät empfängt jetzt Push-Nachrichten.");
    } catch (error) {
      toast.error(`Anmelden fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    try {
      await subscription?.unsubscribe();
      setSubscription(null);
    } finally {
      setBusy(false);
    }
  }

  async function showLocal() {
    const registration = await getRegistration();
    await registration.showNotification(title || "Private Lab", { body, icon: "/icon-192.png", data: { url: "/admin" } });
  }

  async function send(delaySeconds: number) {
    if (!subscription) return;
    setBusy(true);
    try {
      const result = await sendTestPush(subscription.toJSON() as Parameters<typeof sendTestPush>[0], {
        title,
        body,
        delaySeconds,
      });
      if (!result.ok) toast.error(result.error);
      else if (delaySeconds > 0) toast.success(`Kommt in ${delaySeconds} Sekunden. Jetzt App schließen oder Handy sperren.`);
      else toast.success("Gesendet.");
    } catch (error) {
      toast.error(`Senden fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  if (support === "checking") return null;
  if (support === "ios-not-installed") {
    return (
      <p className="text-sm text-muted-foreground">
        Auf dem iPhone gehen Push-Nachrichten nur aus der installierten App: in Safari auf Teilen → „Zum Home-Bildschirm“
        tippen, die App vom Home-Bildschirm öffnen und hierher zurückkommen (iOS 16.4 oder neuer).
      </p>
    );
  }
  if (support === "unsupported") {
    return <p className="text-sm text-muted-foreground">Dieser Browser unterstützt keine Push-Nachrichten.</p>;
  }
  if (!vapidPublicKey) {
    return (
      <p className="text-sm text-muted-foreground">
        Es fehlen VAPID-Schlüssel: einmal <code className="font-mono">npx web-push generate-vapid-keys</code> ausführen und{" "}
        <code className="font-mono">NEXT_PUBLIC_VAPID_PUBLIC_KEY</code> und <code className="font-mono">VAPID_PRIVATE_KEY</code>{" "}
        setzen (lokal in <code className="font-mono">.env.local</code>, sonst beim Hoster), dann neu bauen.
      </p>
    );
  }

  const pushService = subscription ? new URL(subscription.endpoint).host : null;

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Erlaubnis</dt>
        <dd>{{ granted: "erlaubt", denied: "blockiert", default: "noch nicht gefragt" }[permission]}</dd>
        <dt className="text-muted-foreground">Dieses Gerät</dt>
        <dd>{pushService ? `angemeldet (${pushService})` : "nicht angemeldet"}</dd>
      </dl>

      {permission === "denied" ? (
        <p className="text-sm text-muted-foreground">
          Benachrichtigungen sind für diese Seite blockiert. Erlauben lässt es sich nur in den Website- bzw.
          App-Einstellungen des Geräts.
        </p>
      ) : subscription ? (
        <>
          <div className="grid max-w-md gap-3">
            <div className="space-y-2">
              <Label htmlFor="push-title">Titel</Label>
              <Input id="push-title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="push-body">Text</Label>
              <Input id="push-body" value={body} onChange={(event) => setBody(event.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy} onClick={() => send(0)}>
              <SendIcon /> Push senden
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => send(10)}>
              <TimerIcon /> In 10 Sekunden
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={showLocal} title="Ohne Server, prüft nur die Anzeige">
              <BellIcon /> Lokal anzeigen
            </Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={unsubscribe}>
              <BellOffIcon /> Abmelden
            </Button>
          </div>
        </>
      ) : (
        <Button type="button" disabled={busy} onClick={subscribe}>
          <BellIcon /> Benachrichtigungen erlauben
        </Button>
      )}
    </div>
  );
}
