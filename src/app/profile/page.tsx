import { ChevronRightIcon, LogOutIcon, ShieldIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { ThemeSetting } from "./theme-setting";

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Profil</h1>
      <Suspense fallback={<Loading />}>
        <ProfileContent />
      </Suspense>
    </div>
  );
}

async function ProfileContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/profile");

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Konto</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 break-all">{user.email}</span>
            {user.isAdmin && <Badge variant="secondary">Admin</Badge>}
          </div>
          <form action="/auth/signout" method="post">
            <Button variant="outline">
              <LogOutIcon />
              Abmelden
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Einstellungen</h2>
          </CardTitle>
          <CardDescription>Gelten für dieses Gerät.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Design</p>
              <p className="text-sm text-muted-foreground">Hell, dunkel oder wie das System.</p>
            </div>
            <ThemeSetting />
          </div>
        </CardContent>
      </Card>

      {user.isAdmin && (
        <Card className="py-0">
          <Link href="/admin" className="flex items-center gap-3 rounded-xl px-6 py-4 hover:bg-accent">
            <ShieldIcon className="size-5 text-muted-foreground" />
            <span className="flex-1">
              <span className="block font-medium">Admin</span>
              <span className="block text-sm text-muted-foreground">Personen, Zugriff, Sichtbarkeit und Feedback</span>
            </span>
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          </Link>
        </Card>
      )}
    </>
  );
}
