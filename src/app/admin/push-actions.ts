"use server";

import { after } from "next/server";
import webpush, { type PushSubscription, WebPushError } from "web-push";
import { requireAdmin } from "@/lib/auth";

// Test-only: the browser sends its own subscription with every call, so
// nothing is stored. Real notifications (e.g. "Training fällt aus") will need
// a table of subscriptions per user.

export type PushResult = { ok: true } | { ok: false; error: string };

export async function sendTestPush(
  subscription: PushSubscription,
  message: { title: string; body: string; delaySeconds: number },
): Promise<PushResult> {
  const user = await requireAdmin();

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return { ok: false, error: "NEXT_PUBLIC_VAPID_PUBLIC_KEY und VAPID_PRIVATE_KEY fehlen in den Umgebungsvariablen." };
  }

  // Push services are fixed https hosts (FCM, Mozilla, Apple); refuse anything
  // else so this can't be used to make the server call arbitrary URLs.
  let endpoint: URL;
  try {
    endpoint = new URL(subscription?.endpoint);
  } catch {
    return { ok: false, error: "Ungültige Subscription." };
  }
  if (endpoint.protocol !== "https:" || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return { ok: false, error: "Ungültige Subscription." };
  }

  const payload = JSON.stringify({
    title: message.title.trim().slice(0, 100) || "Private Lab",
    body: message.body.trim().slice(0, 300),
    url: "/admin",
  });
  const options = {
    // Apple rejects pushes without a contact address in the VAPID subject.
    vapidDetails: { subject: `mailto:${user.email}`, publicKey, privateKey },
    TTL: 60,
  };

  const delay = Math.min(Math.max(Math.round(message.delaySeconds), 0), 30);
  if (delay > 0) {
    // Answer right away so the app can be closed; send after the response.
    after(async () => {
      await new Promise((resolve) => setTimeout(resolve, delay * 1000));
      try {
        await webpush.sendNotification(subscription, payload, options);
      } catch (error) {
        console.error("Delayed test push failed", error);
      }
    });
    return { ok: true };
  }

  try {
    await webpush.sendNotification(subscription, payload, options);
    return { ok: true };
  } catch (error) {
    if (error instanceof WebPushError) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        return { ok: false, error: "Die Subscription ist abgelaufen. Bitte abmelden und neu erlauben." };
      }
      return { ok: false, error: `Push-Dienst antwortet ${error.statusCode}: ${error.body || error.message}` };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Senden fehlgeschlagen." };
  }
}
