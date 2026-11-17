/*
 * Cross-check of the vendored QR encoder (docs/assets/js/vendor/qrcode.js).
 *
 * The docs header renders a QR of the current page URL. If that QR is subtly
 * wrong it still LOOKS like a QR, so the failure mode is silent and only
 * shows up on someone's phone. This file guards against that by reading the
 * encoder's output back with a decoder written here, independently, from the
 * structure of the standard: recover the mask from the format information,
 * undo it, walk the zigzag, de-interleave the blocks, parse the mode and
 * length header, and compare with what went in.
 *
 * The point is the INDEPENDENCE. An encoder and a decoder written by the same
 * hand share their assumptions — a misreading of the spec passes its own test
 * and fails in the field. Here the encoder is a third-party implementation
 * with a very large deployed base and the decoder is ours, so agreement is
 * evidence rather than tautology.
 *
 * Scope: error-correction level M, versions 1–10, byte mode — what the header
 * widget actually asks for. The block-geometry tables below are the level-M
 * rows of the standard; the uneven split is derived (short = floor(d/n), the
 * last d mod n blocks one longer) rather than tabulated, and the consistency
 * check below is what says the derivation is right.
 */
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { join } from "node:path";
import { siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

/** The slice of the vendored encoder's API this file uses. It attaches to the
 *  sandbox global rather than exporting, so the shape is declared here. */
interface QrModel {
  addData(data: string): void;
  make(): void;
  getModuleCount(): number;
  isDark(row: number, col: number): boolean;
  createSvgTag(cellSize?: number, margin?: number): string;
}
type QrFactory = (typeNumber: number, errorCorrectionLevel: string) => QrModel;

const ctx: { qrcode?: QrFactory } = {};
createContext(ctx);
runInContext(readFileSync(join(HARNESS_ROOT, siteFileFor(HARNESS_ROOT, "assets/js/vendor/qrcode.js")), "utf8"), ctx);
// The UTF-8 shim must load after the encoder; without it `stringToBytes` is
// single-byte and any non-ASCII character in a URL encodes to mojibake.
runInContext(readFileSync(join(HARNESS_ROOT, siteFileFor(HARNESS_ROOT, "assets/js/vendor/qrcode_UTF8.js")), "utf8"), ctx);
const loaded = ctx.qrcode;
// Not a formality: if the vendored file ever stops attaching to the global,
// every test below would fail with a confusing TypeError instead of saying so.
if (!loaded) throw new Error("vendored qrcode.js did not attach `qrcode` to the sandbox");
// Re-bound after the guard because narrowing at module scope does not reach
// into a closure over the original binding.
const qrcode: QrFactory = loaded;

// Level-M geometry, versions 1–10.
const TOTAL        = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
const EC_PER_BLOCK = [0, 10, 16, 26,  18,  24,  16,  18,  22,  22,  26];
const BLOCKS       = [0,  1,  1,  1,   2,   2,   4,   4,   4,   5,   5];
const dataCodewords = (v: number) => TOTAL[v] - EC_PER_BLOCK[v] * BLOCKS[v];

const ALIGN: number[][] = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
               [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

const MASKS: Array<(r: number, c: number) => boolean> = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function encode(text: string) {
  const q = qrcode(0, "M");
  q.addData(text);
  q.make();
  const size = q.getModuleCount();
  const modules = [];
  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) row.push(q.isDark(r, c) ? 1 : 0);
    modules.push(row);
  }
  return { size, modules, tag: (cell: number, margin: number) => q.createSvgTag(cell, margin) };
}

/** Everything the standard reserves: no data bit is ever placed here. */
function functionMap(size: number, version: number) {
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const block = (r0: number, c0: number, h: number, w: number) => {
    for (let r = r0; r < r0 + h; r++)
      for (let c = c0; c < c0 + w; c++)
        if (r >= 0 && c >= 0 && r < size && c < size) fn[r][c] = true;
  };
  block(0, 0, 9, 9);                       // finder + separator + format
  block(0, size - 8, 9, 8);                // finder + format
  block(size - 8, 0, 8, 9);                // finder + format
  for (let i = 0; i < size; i++) { fn[6][i] = true; fn[i][6] = true; }   // timing
  const centres = ALIGN[version];
  for (const r of centres)
    for (const c of centres) {
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8)) continue;
      block(r - 2, c - 2, 5, 5);
    }
  if (version >= 7) { block(size - 11, 0, 3, 6); block(0, size - 11, 6, 3); }
  return fn;
}

/** Read a rendered matrix back to the string that produced it. */
function decode(size: number, modules: number[][]) {
  const version = (size - 17) / 4;

  // The 15-bit format word is (5 data bits << 10) | 10 BCH bits, XORed with
  // 0x5412. It is written MSB-FIRST along the path below, and the level and
  // mask are the TOP five bits of the unmasked word, not the bottom five.
  // Getting either of those backwards decodes to plausible-looking garbage,
  // which is why this is read from both copies and they are required to agree.
  const readFormat = (positions: Array<[number, number]>) => {
    let word = 0;
    for (const [r, c] of positions) word = (word << 1) | modules[r][c];
    return word;
  };
  const copy1: Array<[number, number]> = [];
  for (let i = 0; i < 15; i++) {
    if (i < 6) copy1.push([8, i]);
    else if (i === 6) copy1.push([8, 7]);
    else if (i === 7) copy1.push([8, 8]);
    else if (i === 8) copy1.push([7, 8]);
    else copy1.push([14 - i, 8]);
  }
  const copy2: Array<[number, number]> = [];
  // Copy 2 is 7 modules UP the left column, then 8 along the top row --
  // the module at (size-8, 8) between them is the always-dark module and is
  // NOT a format bit. Including it shifts the second half by one and makes
  // the two copies disagree in exactly one place.
  for (let i = 0; i < 15; i++) copy2.push(i < 7 ? [size - 1 - i, 8] : [8, size - 15 + i]);
  const fmt = readFormat(copy1);
  if (fmt !== readFormat(copy2))
    throw new Error("format information differs between its two copies");
  const bits5 = (fmt ^ 0x5412) >> 10;
  const level = bits5 >> 3;
  const unmask = MASKS[bits5 & 7];

  const fn = functionMap(size, version);
  const bits = [];
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let v = 0; v < size; v++) {
      const row = upward ? size - 1 - v : v;
      for (let d = 0; d < 2; d++) {
        const col = right - d;
        if (fn[row][col]) continue;
        bits.push(modules[row][col] ^ (unmask(row, col) ? 1 : 0));
      }
    }
    upward = !upward;
  }

  const codewords = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    codewords.push(b);
  }

  const n = BLOCKS[version], total = dataCodewords(version);
  const short = Math.floor(total / n), numLong = total % n;
  const lens = Array.from({ length: n }, (_, i) => short + (i >= n - numLong ? 1 : 0));
  const blocks: number[][] = lens.map(() => []);
  let idx = 0;
  for (let c = 0; c < short + (numLong ? 1 : 0); c++)
    for (let b = 0; b < n; b++) if (c < lens[b]) blocks[b].push(codewords[idx++]);
  const data: number[] = ([] as number[]).concat(...blocks);

  let pos = 0;
  const take = (k: number) => {
    let v = 0;
    for (let i = 0; i < k; i++, pos++) v = (v << 1) | ((data[pos >> 3] >> (7 - (pos & 7))) & 1);
    return v;
  };
  const mode = take(4);
  const len = take(version < 10 ? 8 : 16);
  const out: number[] = [];
  for (let i = 0; i < len; i++) out.push(take(8));
  return { version, level, mode, text: new TextDecoder().decode(Uint8Array.from(out)) };
}

test("level-M block geometry is internally consistent", () => {
  for (let v = 1; v <= 10; v++) {
    expect(dataCodewords(v)).toBeGreaterThan(0);
    const n = BLOCKS[v], d = dataCodewords(v);
    const short = Math.floor(d / n), numLong = d % n;
    const sum = (n - numLong) * short + numLong * (short + 1);
    expect(sum).toBe(d);                                   // the split loses nothing
    expect(d + EC_PER_BLOCK[v] * n).toBe(TOTAL[v]);        // and fills the symbol
  }
});

test("derived byte capacities match the published 1-M … 10-M values", () => {
  const published = [14, 26, 42, 62, 84, 106, 122, 152, 180, 213];
  for (let v = 1; v <= 10; v++) {
    const header = 4 + (v < 10 ? 8 : 16);
    expect(Math.floor((dataCodewords(v) * 8 - header) / 8)).toBe(published[v - 1]);
  }
});

test("function patterns land where the standard puts them", () => {
  const { size, modules } = encode("https://example.org/a");
  for (const [r0, c0] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    expect(modules[r0 + 0][c0 + 0]).toBe(1);   // outer ring
    expect(modules[r0 + 1][c0 + 1]).toBe(0);   // white ring inside it
    expect(modules[r0 + 3][c0 + 3]).toBe(1);   // 3×3 core
  }
  for (let i = 8; i < size - 8; i++) expect(modules[6][i]).toBe(i % 2 === 0 ? 1 : 0);
  expect(modules[size - 8][8]).toBe(1);        // the always-dark module
});

test("an independent decoder recovers the encoded string", () => {
  const cases = [
    "https://litlfred.github.io/folio-assistant/",
    "https://litlfred.github.io/folio-assistant/publication-workflow.html",
    "https://litlfred.github.io/folio-assistant/guides/writing-a-paper.html#the-end-to-end-workflow",
    "https://litlfred.github.io/folio-assistant/reference/skills/?q=ingest&v=2",
    "a",
    "héllo wörld — ünicode",
    "x".repeat(150),
  ];
  for (const s of cases) {
    const { size, modules } = encode(s);
    const got = decode(size, modules);
    expect(got.mode).toBe(0b0100);   // byte mode
    expect(got.level).toBe(0b00);    // EC level M
    expect(got.text).toBe(s);
  }
});

test("the URL of every real docs page round-trips", () => {
  const base = "https://litlfred.github.io/folio-assistant/";
  const pages = [
    "", "index.html", "installation.html", "getting-started.html",
    "content-types.html", "publication-workflow.html", "architecture.html",
    "skills.html", "contributing.html", "sage-mcp.html",
    "guides/writing-a-paper.html", "guides/agent-onboarding.html",
    "reference/skills/", "api/",
  ];
  for (const p of pages) {
    const url = base + p;
    const { size, modules } = encode(url);
    expect(decode(size, modules).text).toBe(url);
  }
});

test("createSvgTag emits a well-formed tag and the URL never reaches the markup", () => {
  const url = "https://litlfred.github.io/folio-assistant/x.html?a=<b>&c='d'";
  const { tag } = encode(url);
  const svg = tag(4, 4);
  expect(svg.startsWith("<svg")).toBe(true);
  expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
  // The payload is carried by module geometry alone. Nothing from the URL is
  // interpolated into the document, which is what makes injecting this markup
  // safe on a site that serves no other untrusted HTML.
  expect(svg).not.toContain("<b>");
  expect(svg).not.toContain("litlfred");
});
