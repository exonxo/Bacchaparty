/** Theme F skip/reverse design options — comparison HTML (not shipped). */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const INK = "#1e1a17";
const FILL = { sindoor: "#E03A2F", neel: "#1E5FD8" } as const;

type SkipId = "S1" | "S2" | "S3";
type ReverseId = "R1" | "R2" | "R3";
type Spec = { id: SkipId | ReverseId; kind: "skip" | "reverse" };

const SPECS: Spec[] = [
  { id: "S1", kind: "skip" },
  { id: "S2", kind: "skip" },
  { id: "S3", kind: "skip" },
  { id: "R1", kind: "reverse" },
  { id: "R2", kind: "reverse" },
  { id: "R3", kind: "reverse" },
];

function wrapCenter(child: ReactNode) {
  return createElement(
    "span",
    { className: "inline-flex shrink-0 items-center justify-center", style: { width: 118, height: 118 }, "data-puno-center-art": true },
    child,
  );
}

function wrapCorner(child: ReactNode, inverted?: boolean) {
  return createElement(
    "span",
    { className: `inline-flex h-5 w-5 items-center justify-center text-ink ${inverted ? "rotate-180" : ""}` },
    child,
  );
}

// —— Skip centre art ——

function CenterS1() {
  return createElement(
    "svg",
    { viewBox: "0 0 100 100", className: "block h-full w-full", "aria-hidden": true },
    createElement(
      "g",
      { transform: "translate(50 50)" },
      createElement("circle", { cx: 0, cy: 0, r: 32, fill: "#fffdf8", stroke: INK, strokeWidth: 4 }),
      createElement("line", { x1: -22, y1: -22, x2: 22, y2: 22, stroke: INK, strokeWidth: 7, strokeLinecap: "square" }),
    ),
  );
}

function CornerS1() {
  return createElement(
    "svg",
    { viewBox: "0 0 24 24", className: "block h-full w-full", "aria-hidden": true, fill: "none", stroke: INK },
    createElement("circle", { cx: 12, cy: 12, r: 8.5, strokeWidth: 2.6 }),
    createElement("line", { x1: 6.5, y1: 6.5, x2: 17.5, y2: 17.5, strokeWidth: 2.8, strokeLinecap: "square" }),
  );
}

function CenterS2() {
  return createElement(
    "svg",
    { viewBox: "0 0 100 100", className: "block h-full w-full", "aria-hidden": true },
    createElement(
      "g",
      { transform: "translate(50 52)" },
      createElement("ellipse", { cx: 0, cy: -14, rx: 22, ry: 26, fill: "#fffdf8", stroke: INK, strokeWidth: 3.8 }),
      createElement("path", {
        d: "M-28 18 Q-28 32 0 36 Q28 32 28 18 L28 26 L-28 26 Z",
        fill: "#fffdf8",
        stroke: INK,
        strokeWidth: 3.8,
        strokeLinejoin: "round",
      }),
      createElement("line", { x1: -34, y1: -36, x2: 34, y2: 38, stroke: INK, strokeWidth: 8, strokeLinecap: "square" }),
    ),
  );
}

function CornerS2() {
  return createElement(
    "svg",
    { viewBox: "0 0 24 24", className: "block h-full w-full", "aria-hidden": true },
    createElement("ellipse", { cx: 12, cy: 8.5, rx: 5.5, ry: 6.5, fill: "#fffdf8", stroke: INK, strokeWidth: 1.8 }),
    createElement("path", { d: "M6 14 Q6 17 12 18 Q18 17 18 14", fill: "none", stroke: INK, strokeWidth: 1.8 }),
    createElement("line", { x1: 4, y1: 4, x2: 20, y2: 20, stroke: INK, strokeWidth: 2.6, strokeLinecap: "square" }),
  );
}

function CenterS3() {
  const oct = "M0,-34 L28,-10 L28,22 L0,34 L-28,22 L-28,-10 Z";
  return createElement(
    "svg",
    { viewBox: "0 0 100 100", className: "block h-full w-full", "aria-hidden": true },
    createElement(
      "g",
      { transform: "translate(50 50)" },
      createElement("polygon", { points: oct, fill: "#fffdf8", stroke: INK, strokeWidth: 4, strokeLinejoin: "round" }),
      createElement("rect", { x: -22, y: -6, width: 44, height: 12, rx: 1, fill: INK }),
    ),
  );
}

function CornerS3() {
  const oct = "M12,3 L20,8 L20,16 L12,21 L4,16 L4,8 Z";
  return createElement(
    "svg",
    { viewBox: "0 0 24 24", className: "block h-full w-full", "aria-hidden": true },
    createElement("polygon", { points: oct, fill: "#fffdf8", stroke: INK, strokeWidth: 1.6, strokeLinejoin: "round" }),
    createElement("rect", { x: 7, y: 11, width: 10, height: 3, fill: INK }),
  );
}

// —— Reverse centre art ——

function CenterR1() {
  return createElement(
    "svg",
    { viewBox: "0 0 100 100", className: "block h-full w-full", "aria-hidden": true },
    createElement(
      "g",
      { transform: "translate(50 50)" },
      createElement("ellipse", { cx: 0, cy: 0, rx: 34, ry: 30, fill: "#fffdf8", stroke: INK, strokeWidth: 3 }),
      createElement(
        "g",
        { fill: "none", stroke: INK, strokeWidth: 5.5, strokeLinecap: "round", strokeLinejoin: "round" },
        createElement("path", { d: "M20 -12 A 24 24 0 1 0 -12 20" }),
        createElement("path", { d: "M-20 12 A 24 24 0 1 0 12 -20" }),
      ),
      createElement("polygon", { points: "14,-24 22,-14 28,-22", fill: INK }),
      createElement("polygon", { points: "-14,24 -22,14 -28,22", fill: INK }),
    ),
  );
}

function CornerR1() {
  return createElement(
    "svg",
    { viewBox: "0 0 24 24", className: "block h-full w-full", "aria-hidden": true, fill: "none", stroke: INK },
    createElement("path", { d: "M16 6 A 8 8 0 1 0 8 16", strokeWidth: 2.4, strokeLinecap: "round" }),
    createElement("path", { d: "M8 18 A 8 8 0 1 0 16 8", strokeWidth: 2.4, strokeLinecap: "round" }),
    createElement("polygon", { points: "17,4 20,9 14,9", fill: INK, stroke: "none" }),
    createElement("polygon", { points: "7,20 4,15 10,15", fill: INK, stroke: "none" }),
  );
}

function CenterR2() {
  return createElement(
    "svg",
    { viewBox: "0 0 100 100", className: "block h-full w-full", "aria-hidden": true },
    createElement(
      "g",
      { transform: "translate(50 50) rotate(-8)" },
      createElement("rect", { x: -38, y: -38, width: 76, height: 76, rx: 8, fill: "#fffdf8", stroke: INK, strokeWidth: 3 }),
      // top-right arrow →
      createElement("path", {
        d: "M-28 -20 L18 -20 L18 -30 L32 -16 L18 -2 L18 -12 L-28 -12 Z",
        fill: INK,
      }),
      // bottom-left arrow ←
      createElement("path", {
        d: "M28 20 L-18 20 L-18 30 L-32 16 L-18 2 L-18 12 L28 12 Z",
        fill: INK,
      }),
    ),
  );
}

function CornerR2() {
  return createElement(
    "svg",
    { viewBox: "0 0 24 24", className: "block h-full w-full", "aria-hidden": true },
    createElement("path", { d: "M3 8 L14 8 L14 5 L20 11 L14 17 L14 14 L3 14 Z", fill: INK }),
    createElement("path", { d: "M21 16 L10 16 L10 19 L4 13 L10 7 L10 10 L21 10 Z", fill: INK }),
  );
}

function CenterR3() {
  return createElement(
    "svg",
    { viewBox: "0 0 100 100", className: "block h-full w-full", "aria-hidden": true },
    createElement(
      "g",
      { transform: "translate(50 50)" },
      createElement("path", {
        d: "M-26 28 L-26 -8 Q-26 -32 0 -32 Q26 -32 26 -8",
        fill: "none",
        stroke: INK,
        strokeWidth: 9,
        strokeLinecap: "square",
        strokeLinejoin: "round",
      }),
      createElement("polygon", { points: "26,-8 26,10 10,-2", fill: INK }),
      createElement("circle", { cx: -26, cy: 28, r: 6, fill: INK }),
    ),
  );
}

function CornerR3() {
  return createElement(
    "svg",
    { viewBox: "0 0 24 24", className: "block h-full w-full", "aria-hidden": true, fill: "none", stroke: INK },
    createElement("path", {
      d: "M5 18 L5 9 Q5 4 12 4 Q19 4 19 9",
      strokeWidth: 3.2,
      strokeLinecap: "square",
      strokeLinejoin: "round",
    }),
    createElement("polygon", { points: "19,9 19,13 15,11", fill: INK, stroke: "none" }),
    createElement("circle", { cx: 5, cy: 18, r: 2.2, fill: INK, stroke: "none" }),
  );
}

function artFor(id: SkipId | ReverseId, slot: "center" | "corner"): ReactNode {
  const map: Record<string, () => ReactNode> = {
    S1: slot === "center" ? CenterS1 : CornerS1,
    S2: slot === "center" ? CenterS2 : CornerS2,
    S3: slot === "center" ? CenterS3 : CornerS3,
    R1: slot === "center" ? CenterR1 : CornerR1,
    R2: slot === "center" ? CenterR2 : CornerR2,
    R3: slot === "center" ? CenterR3 : CornerR3,
  };
  return map[id]();
}

function OptionCard({ bg, id }: { bg: string; id: SkipId | ReverseId }) {
  const corner = artFor(id, "corner");
  const center = wrapCenter(artFor(id, "center"));
  const frameStyle = {
    width: 168,
    height: 238,
    boxShadow: "5px 5px 0 0 #1e1a17",
    borderWidth: 4,
    borderStyle: "solid" as const,
    borderColor: INK,
  };
  const faceStyle = { background: bg, boxShadow: "inset 0 0 0 2px #fffdf8" };
  return createElement(
    "div",
    {
      className: "font-display relative shrink-0 rounded-[18px] border-ink bg-paper p-0",
      style: frameStyle,
    },
    createElement(
      "div",
      { className: "relative h-full w-full overflow-hidden rounded-[14px]", style: faceStyle },
      createElement("span", { className: "absolute left-2.5 top-2.5 z-20 leading-none" }, wrapCorner(corner)),
      createElement("span", { className: "absolute bottom-2.5 right-2.5 z-20 leading-none" }, wrapCorner(corner, true)),
      createElement(
        "div",
        { className: "absolute inset-0 z-[1] flex items-center justify-center", "data-puno-center-mount": true },
        center,
      ),
    ),
  );
}

const scale = 2;
const cardW = 168 * scale;
const cardH = 238 * scale;

const rows = SPECS.map((spec) => {
  const cells = (["sindoor", "neel"] as const).map((color) =>
    createElement(
      "div",
      { key: `${spec.id}-${color}`, className: "opt-cell", style: { width: cardW } },
      createElement(
        "div",
        { style: { transform: `scale(${scale})`, transformOrigin: "top left", width: 168, height: 238 } },
        createElement(OptionCard, { bg: FILL[color], id: spec.id }),
      ),
      createElement("p", { className: "sub" }, color === "sindoor" ? "sindoor" : "neel"),
    ),
  );
  return createElement(
    "div",
    { key: spec.id, className: "row-block" },
    createElement("p", { className: "row-title" }, spec.kind === "skip" ? `Ruk Ja · ${spec.id}` : `Ulta · ${spec.id}`),
    createElement("div", { className: "row-cards" }, ...cells),
    createElement("p", { className: "opt-label" }, spec.id),
  );
});

const body = renderToStaticMarkup(
  createElement(
    "div",
    { className: "sheet" },
    createElement("h1", { className: "title" }, "Skip & reverse — Theme F options"),
    createElement("p", { className: "lede" }, "S1–S3 skip · R1–R3 reverse · sindoor & neel · corners match centre"),
    ...rows,
  ),
);

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<script src="https://cdn.tailwindcss.com"></script>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #ebe4d8; font-family: system-ui, sans-serif; color: #1e1a17; }
  .sheet { padding: 20px 24px 32px; max-width: 900px; }
  .title { margin: 0 0 6px; font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; }
  .lede { margin: 0 0 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; opacity: 0.75; }
  .row-block { margin-bottom: 28px; }
  .row-title { margin: 0 0 8px; font-size: 12px; font-weight: 800; text-transform: uppercase; }
  .row-cards { display: flex; gap: 20px; align-items: flex-start; }
  .opt-cell { flex: 0 0 auto; }
  .sub { margin: 4px 0 0; font-size: 9px; font-weight: 800; text-transform: uppercase; opacity: 0.7; }
  .opt-label { margin: 8px 0 0; font-size: 22px; font-weight: 900; letter-spacing: 0.08em; }
</style></head><body>${body}</body></html>`;

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".tmp");
mkdirSync(outDir, { recursive: true });
const htmlPath = path.join(outDir, "puno-skip-reverse-options.html");
writeFileSync(htmlPath, html);
console.log(htmlPath);
