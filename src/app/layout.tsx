import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Mukta } from "next/font/google";
import "./globals.css";

const paperDisplay = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], weight: ["600", "700", "800"] });
const paperBody = Mukta({ variable: "--font-mukta", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Bacchaparty — desi party games on your phone",
  description: "Housie, Chor Kaun?, Dumb Charades and more. Play together in one room or across cities — everyone just uses their phone.",
};

export const viewport: Viewport = { themeColor: "#fbf6ee", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${paperDisplay.variable} ${paperBody.variable} antialiased`}>{children}</body>
    </html>
  );
}
