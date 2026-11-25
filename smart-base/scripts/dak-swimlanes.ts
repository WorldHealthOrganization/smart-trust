#!/usr/bin/env bun
/**
 * dak-swimlanes.ts: a DAK's generic personas, cross-referenced with the
 * swimlanes of its business-process figures, and the gaps between them as QA.
 *
 * Owner, 2026-10-10 (option 1a): "personas/roles should cross link to swimlane
 * in process following cat-harness (and such) QA checks". cat-harness's rule is
 * that a role IS a swimlane, so a persona with no lane and a lane naming no
 * persona are both findings, not things a link quietly papers over.
 *
 * ## Declared, never string-matched
 *
 * Measured on an immunization DAK (bean `cydz`): the lanes say `CHW` where the
 * personas page says `Community health worker`, a pool and its lane share one
 * label (`Vaccination location / Health worker`), a header lane `Function`
 * sits in every figure, and `PCPOSS` names nothing on the personas page. A
 * name match would link some and silently drop the rest. So the mapping is a
 * DECLARATION (`swimlanes.json`): each persona's aliases, and the lane words
 * that are deliberately not personas, each with its reason. Whatever neither
 * accounts for is reported.
 *
 * ## Where the facts come from
 *
 * - Personas: the first column of the personas page's HTML table.
 * - Processes: each enumerated heading of the business-processes page
 *   (`A.  Vaccination location registration`), with the first `.svg` figure
 *   under it.
 * - Lanes: that figure's Visio `visHeadingText` values (`VT4(…)`), which is
 *   where a Visio export keeps a lane's title.
 *
 *   bun run smart-base/scripts/dak-swimlanes.ts --ig-src <IG repo> --map <swimlanes.json> --out <dir> [--check]
 *
 * Writes `<dir>/personas-swimlanes.md` and `<dir>/processes-swimlanes.md` (page
 * annexes) and the QA record at `--qa <path>` (default
 * `<dir>/swimlanes.qa-results.json`). `--check` exits 1 when any written file
 * would change.
 *
 * @module smart-base/scripts/dak-swimlanes
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { DakSwimlaneMapSchema, type DakSwimlaneMap } from "../schemas/dak-annexes.ts";

export type SwimlaneMap = DakSwimlaneMap;

export interface Process {
  letter: string;
  name: string;
  anchor: string;
  figure?: string;
}

/** kramdown's auto_ids. */
export const kramdownId = (t: string) => t.trim().toLowerCase().replace(/[^a-z0-9 -]/g, "").replace(/ /g, "-");

/** A persona's anchor on the personas page. */
export const personaAnchor = (p: string) => `persona-${kramdownId(p.replace(/\([^)]*\)/g, "")).replace(/-+$/, "")}`;

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

export function personasFrom(md: string): string[] {
  return [...md.matchAll(/<tr>\s*<td>([^<]*)<\/td>/g)].map((m) => decode(m[1]!).replace(/\s+/g, " ").trim()).filter(Boolean);
}

export function processesFrom(md: string): Process[] {
  const out: Process[] = [];
  const lines = md.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const h = /^#{2,6}[ \t]+(.+?)[ \t#]*$/.exec(lines[i]!);
    if (!h) continue;
    const text = h[1]!.trim();
    const m = /^([A-Z0-9]{1,3})\s*\.\s+(.+)$/.exec(text);
    if (!m) continue;
    let figure: string | undefined;
    for (let j = i + 1; j < lines.length && !/^#{1,6}\s/.test(lines[j]!); j++) {
      const f = /src="([^"]+\.svg)"/.exec(lines[j]!) ?? /\]\(([^)]+\.svg)\)/.exec(lines[j]!);
      if (f) { figure = f[1]; break; }
    }
    out.push({ letter: m[1]!, name: m[2]!.trim(), anchor: kramdownId(text), ...(figure ? { figure } : {}) });
  }
  return out;
}

/** A Visio export's lane titles. */
export function lanesFrom(svg: string): string[] {
  return [...svg.matchAll(/v:nameU="visHeadingText"[\s\S]*?v:val="VT4\(([\s\S]*?)\)"/g)].map((m) => decode(m[1]!).replace(/\s+/g, " ").trim()).filter(Boolean);
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Which declared personas a lane names, and what of it nothing accounts for. */
export function resolveLane(lane: string, map: SwimlaneMap): { personas: string[]; rest: string } {
  let rest = ` ${lane} `;
  const personas: string[] = [];
  const words = [
    ...Object.entries(map.personas).flatMap(([p, al]) => [p, ...al].map((w) => ({ w, p }))),
    ...Object.keys(map.notPersonas).map((w) => ({ w, p: undefined as string | undefined })),
  ].sort((a, b) => b.w.length - a.w.length);
  for (const { w, p } of words) {
    const re = new RegExp(`(^|[\\s/,])${esc(w)}(?=$|[\\s/,])`, "i");
    if (re.test(rest)) {
      rest = rest.replace(re, "$1 ");
      if (p && !personas.includes(p)) personas.push(p);
    }
  }
  rest = rest.replace(/\b(or|and)\b/gi, " ").replace(/[\s/,]+/g, " ").trim();
  return { personas, rest };
}

export interface Crosswalk {
  rows: { process: Process; lane: string; personas: string[]; rest: string }[];
  personaProcesses: Map<string, Process[]>;
  undeclaredPersonas: string[];
}

export function crosswalk(personas: string[], processes: Process[], lanesOf: (figure: string) => string[], map: SwimlaneMap): Crosswalk {
  const rows: Crosswalk["rows"] = [];
  const personaProcesses = new Map<string, Process[]>(personas.map((p) => [p, []]));
  for (const pr of processes) {
    if (!pr.figure) continue;
    // A figure repeats a lane title (one per lane shape, and the pool's own): one row each.
    for (const lane of [...new Set(lanesOf(pr.figure))]) {
      const r = resolveLane(lane, map);
      rows.push({ process: pr, lane, ...r });
      for (const p of r.personas) {
        const list = personaProcesses.get(p);
        if (list && !list.includes(pr)) list.push(pr);
      }
    }
  }
  return { rows, personaProcesses, undeclaredPersonas: Object.keys(map.personas).filter((p) => !personas.includes(p)) };
}

const NOTE = "<!-- Generated by smart-base/scripts/dak-swimlanes.ts from the personas page, the business-process figures and swimlanes.json. Do not edit; change those and regenerate. -->";

export function personasMarkdown(personas: string[], cw: Crosswalk, processesPage: string): string {
  const lines = [NOTE, "", "### Where each persona appears in the business processes", "",
    "Each generic persona above, with the business processes whose swimlanes name it. A persona with no swimlane is listed too: that is a gap between the personas and the processes, not an omission here.", "",
    "| Persona | Business processes |", "|---|---|"];
  for (const p of personas) {
    const procs = cw.personaProcesses.get(p) ?? [];
    const cell = procs.length ? procs.map((x) => `[${x.letter}. ${x.name}](${processesPage}#${x.anchor})`).join(", ") : "_no swimlane in any process_";
    lines.push(`| <span id="${personaAnchor(p)}"></span>${p} | ${cell} |`);
  }
  return `${lines.join("\n")}\n`;
}

export function processesMarkdown(cw: Crosswalk, map: SwimlaneMap, personasPage: string): string {
  const lines = [NOTE, "", "### Swimlanes and personas", "",
    "The swimlanes of each process figure, and the generic persona each one is. A lane that is deliberately not a persona says why; a lane nothing accounts for is marked.", "",
    "| Process | Swimlane | Persona | Note |", "|---|---|---|---|"];
  for (const r of cw.rows) {
    const persona = r.personas.map((p) => `[${p}](${personasPage}#${personaAnchor(p)})`).join(", ") || "—";
    const why = Object.entries(map.notPersonas).filter(([w]) => new RegExp(`(^|[\\s/,])${esc(w)}($|[\\s/,])`, "i").test(` ${r.lane} `)).map(([, y]) => y);
    const note = r.rest ? `**not a declared persona:** ${r.rest}` : why.join("; ");
    lines.push(`| [${r.process.letter}](#${r.process.anchor}) | ${r.lane} | ${persona} | ${note} |`);
  }
  return `${lines.join("\n")}\n`;
}

export function swimlaneQa(subject: string, producer: { script: string; script_hash: string }, personas: string[], cw: Crosswalk) {
  const noLane = personas.filter((p) => !(cw.personaProcesses.get(p) ?? []).length).map((p) => ({ persona: p }));
  const noPersona = cw.rows.filter((r) => r.rest).map((r) => ({ process: `${r.process.letter}. ${r.process.name}`, figure: r.process.figure, lane: r.lane, unaccounted: r.rest }));
  const undeclared = cw.undeclaredPersonas.map((p) => ({ persona: p }));
  return {
    $schema: "qa-results/v1",
    producer,
    subject: { kind: "fhir-ig", id: subject },
    families: {
      "persona-without-swimlane": { summary: "a generic persona that no business-process swimlane names", count: noLane.length, entries: noLane },
      "swimlane-without-persona": { summary: "a swimlane whose label names no declared persona and is not declared as deliberately not one", count: noPersona.length, entries: noPersona },
      "declared-persona-not-on-page": { summary: "a persona swimlanes.json declares that the personas page does not list", count: undeclared.length, entries: undeclared },
    },
    total: noLane.length + noPersona.length + undeclared.length,
  };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const ig = opt("--ig-src");
  const mapPath = opt("--map");
  const out = opt("--out");
  if (!ig || !mapPath || !out) {
    console.error("usage: dak-swimlanes.ts --ig-src <IG repo> --map <swimlanes.json> --out <dir> [--check] [--subject <ig>]");
    process.exit(2);
  }
  const pc = join(ig, "input", "pagecontent");
  // Parsed, not cast: a declaration this cannot read is refused before it is used.
  const map = DakSwimlaneMapSchema.parse(JSON.parse(readFileSync(mapPath, "utf-8")));
  const personas = personasFrom(readFileSync(join(pc, "personas.md"), "utf-8"));
  const processes = processesFrom(readFileSync(join(pc, "business-processes.md"), "utf-8"));
  const cw = crosswalk(personas, processes, (f) => {
    const p = join(ig, "input", "images", f);
    return existsSync(p) ? lanesFrom(readFileSync(p, "utf-8")) : [];
  }, map);
  const script = "smart-base/scripts/dak-swimlanes.ts";
  const qaPath = opt("--qa") ?? join(out, "swimlanes.qa-results.json");
  const files: Record<string, string> = {
    [join(out, "personas-swimlanes.md")]: personasMarkdown(personas, cw, "business-processes.html"),
    [join(out, "processes-swimlanes.md")]: processesMarkdown(cw, map, "personas.html"),
    [qaPath]: `${JSON.stringify(swimlaneQa(opt("--subject") ?? "ig", { script, script_hash: createHash("sha256").update(readFileSync(import.meta.path)).digest("hex").slice(0, 12) }, personas, cw), null, 2)}\n`,
  };
  let stale = 0;
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(dirname(p), { recursive: true });
    const cur = existsSync(p) ? readFileSync(p, "utf-8") : undefined;
    if (cur === body) continue;
    if (args.includes("--check")) { console.error(`stale: ${p}`); stale++; } else writeFileSync(p, body);
  }
  const qa = JSON.parse(files[qaPath]!) as { families: Record<string, { count: number; entries: unknown[] }> };
  for (const [k, v] of Object.entries(qa.families)) console.error(`${k}: ${v.count}${v.count ? ` — ${JSON.stringify(v.entries)}` : ""}`);
  process.exit(stale ? 1 : 0);
}
