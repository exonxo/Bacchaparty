import type { Metadata } from "next";

// Never indexed, never previewed. The panel also sends noindex headers on every response.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  title: "Admin",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#fbf6ee] text-[#1e1a17]">{children}</div>;
}
