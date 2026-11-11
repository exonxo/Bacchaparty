import type { Metadata, Viewport } from "next";
import { Baloo_2 } from "next/font/google";
import "./globals.css";

const baloo = Baloo_2({ variable: "--font-baloo", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "Bacchaparty — desi party games for the whole family",
  description: "Play Dumb Charades, Housie, Chor Kaun? and more on one big screen with everyone's phones as controllers.",
};

export const viewport: Viewport = { themeColor: "#1a0b2e", width: "device-width", initialScale: 1, maximumScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${baloo.variable} antialiased`}>{children}</body>
    </html>
  );
}
