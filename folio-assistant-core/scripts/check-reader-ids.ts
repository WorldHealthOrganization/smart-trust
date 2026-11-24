#!/usr/bin/env bun
/**
 * check-reader-ids — flag machine ids shown to the reader in a DTH's prose.
 *
 *   bun run folio-assistant-core/scripts/check-reader-ids.ts \
 *     --document <name> [--folio folio/<name>] [--strict] [--json <file>]
 *
 * The rule is `refer-by-number-and-title-not-by-id` in the
 * who-digital-transformation-handbook voice: point the reader to another part
 * by its number or title, linked, and keep the id in the link target and the
 * model files. This is that rule's script check (owner choice Q-IDS-1 A).
 *
 * Text inside a link target `](...)` is never read, so `[Health worker](#pers:health-worker)`
 * passes. Flagged, everywhere else in a block's `.md`:
 *
 * - `label`: a block label such as `pers:health-worker` or `freq:FR-ID-01`.
 * - `model-id`: a BPMN or DMN element id such as `Task_4_1_Select` or `Rule_DT02_01`.
 * - `path`: a repository path such as `processes/PC-BP-01.bpmn`.
 * - `tool-note`: a modelling note such as "hit policy FIRST".
 *
 * Requirement and role codes (FR-ID-01, HRH-R-3) are not flagged: a catalogue
 * table shows them as data. Neither are other backticked values, which are
 * often coded values a system stores.
 *
 * A block whose `.md` holds `<!-- reader-ids: allow -->` is skipped, for the
 * rare page that documents the model itself.
 *
 * Prints one line per finding and exits 0, so it can run as a QA report.
 * `--strict` exits 1 when anything is found. `--json` writes the findings.
 *
 * @graphNode none — a check over a folio's prose, not a schema
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

export type Kind = "label" | "model-id" | "path" | "tool-note";
export interface Finding {
  file: string;
  line: number;
  kind: Kind;
  text: string;
}

const LABEL_PREFIXES = ["freq", "nfreq", "pers", "scen", "de", "bp", "dt", "sec", "chap", "fig", "tbl", "annex", "g"];

export const PATTERNS: Record<Kind, RegExp> = {
  label: new RegExp(`(?<![\\w#/-])(?:${LABEL_PREFIXES.join("|")}):[A-Za-z0-9](?:[\\w.-]*[A-Za-z0-9])?`, "g"),
  "model-id": /\b(?:Task|Rule|Decision|Lane|Gateway|Event|Process|Activity|StartEvent|EndEvent|Flow)_[A-Za-z0-9_]+/g,
  path: /(?<![\w.-])[\w-]+(?:\/[\w.-]+)+\.(?:ts|py|json|md|bpmn|dmn|svg|xlsx|jsonld)\b/g,
  "tool-note": /\bhit policy\b/gi,
};

export const ALLOW_MARKER = "<!-- reader-ids: allow -->";

/** Replace HTML comment spans (`<!-- ... -->`) with spaces while preserving newlines. */
export function stripComments(text: string): string {
  let out = "";
  let pos = 0;
  while (pos < text.length) {
    const start = text.indexOf("<!--", pos);
    if (start < 0) {
      out += text.slice(pos);
      break;
    }
    out += text.slice(pos, start);
    const end = text.indexOf("-->", start + 4);
    const stop = end < 0 ? text.length : end + 3;
    for (let i = start; i < stop; i++) {
      out += text[i] === "\n" ? "\n" : " ";
    }
    pos = stop;
  }
  return out;
}

/** Link targets (`](...)`) and HTML comments removed: they are not shown. */
export function shown(line: string): string {
  return stripComments(line).replace(/\]\([^)]*\)/g, "]");
}

/** The findings in one block's Markdown. */
export function scan(md: string, file = ""): Finding[] {
  if (md.includes(ALLOW_MARKER)) return [];
  const out: Finding[] = [];
  stripComments(md).split("\n").forEach((raw, i) => {
    const line = shown(raw);
    for (const [kind, rx] of Object.entries(PATTERNS) as Array<[Kind, RegExp]>) {
      for (const m of line.matchAll(rx)) out.push({ file, line: i + 1, kind, text: m[0] });
    }
  });
  return out;
}

function* markdown(dir: string): Generator<string> {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* markdown(p);
    else if (name.endsWith(".md")) yield p;
  }
}

/** Every finding under a folio directory, with paths relative to `root`. */
export function scanFolio(folio: string, root = process.cwd()): Finding[] {
  const out: Finding[] = [];
  for (const f of markdown(folio)) out.push(...scan(readFileSync(f, "utf-8"), relative(root, f)));
  return out;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.main) {
  const document = arg("document");
  const folio = resolve(arg("folio") ?? (document ? join("folio", document) : ""));
  if (!document && !arg("folio")) {
    console.error("usage: check-reader-ids.ts --document <name> [--folio folio/<name>] [--strict] [--json <file>]");
    process.exit(2);
  }
  if (!existsSync(folio)) {
    console.error(`✗ no folio at ${folio}`);
    process.exit(2);
  }
  const found = scanFolio(folio);
  const json = arg("json");
  if (json) writeFileSync(json, JSON.stringify(found, null, 1) + "\n");
  for (const f of found) console.log(`${f.file}:${f.line}: ${f.kind} ${f.text}`);
  const files = new Set(found.map((f) => f.file)).size;
  if (found.length === 0) {
    console.log("✓ no machine ids in reader text");
  } else {
    console.log(`${found.length} machine id(s) in reader text, in ${files} block file(s): link with titles instead (voice rule refer-by-number-and-title-not-by-id)`);
  }
  process.exit(found.length && process.argv.includes("--strict") ? 1 : 0);
}
