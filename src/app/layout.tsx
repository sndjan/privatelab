import type { Metadata, Viewport } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { ServiceWorker } from "@/components/service-worker";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Private Lab",
  description: "Eine private Spielwiese für kleine Apps und Prototypen.",
  appleWebApp: { capable: true, title: "Private Lab", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#181e1b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`${instrumentSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="border-b bg-card">
          <nav className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
            <Link href="/" className="font-semibold">
              Private Lab
            </Link>
            <div className="ml-auto flex items-center gap-1">
              <Suspense>
                <NavActions />
              </Suspense>
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <ServiceWorker />
      </body>
    </html>
  );
}

// Reads the session, so it streams in behind the Suspense boundary above.
async function NavActions() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Button asChild variant="outline">
        <Link href="/login">Anmelden</Link>
      </Button>
    );
  }

  return (
    <>
      {user.isAdmin && (
        <Button asChild variant="ghost">
          <Link href="/admin">Admin</Link>
        </Button>
      )}
      <form action="/auth/signout" method="post">
        <Button variant="ghost" className="text-muted-foreground">
          Abmelden
        </Button>
      </form>
    </>
  );
}
