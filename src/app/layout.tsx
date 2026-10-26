import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Private Lab",
  description: "A personal sandbox for small apps and prototypes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-foreground/10">
          <nav className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-3 text-sm">
            <Link href="/" className="font-semibold">
              Private Lab
            </Link>
            <div className="ml-auto flex items-center gap-4">
              <Suspense>
                <NavActions />
              </Suspense>
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
      </body>
    </html>
  );
}

// Reads the session, so it streams in behind the Suspense boundary above.
async function NavActions() {
  const user = await getCurrentUser();
  if (!user) return <Link href="/login">Sign in</Link>;

  return (
    <>
      {user.isAdmin && <Link href="/admin">Admin</Link>}
      <form action="/auth/signout" method="post">
        <button className="opacity-70 hover:opacity-100">Sign out</button>
      </form>
    </>
  );
}
