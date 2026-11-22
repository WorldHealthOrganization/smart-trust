#!/usr/bin/env bun
/**
 * Officiality is recorded in TWO places, and they must agree.
 *
 * A translation is official only when a person signed it off. That is written
 * per catalogue, as the PO header `X-Folio-Official: yes` (read by
 * `kg-viewer-strings.ts`), and per locale, as `official: true` with
 * `signedOffBy`/`signedOffAt` in `translations/<locale>/status.json`
 * (`schemas/content/translation.ts`). The translation drawer shows both.
 *
 * Disagreements:
 *
 * - `status.json` says official, but a catalogue in that locale does not say
 *   `X-Folio-Official: yes`;
 * - a catalogue says `yes`, but its locale has no `status.json`, or one that
 *   is not official;
 * - `status.json` says official with no `signedOffBy` or `signedOffAt`.
 *
 * Silence on both sides is consistent: unofficial.
 *
 * Exit 0 agree · 1 a disagreement · 2 could not determine, which is never a pass.
 * @covers qa
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { gateDirectoriesForGraph, nothingOwnLine } from "./lib/gate-own.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { noteAbsent, splitDeclared } from "./lib/declared-presence.ts";
import { poHeader } from "./kg-viewer-strings.ts";

export interface OfficialityFinding {
  severity: "disagree" | "unnamed" | "unreadable";
  where: string;
  detail: string;
}

export interface LocaleState {
  /** The locale directory, for messages. */
  dir: string;
  /** `status.json` parsed, `undefined` when absent, `null` when unreadable. */
  status: { official?: unknown; signedOffBy?: unknown; signedOffAt?: unknown } | null | undefined;
  /** Each catalogue's `X-Folio-Official` value, lower-cased; `undefined` when the header is absent. */
  catalogues: { path: string; official: string | undefined }[];
}

/** Findings for one locale. Pure. */
export function officialityFindings(l: LocaleState): OfficialityFinding[] {
  const out: OfficialityFinding[] = [];
  if (l.status === null) {
    return [{ severity: "unreadable", where: join(l.dir, "status.json"), detail: "status.json will not parse" }];
  }
  const statusOfficial = l.status?.official === true;
  if (statusOfficial && (!l.status?.signedOffBy || !l.status?.signedOffAt)) {
    out.push({ severity: "unnamed", where: join(l.dir, "status.json"), detail: "official: true with no signedOffBy or signedOffAt — nobody is named as signing it off" });
  }
  for (const c of l.catalogues) {
    const poOfficial = c.official === "yes";
    if (statusOfficial && !poOfficial) {
      out.push({ severity: "disagree", where: c.path, detail: `status.json says official, but this catalogue says X-Folio-Official: ${c.official ?? "(absent)"}` });
    } else if (poOfficial && !statusOfficial) {
      out.push({ severity: "disagree", where: c.path, detail: `X-Folio-Official: yes, but status.json ${l.status === undefined ? "is absent" : "does not say official"}` });
    }
  }
  return out;
}

/** Every `.po` under a locale directory, recursively. */
function catalogues(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...catalogues(p));
    else if (name.endsWith(".po")) out.push(p);
  }
  return out;
}

export function readLocale(dir: string): LocaleState {
  const statusFile = join(dir, "status.json");
  let status: LocaleState["status"];
  if (existsSync(statusFile)) {
    try { status = JSON.parse(readFileSync(statusFile, "utf-8")) as NonNullable<LocaleState["status"]>; } catch { status = null; }
  }
  return {
    dir,
    status,
    catalogues: catalogues(dir).map((path) => ({ path, official: poHeader(readFileSync(path, "utf-8"), "X-Folio-Official")?.toLowerCase() })),
  };
}

function run(): number {
  // In a layer's PR checks, only the caller's own translations (owner ruling 2026-11-05, "Move the checks"; `lib/gate-own.ts`).
  const { dirs, scoped } = gateDirectoriesForGraph(HARNESS_ROOT, "translation-sources");
  if (scoped && dirs.length === 0) {
    console.log(nothingOwnLine("check:translation-officiality", "translations directory", scoped));
    return 0;
  }
  const { present, absent } = splitDeclared(dirs);
  noteAbsent(absent, "a translations directory");
  if (present.length === 0) {
    console.error("Could not resolve any `translation-sources` directory. This is NOT a pass.");
    return 2;
  }
  const locales = present.flatMap((t) =>
    readdirSync(t).map((d) => join(t, d)).filter((d) => statSync(d).isDirectory()),
  );
  const findings = locales.flatMap((d) => officialityFindings(readLocale(d)));
  const root = join(HARNESS_ROOT, "..");
  for (const f of findings) console.log(`  ${f.severity.padEnd(10)} ${relative(root, f.where)}: ${f.detail}`);
  const nCat = locales.reduce((n, d) => n + catalogues(d).length, 0);
  console.log(`\n  ${locales.length} locale(s), ${nCat} catalogue(s) across ${present.length} translations director(ies); ${findings.length} finding(s)`);
  if (findings.some((f) => f.severity === "unreadable")) return 2;
  return findings.length > 0 ? 1 : 0;
}

if (import.meta.main) process.exit(run());
