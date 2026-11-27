#!/usr/bin/env bun
/**
 * The DAK components as cards — one square per entry of `DAK_COMPONENTS`.
 *
 * The owner's deck (2026-09-30, slide 3) drew nine coloured cards with testing
 * beside them. The owner's count is ten, so the overview page shows ten squares,
 * and the figure is GENERATED from `smart-base/schemas/dak-kinds.ts` rather than drawn:
 * a component added to the vocabulary without a card here fails
 * {@link renderDakComponentsSvg}, and one marked unformalized gets its note
 * from `DAK_UNFORMALIZED_COMPONENTS` rather than from this file.
 *
 * The card wording is the slide's own, kept as data below; the tenth is the
 * slide's "testing: test data and test harness" beside the overview table's
 * row. Colours follow the slide's palette, with one new pair for the tenth.
 *
 *   bun run smart-base/scripts/gen-dak-components-figure.ts           # write
 *   bun run smart-base/scripts/gen-dak-components-figure.ts --check   # verify
 *
 * ## Why it is smart-base's, and why it still writes into cat-harness's site
 *
 * Moved from `cat-harness/scripts/` in bean `1335`: it is DAK's figure, built
 * from DAK's vocabulary, and `gen-document-kinds.ts` beside it already read
 * its cards. The SVG it writes stays where it was — in cat-harness's docs
 * site, because the page that shows it (the harnessed-KG overview, slide 3)
 * is cat-harness's. smart-base needs cat-harness, so writing into that
 * layer's declared site is the allowed direction; moving the page is a
 * separate decision this move did not take.
 *
 * @module smart-base/scripts/gen-dak-components-figure
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { DAK_COMPONENTS, DAK_UNFORMALIZED_COMPONENTS, type DakComponent } from "../schemas/dak-kinds.ts";
import { siteDirFor } from "../platform/index.js";

interface Card {
  title: string;
  bullets: string[];
  /** Header fill, then body fill. */
  colours: [string, string];
}

/** The slide's wording and palette, keyed by component — never by position. */
export const DAK_CARDS: Record<DakComponent, Card> = {
  "health-interventions-and-recommendations": {
    title: "Health Interventions & Recommendations",
    bullets: ["Relevant health interventions and recommendations from the WHO guideline and guidance.", "To inform DAK scope."],
    colours: ["#002060", "#DAE3F3"],
  },
  "generic-personas": {
    title: "Generic Personas",
    bullets: ["Roles, responsibilities, and essential interventions performed by targeted personas.", "Example for human centered design."],
    colours: ["#0096D6", "#C7E9F8"],
  },
  "user-scenarios": {
    title: "User Scenarios",
    bullets: ["Brief narrative description of how the targeted personas may engage with the digital system.", "Example for human centered design."],
    colours: ["#E8622A", "#FCE0D5"],
  },
  "generic-business-processes-and-workflows": {
    title: "Business Processes & Workflows",
    bullets: ["Generic workflows representing clinical and non-clinical processes.", "To inform when data is collected and used & required features."],
    colours: ["#E0901A", "#FDF0D5"],
  },
  "core-data-elements": {
    title: "Core Data Elements",
    bullets: ["Data elements, used for clinical decision-making, indicators, and other data needs.", "To inform data collection forms and L3 interoperability requirements."],
    colours: ["#A3218E", "#F2CDEB"],
  },
  "decision-support-logic": {
    title: "Decision Support Logic",
    bullets: ["Decision tables representing counselling and treatment algorithms, and any other logic used to determine workflow paths or clinical actions."],
    colours: ["#5B2C83", "#E1D3EE"],
  },
  "scheduling-logic": {
    title: "Scheduling Logic",
    bullets: ["Decision tables representing scheduling logic according to care plans.", "Previously combined with decision support logic."],
    colours: ["#00766F", "#DDF4F2"],
  },
  "programme-indicators": {
    title: "Indicators & Monitoring",
    bullets: ["Indicators for reporting & monitoring with numerator, denominator of data elements.", "Linking person centered data to aggregate."],
    colours: ["#5E9A2E", "#E4F0DA"],
  },
  "functional-and-non-functional-requirements": {
    title: "Functional & Non-functional Requirements",
    bullets: ["A non-exhaustive list of key functions and non-functional requirements for a digital tracking and decision support system.", "To inform system features."],
    colours: ["#6B6B6B", "#EDEDED"],
  },
  "test-scenarios": {
    title: "Test Scenarios",
    bullets: ["Test data and scenarios to check a system against the other nine components.", "A test harness to run them."],
    colours: ["#B3261E", "#F7DAD8"],
  },
};

const COLS = 5;
const CARD_W = 340;
const HEAD_H = 104;
const BODY_H = 250;
const GAP_X = 36;
const GAP_Y = 40;
const MARGIN = 18;
const FONT = "Calibri, Carlito, 'Segoe UI', Arial, sans-serif";

/** Greedy word wrap at a character budget — the slide's text is short and plain. */
function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && (line + " " + word).length > max) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The figure. Throws when a component has no card, or a card no component. */
export function renderDakComponentsSvg(): string {
  const missing = DAK_COMPONENTS.filter((c) => !DAK_CARDS[c]);
  if (missing.length) throw new Error(`no card for DAK component(s): ${missing.join(", ")}`);
  const extra = Object.keys(DAK_CARDS).filter((c) => !(DAK_COMPONENTS as readonly string[]).includes(c));
  if (extra.length) throw new Error(`card(s) for no DAK component: ${extra.join(", ")}`);

  const rows = Math.ceil(DAK_COMPONENTS.length / COLS);
  const width = MARGIN * 2 + COLS * CARD_W + (COLS - 1) * GAP_X;
  const height = MARGIN * 2 + rows * (HEAD_H + BODY_H) + (rows - 1) * GAP_Y;
  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="dak-title dak-desc">`,
    `<!-- GENERATED from smart-base/schemas/dak-kinds.ts DAK_COMPONENTS by smart-base/scripts/gen-dak-components-figure.ts -->`,
    `<title id="dak-title">The ${DAK_COMPONENTS.length} components of a WHO Digital Adaptation Kit</title>`,
    `<desc id="dak-desc">${esc(DAK_COMPONENTS.map((c, i) => `${i + 1} ${DAK_CARDS[c].title}`).join("; "))}.</desc>`,
    `<rect width="${width}" height="${height}" fill="#FFFFFF"/>`,
  );
  DAK_COMPONENTS.forEach((c, i) => {
    const card = DAK_CARDS[c];
    const x = MARGIN + (i % COLS) * (CARD_W + GAP_X);
    const y = MARGIN + Math.floor(i / COLS) * (HEAD_H + BODY_H + GAP_Y);
    const [head, body] = card.colours;
    out.push(`<g>`);
    out.push(`<rect x="${x}" y="${y + HEAD_H}" width="${CARD_W}" height="${BODY_H}" fill="${body}"/>`);
    out.push(`<rect x="${x}" y="${y}" width="${CARD_W}" height="${HEAD_H}" fill="${head}"/>`);
    // Number badge, overlapping the header's top-left corner as on the slide.
    out.push(`<rect x="${x - 14}" y="${y - 12}" width="38" height="38" fill="#000000"/>`);
    out.push(`<text x="${x + 5}" y="${y + 16}" font-family="${FONT}" font-size="24" font-weight="700" fill="#FFFFFF" text-anchor="middle">${i + 1}</text>`);
    const titleLines = wrap(card.title, 22);
    const tFirst = y + HEAD_H / 2 - ((titleLines.length - 1) * 32) / 2 + 9;
    titleLines.forEach((l, k) =>
      out.push(`<text x="${x + CARD_W / 2}" y="${tFirst + k * 32}" font-family="${FONT}" font-size="26" font-weight="700" fill="#FFFFFF" text-anchor="middle">${esc(l)}</text>`),
    );
    let ty = y + HEAD_H + 34;
    for (const b of card.bullets) {
      wrap(b, 26).forEach((l, k) => {
        if (k === 0) out.push(`<text x="${x + 20}" y="${ty}" font-family="${FONT}" font-size="21" fill="#1A1A1A">•</text>`);
        out.push(`<text x="${x + 38}" y="${ty}" font-family="${FONT}" font-size="21" fill="#1A1A1A">${esc(l)}</text>`);
        ty += 26;
      });
      ty += 10;
    }
    if (DAK_UNFORMALIZED_COMPONENTS.includes(c)) {
      out.push(`<text x="${x + CARD_W / 2}" y="${y + HEAD_H + BODY_H - 18}" font-family="${FONT}" font-size="19" font-style="italic" fill="#1A1A1A" text-anchor="middle">*Not yet its own DAK model field</text>`);
    }
    out.push(`</g>`);
  });
  out.push(`</svg>`, ``);
  return out.join("\n");
}

/** cat-harness's layer root — the site the figure is published in. */
const H = resolve(import.meta.dir, "..", "..", "cat-harness");
export const DAK_FIGURE_PATH = join(H, siteDirFor(H), "assets/img/dak-components.svg");

if (import.meta.main) {
  const svg = renderDakComponentsSvg();
  const rel = DAK_FIGURE_PATH.slice(resolve(H, "..").length + 1);
  if (process.argv.includes("--check")) {
    const cur = existsSync(DAK_FIGURE_PATH) ? readFileSync(DAK_FIGURE_PATH, "utf-8") : "";
    if (cur !== svg) {
      console.error(`✗ ${rel} is stale — run \`bun run smart-base/scripts/gen-dak-components-figure.ts\``);
      process.exit(1);
    }
    console.log(`✓ ${rel} is current (${DAK_COMPONENTS.length} components)`);
  } else {
    mkdirSync(dirname(DAK_FIGURE_PATH), { recursive: true });
    writeFileSync(DAK_FIGURE_PATH, svg);
    console.log(`✓ wrote ${rel} (${DAK_COMPONENTS.length} components)`);
  }
}
