import type { Metadata, Viewport } from "next";
import { Baloo_2, Bebas_Neue, Bricolage_Grotesque, Mukta, Nunito_Sans } from "next/font/google";
import "./globals.css";

const paperDisplay = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], weight: ["600", "700", "800"] });
const paperBody = Mukta({ variable: "--font-mukta", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
// BAWAAL brand type (landing): Bebas Neue display, Baloo 2 accent, Nunito Sans body.
const bwDisplay = Bebas_Neue({ variable: "--font-bebas", subsets: ["latin"], weight: "400" });
const bwAccent = Baloo_2({ variable: "--font-baloo", subsets: ["latin"], weight: ["600", "700", "800"] });
const bwBody = Nunito_Sans({ variable: "--font-nunito", subsets: ["latin"], weight: ["400", "600", "700", "800"] });

const description =
  "Desi party games for your family and friends. Put it on the big screen, join from your phones, and let the madness begin.";

export const metadata: Metadata = {
  metadataBase: new URL("https://playbawaal.vercel.app"),
  title: "BAWAAL — Ghar mein sab hain? Toh BAWAAL karo!",
  description,
  applicationName: "BAWAAL",
  appleWebApp: { title: "BAWAAL" },
  openGraph: { type: "website", siteName: "BAWAAL", title: "BAWAAL — desi party games", description },
  twitter: { card: "summary_large_image", title: "BAWAAL — desi party games", description },
};

export const viewport: Viewport = { themeColor: "#fbf6ee", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${paperDisplay.variable} ${paperBody.variable} ${bwDisplay.variable} ${bwAccent.variable} ${bwBody.variable} antialiased`}>{children}</body>
    </html>
  );
}
