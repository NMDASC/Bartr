import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { Geist, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider, AuthQueryPrompt } from "@/components/auth/auth-provider";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { AUTH_COOKIE, readSessionToken } from "@/lib/auth/session";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "Bartr",
  description:
    "A discovery engine and exchange for the businesses that will never be listed. Search them, price them, buy a fraction, acquire the whole thing.",
};

export const viewport: Viewport = {
  themeColor: "#f2f2f2",
  colorScheme: "light",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = readSessionToken(cookieStore.get(AUTH_COOKIE)?.value);

  return (
    <html lang="en" className={`${geist.variable} ${plexMono.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <AuthProvider initialSession={session}>
          <Suspense fallback={null}>
            <AuthQueryPrompt />
          </Suspense>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-primary focus:text-white focus:px-3 focus:py-2 font-mono text-[11px] uppercase"
          >
            Skip to content
          </a>
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
