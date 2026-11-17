import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Mukta } from "next/font/google";
import "./globals.css";

const paperDisplay = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], weight: ["600", "700", "800"] });
const paperBody = Mukta({ variable: "--font-mukta", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

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
      <body className={`${paperDisplay.variable} ${paperBody.variable} antialiased`}>{children}</body>
    </html>
  );
}
