/**
 * A web app's UI strings, through the harness's translation process.
 *
 * @module scripts/web-app-strings
 * @covers web-app
 *
 * The same shape as `translate-kg-viewer.ts`: the app's catalog is the SOURCE
 * table, the template goes to `translations/<locale>/apps/<id>.pot` in the
 * declaring layer, translators (agent or human) fill the `.po` beside it
 * under `multi-locale-translation` and `translation-refresh`, and the app's
 * build reads the `.po` and writes `<out>/<locale>.json` — building IS the
 * injection, as `kg:viewer` embedding its catalogues is.
 *
 * Each string is one entry: `msgctxt` is its catalog key, `msgid` its source
 * text, kind `ui-string`. Two keys with the same text stay two entries, since
 * the context differs.
 *
 * Drift fails (a stale template, a translation that drops a `{placeholder}`
 * the app substitutes); coverage only reports, because the app falls back to
 * the source text per string.
 */
import { join } from "node:path";

import { formatPot, potWithoutTimestamp, type PotEntry } from "../pipeline/pot-extract.js";
import { parsePoStrings, poKey } from "../schemas/content/po-strings.ts";
import type { WebApp } from "../schemas/ui/web-app.ts";

/** Where a layer keeps an app's template and translations, relative to the layer root. */
export function appPoPath(app: Pick<WebApp, "id">, locale: string, ext: "pot" | "po"): string {
  // declared-path-literal: a path RELATIVE to the layer root, joined by callers that hold no declaration (a scratch layer in the tests); `translation-sources` is `translations/` in every layer that declares it.
  return join("translations", locale, "apps", `${app.id}.${ext}`);
}

/** A flat catalog, checked: every value a non-empty string. Throws naming the bad keys. */
export function readCatalog(raw: unknown, where: string): Record<string, string> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`${where}: a catalog is a flat JSON object { key: text }`);
  const bad = Object.entries(raw as Record<string, unknown>).filter(([, v]) => typeof v !== "string" || v === "").map(([k]) => k);
  if (bad.length > 0) throw new Error(`${where}: not a non-empty string at ${bad.slice(0, 5).join(", ")}${bad.length > 5 ? ` and ${bad.length - 5} more` : ""}`);
  return raw as Record<string, string>;
}

/** The template entries for a catalog, in key order. */
export function potEntries(catalog: Record<string, string>, catalogPath: string): PotEntry[] {
  return Object.keys(catalog)
    .sort()
    .map((key) => ({ source: catalogPath, line: 1, msgid: catalog[key]!, msgctxt: key, kind: "ui-string" as const }));
}

/** The template text for one locale. */
export function appPot(app: Pick<WebApp, "id" | "title">, catalog: Record<string, string>, catalogPath: string, locale: string): string {
  return formatPot(potEntries(catalog, catalogPath), { projectName: `${app.title} (${app.id})`, locale });
}

/** Whether a template on disk says the same as a fresh one, ignoring its creation date. */
export function potCurrent(onDisk: string | undefined, fresh: string): boolean {
  return onDisk !== undefined && potWithoutTimestamp(onDisk) === potWithoutTimestamp(fresh);
}

const PLACEHOLDER = /\{[A-Za-z0-9_]+\}/g;
const placeholders = (s: string): string[] => [...(s.match(PLACEHOLDER) ?? [])].sort();

/** What one locale's translations give the app, and what is wrong or missing. */
export interface LocaleStrings {
  /** The translated strings, by key: only those that keep every placeholder. */
  strings: Record<string, string>;
  /** Keys with no translation yet: reported, not failed. */
  missing: string[];
  /** Keys whose translation drops or adds a placeholder: a failure. */
  placeholderErrors: string[];
  /** Translations for strings the catalog no longer has: a failure. */
  stale: string[];
}

/** One locale's `.po` text against the catalog. */
export function localeStrings(catalog: Record<string, string>, poText: string): LocaleStrings {
  const po = parsePoStrings(poText);
  const out: LocaleStrings = { strings: {}, missing: [], placeholderErrors: [], stale: [] };
  const known = new Set<string>();
  for (const [key, src] of Object.entries(catalog)) {
    const k = poKey(key, src);
    known.add(k);
    const t = po.get(k);
    if (t === undefined) { out.missing.push(key); continue; }
    if (placeholders(t).join() !== placeholders(src).join()) { out.placeholderErrors.push(key); continue; }
    out.strings[key] = t;
  }
  for (const k of po.keys()) if (!known.has(k)) out.stale.push(k.split("\u0004")[0] || k);
  return out;
}
