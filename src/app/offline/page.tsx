import type { Metadata } from "next";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Offline · Private Lab" };

export default function OfflinePage() {
  return (
    <Card className="mx-auto max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">
          <h1>Keine Verbindung</h1>
        </CardTitle>
        <CardDescription>
          Du bist gerade offline. Sobald du wieder verbunden bist, lade die Seite neu.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
