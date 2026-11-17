import Image from "next/image";
import Link from "next/link";

const CONTACT = "proloykarmakar25@gmail.com"; // same address as the Privacy Policy

/** Open Doodles (CC0) party crowd peeking over the footer wall. `mobile` = shown on small screens too. */
const CROWD = [
  { name: "selfie", w: 522, h: 739, rot: "-rotate-6", mobile: false },
  { name: "groovy", w: 912, h: 747, rot: "rotate-3", mobile: true },
  { name: "moshing", w: 632, h: 731, rot: "-rotate-3", mobile: false },
  { name: "loving", w: 856, h: 615, rot: "rotate-2", mobile: false },
  { name: "dancing", w: 835, h: 707, rot: "-rotate-2", mobile: true },
  { name: "jumping", w: 849, h: 689, rot: "rotate-6", mobile: false },
];

const COLUMNS: { title: string; links: { href: string; label: string; external?: boolean }[] }[] = [
  {
    title: "Games",
    links: [
      { href: "/games", label: "All games" },
      { href: "/games/chor-kaun", label: "Chor Kaun?" },
      { href: "/games/housie", label: "Housie" },
      { href: "/games/charades", label: "Dumb Charades" },
    ],
  },
  {
    title: "How it works",
    links: [
      { href: "/#how", label: "Teen steps" },
      { href: "/host", label: "Start a BAWAAL" },
      { href: "/join", label: "Join a party" },
    ],
  },
  { title: "Privacy", links: [{ href: "/privacy", label: "Privacy Policy" }] },
  { title: "Contact", links: [{ href: `mailto:${CONTACT}`, label: "Email us", external: true }] },
];

const linkClass = "inline-flex min-h-11 items-center text-white/90 underline decoration-transparent decoration-2 underline-offset-4 hover:text-white hover:decoration-bw-yellow";

export function BrandFooter() {
  return (
    <footer className="relative">
      {/* The crowd: bottoms are clipped by the wall, so they peek over it. */}
      <div className="relative h-24 overflow-hidden bg-bw-cream lg:h-32" aria-hidden>
        <div className="pointer-events-none absolute inset-0 text-bw-orange opacity-20 bw-halftone" />
        <div className="absolute inset-x-0 top-3 mx-auto flex max-w-6xl items-start justify-around gap-2 px-2 sm:top-4">
          {CROWD.map((c) => (
            <Image
              key={c.name}
              src={`/illustrations/${c.name}.svg`}
              alt=""
              width={c.w}
              height={c.h}
              unoptimized
              className={`${c.mobile ? "block" : "hidden md:block"} h-32 w-auto shrink-0 md:h-28 lg:h-40 ${c.rot}`}
            />
          ))}
        </div>
      </div>

      <div className="relative border-t-[4px] border-bw-ink bg-bw-ink px-4 pb-8 pt-10 text-white">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <Image src="/brand/bawaal-logo.webp" alt="BAWAAL" width={800} height={267} className="h-14 w-auto" />
            <p className="mt-3 max-w-xs text-base text-white/85">Desi party games for your family and friends.</p>
          </div>
          <nav className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4" aria-label="Footer">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h2 className="font-bw-display text-2xl tracking-wide text-bw-yellow">{col.title}</h2>
                <ul className="mt-1">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      {l.external ? (
                        <a href={l.href} className={linkClass}>
                          {l.label}
                        </a>
                      ) : (
                        <Link href={l.href} className={linkClass}>
                          {l.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="mx-auto mt-8 flex max-w-6xl flex-col gap-2 border-t-2 border-white/15 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-bw-accent text-lg font-bold text-bw-yellow">Made with chai and chaos in India.</p>
          <p className="text-xs text-white/60">
            Illustrations: <a href="https://www.opendoodles.com" className="underline">Open Doodles</a> by Pablo Stanley (CC0), recoloured.
          </p>
        </div>
      </div>
    </footer>
  );
}
