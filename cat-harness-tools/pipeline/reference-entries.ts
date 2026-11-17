/**
 * A folio's bibliography entries, wherever they are kept: one CSL-JSON file
 * per entry (`folio-reference/v1`, bean folio-assistant-63q4 / qou-l7pj), or
 * the `ref({ … })` calls of a `references.ts` module, or both at once.
 *
 * qou split its 915-entry `references.ts` into `folio/references/<key>.json`,
 * keeping only entries built by code (its own paper's) inline. Readers that
 * regex-scan the module for entry bodies would then see only those few, and
 * say so nowhere. This is the one place that knows both layouts, so each
 * reader asks it rather than reading a path.
 *
 * Read, never executed: the module is TypeScript, and these readers want a
 * few strings per entry, not the validated objects.
 *
 * @module cat-harness-tools/pipeline/reference-entries
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { directoriesForGraph, folioDir } from "../schemas/kg/cat-harness.js";

/** One entry, as data when it is a file and as source text when it is a `ref({…})` call. */
export type ReferenceEntry =
  | { kind: "file"; id: string; file: string; text: string; data: Record<string, unknown> }
  | { kind: "module"; id: string; file: string; text: string; offset: number };

/**
 * The per-entry directory: every declared `references` directory of the folio
 * at `repoRoot`, else `<folio>/references/` when it exists. A folio pinned to a
 * platform that does not yet know the `references` kind cannot declare it
 * (qou-l7pj), so the convention is read too.
 */
export function referenceDirs(repoRoot: string): string[] {
  let declared: string[] = [];
  try {
    declared = directoriesForGraph(repoRoot, "references");
  } catch {
    declared = [];
  }
  if (declared.length) return declared.filter((d) => existsSync(d));
  let folio: string | undefined;
  try {
    folio = folioDir(repoRoot);
  } catch {
    folio = undefined;
  }
  // declared-path-literal: the convention fallback when no `references` directory is declared, at the call site so the choice is visible.
  const conventional = folio ? join(folio, "references") : undefined;
  if (conventional && existsSync(conventional)) return [conventional];
  // declared-path-literal: the same convention fallback, at the repository root.
  const rootConventional = join(repoRoot, "references");
  return existsSync(rootConventional) ? [rootConventional] : [];
}

/** `<folio>/schema/references.ts`, when the folio has one. */
export function referencesModule(repoRoot: string): string | undefined {
  let folio: string | undefined;
  try {
    folio = folioDir(repoRoot);
  } catch {
    return undefined;
  }
  const p = join(folio, "schema", "references.ts");
  return existsSync(p) ? p : undefined;
}

/**
 * Every entry: the files (by name), then the module's `ref({…})` calls not
 * already read from a file, and then ordered as the module orders them.
 *
 * The order is the module's because readers depend on it. When one arXiv id
 * appears in two entries, the later one claims it, and `references.bib` is
 * written in array order. A split folio keeps that order in the module (qou's
 * `ORDER`, one `{ id: "<key>" }` line per entry), so every entry the module
 * names comes at its first mention, and the rest follow by name.
 */
export function referenceEntries(repoRoot: string): ReferenceEntry[] {
  const entries = unorderedEntries(repoRoot);
  const mod = referencesModule(repoRoot);
  if (!mod) return entries;
  const src = readFileSync(mod, "utf-8");
  const at = new Map<string, number>();
  for (const m of src.matchAll(/\bid:\s*"([^"]+)"/g)) if (!at.has(m[1]!)) at.set(m[1]!, m.index!);
  const rank = (e: ReferenceEntry) => at.get(e.id) ?? Number.POSITIVE_INFINITY;
  return entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => rank(a.e) - rank(b.e) || a.i - b.i)
    .map(({ e }) => e);
}

/** All reference keys present on disk (`.json`, `.jsonld`, or `schema/references.ts`). */
export function referenceEntryIds(repoRoot: string): Set<string> {
  return new Set(referenceEntries(repoRoot).map((e) => e.id));
}

function normaliseJsonLdData(raw: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = { ...raw };
  if (typeof data.id !== "string" && typeof data["@id"] === "string") {
    data.id = (data["@id"] as string).replace(/^references\//, "");
  }
  if (typeof data.title !== "string" && typeof data["dcterms:title"] === "string") {
    data.title = data["dcterms:title"];
  }
  if (!Array.isArray(data.author) && Array.isArray(data["dcterms:creator"])) {
    data.author = (data["dcterms:creator"] as unknown[])
      .filter((c): c is string => typeof c === "string")
      .map((c) => {
        const i = c.indexOf(",");
        return i < 0 ? { literal: c.trim() } : { family: c.slice(0, i).trim(), given: c.slice(i + 1).trim() };
      });
  }
  if (data.issued === undefined && typeof data["dcterms:issued"] === "string") {
    const m = /^(\d{4})/.exec(data["dcterms:issued"] as string);
    if (m) data.issued = { "date-parts": [[Number(m[1])]] };
  }
  if (typeof data.DOI !== "string" && typeof data["bibo:doi"] === "string") {
    data.DOI = data["bibo:doi"];
  }
  if (typeof data.URL !== "string" && typeof data["dcterms:identifier"] === "string") {
    data.URL = data["dcterms:identifier"];
  }
  return data;
}

function unorderedEntries(repoRoot: string): ReferenceEntry[] {
  const out: ReferenceEntry[] = [];
  const seen = new Set<string>();
  for (const dir of referenceDirs(repoRoot)) {
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".json") || f.endsWith(".jsonld"))
      .sort((a, b) => {
        // Prefer `.json` before `.jsonld` when both exist for the same key.
        const aBase = a.replace(/\.jsonld$|\.json$/, "");
        const bBase = b.replace(/\.jsonld$|\.json$/, "");
        return aBase.localeCompare(bBase) || a.length - b.length;
      });
    for (const f of files) {
      const file = join(dir, f);
      const text = readFileSync(file, "utf-8");
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(text) as Record<string, unknown>;
      } catch {
        continue;
      }
      const data = f.endsWith(".jsonld") ? normaliseJsonLdData(parsed) : parsed;
      const id = typeof data.id === "string" ? data.id : undefined;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({ kind: "file", id, file, text, data });
    }
  }
  const mod = referencesModule(repoRoot);
  if (mod) {
    const src = readFileSync(mod, "utf-8");
    // A call starts a line. Mentioned in a comment (qou's header names
    // `ref({…})`; a merge note names `ref({ id: "orellana1998" })`), the
    // unanchored pattern began there and swallowed the entries that followed.
    for (const m of src.matchAll(/^[ \t]*ref\(\{(.*?)\n\s*\}\)/gms)) {
      const id = m[1]!.match(/\bid:\s*"([^"]+)"/)?.[1];
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({ kind: "module", id, file: mod, text: m[1]!, offset: m.index! });
    }
  }
  return out;
}

// ── Field readers that work on either kind ───────────────────────────────────

/** A top-level string field. For a module entry, the first `field: "…"` literal, unescaped. */
export function stringField(e: ReferenceEntry, field: string): string | undefined {
  if (e.kind === "file") {
    const v = e.data[field];
    return typeof v === "string" ? v : undefined;
  }
  const key = /^[A-Za-z_$][\w$]*$/.test(field) ? field : `"${field}"`;
  const re = new RegExp(`(?:^|\\n)\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*"((?:[^"\\\\]|\\\\.)*)"`);
  const m = e.text.match(re);
  return m ? m[1]!.replace(/\\"/g, '"') : undefined;
}

/** The first year of `issued`. */
export function issuedYear(e: ReferenceEntry): string | undefined {
  if (e.kind === "file") {
    const issued = e.data.issued as { "date-parts"?: unknown[][] } | undefined;
    const y = issued?.["date-parts"]?.[0]?.[0];
    return y === undefined ? undefined : String(y);
  }
  return e.text.match(/"date-parts":\s*\[\[\s*(\d{4})/)?.[1];
}

/** Author family names, else literals, in order. */
export function authorNames(e: ReferenceEntry): string[] {
  if (e.kind === "file") {
    const a = (e.data.author ?? []) as { family?: string; literal?: string }[];
    const fam = a.map((p) => p.family).filter((x): x is string => !!x);
    return fam.length ? fam : a.map((p) => p.literal).filter((x): x is string => !!x);
  }
  const fam = [...e.text.matchAll(/\bfamily:\s*"((?:[^"\\]|\\.)*)"/g)].map((f) => f[1]!);
  return fam.length ? fam : [...e.text.matchAll(/\bliteral:\s*"((?:[^"\\]|\\.)*)"/g)].map((f) => f[1]!);
}

/** `URL`, else `https://doi.org/<DOI>`. */
export function entryUrl(e: ReferenceEntry): string | undefined {
  const url = stringField(e, "URL");
  if (url) return url;
  const doi = stringField(e, "DOI");
  return doi ? `https://doi.org/${doi}` : undefined;
}
