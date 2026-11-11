import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const body = Inter({ variable: "--font-inter", subsets: ["latin"] });
const display = Outfit({ variable: "--font-outfit", subsets: ["latin"], weight: ["500", "600", "700", "800", "900"] });

export const metadata: Metadata = {
  title: "Bacchaparty — desi party games on your phone",
  description: "Housie, Chor Kaun?, Dumb Charades and more. Play together in one room or across cities — everyone just uses their phone.",
};

export const viewport: Viewport = { themeColor: "#0b0b10", width: "device-width", initialScale: 1, maximumScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${body.variable} ${display.variable} antialiased`}>{children}</body>
    </html>
  );
}
