import type { Metadata, Viewport } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { CircleUserRoundIcon, LogInIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Feedback } from "@/components/feedback";
import { AllModulesLink, HeaderBrand, HeaderBrandFallback } from "@/components/header-brand";
import { ServiceWorker } from "@/components/service-worker";
import { Button } from "@/components/ui/button";
import { RememberSession } from "@/components/session-hint";
import { getCurrentUser } from "@/lib/auth";
import { sessionScript } from "@/lib/session-hint";
import { themeColors, themeScript } from "@/lib/theme";
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

// The theme-color meta (status bar) is rendered below and kept in sync with the
// light/dark setting by themeScript. viewport-fit=cover lets the page draw
// behind Android's navigation bar (Chrome 135+), so the bar takes on the
// page's background instead of staying white; the body pads for it.
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`${instrumentSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
      // themeScript sets data-theme before React hydrates.
      suppressHydrationWarning
    >
      <head>
        <meta name="theme-color" content={themeColors.light} suppressHydrationWarning />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: sessionScript }} />
      </head>
      <body className="flex min-h-full flex-col pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]">
        <header className="border-b bg-card">
          <nav className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
            {/* The module name needs the URL, which is only known per request. */}
            <Suspense fallback={<HeaderBrandFallback />}>
              <HeaderBrand />
            </Suspense>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {/* Until the session is checked, shows the signed-in icons if the
                  browser remembers being signed in (see lib/session-hint). */}
              <Suspense
                fallback={
                  <div className="hidden signed-in:contents">
                    <SignedInActions />
                  </div>
                }
              >
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
      <>
        <RememberSession hint={null} />
        <Button asChild variant="ghost" size="icon" className="text-muted-foreground">
          <Link href="/login" aria-label="Anmelden" title="Anmelden">
            <LogInIcon />
          </Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <RememberSession hint={{ isAdmin: user.isAdmin }} />
      <SignedInActions />
    </>
  );
}

function SignedInActions() {
  return (
    <>
      <AllModulesLink />
      <Feedback />
      <Button asChild variant="ghost" size="icon" className="text-muted-foreground">
        <Link href="/profile" aria-label="Profil und Einstellungen" title="Profil">
          <CircleUserRoundIcon className="size-5" />
        </Link>
      </Button>
    </>
  );
}
