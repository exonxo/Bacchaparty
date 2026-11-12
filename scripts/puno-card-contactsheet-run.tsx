/** Renders a Puno card contact sheet HTML for Playwright capture (not shipped). */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CardFace } from "../src/games/puno/Cards";
import type { PunoCard, PunoColor } from "../src/games/puno/shared";

const COLORS: PunoColor[] = ["haldi", "sindoor", "mehndi", "neel"];
const ACTIONS = ["ruk-ja", "ulta", "do-le"] as const;

function specimens(): PunoCard[] {
  const out: PunoCard[] = [];
  for (const color of COLORS) {
    for (const value of [0, 5, 9] as const) {
      out.push({ id: `n${value}-${color}`, color, kind: "number", value });
    }
    for (const value of ACTIONS) {
      out.push({ id: `${value}-${color}`, color, kind: "action", value });
    }
  }
  out.push({ id: "wild-rb", color: "wild", kind: "wild", value: "rang-badal" });
  out.push({ id: "wild-cl", color: "wild", kind: "wild", value: "chaar-le" });
  return out;
}

const cards = specimens();
const scale = 2;
const w = 168 * scale;
const h = 238 * scale;

const grid = cards.map((card) =>
  createElement(
    "div",
    { key: card.id, className: "contact-cell", "data-card-id": card.id, style: { width: w, height: h } },
    createElement(
      "div",
      { style: { transform: `scale(${scale})`, transformOrigin: "top left", width: 168, height: 238 } },
      createElement(CardFace, { card, size: "fan" }),
    ),
    createElement("p", { className: "label" }, `${card.color} · ${card.value}`),
  ),
);

const body = renderToStaticMarkup(createElement("div", { className: "grid" }, ...grid));

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<script src="https://cdn.tailwindcss.com"></script>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #ebe4d8; font-family: system-ui, sans-serif; }
  .grid { display: grid; grid-template-columns: repeat(6, ${w + 8}px); gap: 12px; padding: 16px; align-items: start; }
  .contact-cell { position: relative; }
  .label { margin: 6px 0 0; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #1e1a17; }
</style></head><body>${body}</body></html>`;

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".tmp");
mkdirSync(outDir, { recursive: true });
const htmlPath = path.join(outDir, "puno-card-contactsheet.html");
writeFileSync(htmlPath, html);
console.log(htmlPath);
