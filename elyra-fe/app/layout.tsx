import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "@aws-amplify/ui-react-liveness/styles.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Elyra — Real connections, thoughtfully made",
  description: "Make room for a real connection.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/">
      <html lang="en" className={`${fraunces.variable} ${plusJakarta.variable}`}>
        <body className="min-h-dvh bg-background font-sans text-foreground antialiased selection:bg-primary/15 selection:text-primary">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
