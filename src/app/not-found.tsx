import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  return (
    <Card className="mx-auto max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">
          <h1>Seite nicht gefunden</h1>
        </CardTitle>
        <CardDescription>Diese Seite gibt es nicht, oder du hast keinen Zugriff darauf.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline">
          <Link href="/">Zur Startseite</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
