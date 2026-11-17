#!/usr/bin/env bun
/**
 * Every plain KEY a content document writes is a declared term, and no file
 * PATH sits under an `@id`-coerced term — the two halves of the retired
 * `check-context-emission` that per-instance contexts do not replace.
 *
 * @module scripts/check-content-keys
 * @covers schemas — the thing graded is `CONTENT_CONTEXT` in `schemas/kg/jsonld.ts`: a key a document
 *   writes that it does not declare, and a path under a term it coerces to `@id`
 *
 * Prefix binding is covered elsewhere: each layer's generated context
 * (`<iriBase>ns/context/v1.jsonld`, `gen-instance-contexts`) binds only what
 * is used, and `jsonld:contexts --check` fails on a prefix used in an IRI
 * position that nothing binds.
 *
 * These two ask about TERMS, which a generated context cannot answer: a key
 * the content context does not declare is absent from both, and dropped by a
 * processor without a word. So they run over every document that names the
 * content context OR a layer's own context, whose terms are the content
 * context's.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/check-content-keys.ts [--json]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { CONTENT_CONTEXT, CONTENT_CONTEXT_URL } from "../schemas/kg/jsonld.js";

import { INSTANCE_CONTEXT_PATH } from "../pipeline/instance-document-context.ts";
import { contentDocuments } from "./lib/jsonld-corpus.ts";

const REPO = resolve(import.meta.dir, "..", "..");

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** A key or path finding: the name, how often, and the first document it was met in. */
export interface PrefixFinding {
  readonly prefix: string;
  readonly count: number;
  readonly example: string;
}

/**
 * Whether a context URL is one whose terms are the content context's: the
 * shared context itself, or a layer's own generated context.
 */
export type ContentContextUrl = string | ((url: string) => boolean);

/** The default: the shared content context, or any `<iriBase>ns/context/v1.jsonld`. */
export const namesContentTerms = (url: string): boolean => url === CONTENT_CONTEXT_URL || url.endsWith(`/${INSTANCE_CONTEXT_PATH}`);

/** Does this document's `@context` name a content-term context? */
function namesContext(c: unknown, url: ContentContextUrl): boolean {
  const is = typeof url === "string" ? (u: unknown) => u === url : (u: unknown) => typeof u === "string" && url(u);
  return is(c) || (Array.isArray(c) && c.some(is));
}

// ── Every plain KEY is a declared term — bean `yh6u` ─────────────────────
//
// `kg-export` rule 5 applied to CONTENT: a key that is neither a declared term
// nor a compact/absolute IRI is not a property, and a JSON-LD processor DROPS
// it without a word. Measured 2026-09-23 before this check existed: 8 such keys
// across 392 committed figure blocks — every agent-drafted figure narrative.
// The prefix check above could not see them, because they have no prefix.
//
// It does not descend into a `@json`-typed value: that is a JSON LITERAL by
// declaration, its inner keys are data rather than properties, and reading them
// as undeclared terms would condemn exactly the choice that keeps their nulls.

export interface KeyDeclarationReport {
  /** Documents that name the content context, or a layer's own context. */
  readonly documents: number;
  /** Plain keys that are not declared terms, with a count and an example. */
  readonly undeclared: PrefixFinding[];
}

export function checkDeclaredKeys(
  repo = REPO,
  context = CONTENT_CONTEXT as Record<string, unknown>,
  contextUrl: ContentContextUrl = namesContentTerms,
): KeyDeclarationReport {
  const terms = new Set(Object.keys(context).filter((k) => !k.startsWith("@")));
  const isJson = (k: string): boolean => {
    const d = context[k];
    return isRecord(d) && d["@type"] === "@json";
  };
  const found = new Map<string, { count: number; example: string }>();
  let documents = 0;

  const walk = (o: unknown, where: string): void => {
    if (Array.isArray(o)) return void o.forEach((x) => walk(x, where));
    if (!isRecord(o)) return;
    for (const [k, v] of Object.entries(o)) {
      if (k === "@context") continue;
      if (k.startsWith("@")) {
        walk(v, where);
        continue;
      }
      // A compact or absolute IRI is the prefix check's business, not this one's.
      if (k.includes(":")) {
        walk(v, where);
        continue;
      }
      if (!terms.has(k)) {
        const e = found.get(k);
        if (e) e.count++;
        else found.set(k, { count: 1, example: where });
      }
      if (!isJson(k)) walk(v, where);
    }
  };

  for (const f of contentDocuments(repo)) {
    let doc: unknown;
    try {
      doc = JSON.parse(readFileSync(f, "utf-8"));
    } catch {
      continue;
    }
    if (!namesContext(isRecord(doc) ? doc["@context"] : undefined, contextUrl)) continue;
    documents++;
    walk(doc, f.startsWith(repo) ? f.slice(repo.length + 1) : f);
  }
  return {
    documents,
    undeclared: [...found].map(([prefix, e]) => ({ prefix, ...e })).sort((a, b) => b.count - a.count),
  };
}

// ── A PATH is never an `@id` — bean `589f` ────────────────────────────────
//
// A document-relative path under an `@id`-coerced term is resolved by a
// JSON-LD processor against `@base`, not against the document, and so names a
// location the file is not at. That was `text` on 1,323 prose blocks. The fix
// was to declare `text` and `leanSource` literals; this is what stops the next
// term — or the old one, re-coerced — from doing it again.

/** A value that is a file path rather than an IRI or a node id. */
export function looksLikePath(v: string): boolean {
  return v.startsWith("../") || v.startsWith("./") || /\.(md|lean|tex|png|jpe?g|svg|pdf|csv|xlsx)$/i.test(v);
}

export function checkPathsAreNotLinks(
  repo = REPO,
  context = CONTENT_CONTEXT as Record<string, unknown>,
  contextUrl: ContentContextUrl = namesContentTerms,
): KeyDeclarationReport {
  const idTerms = new Set(
    Object.entries(context)
      .filter(([k, v]) => !k.startsWith("@") && isRecord(v) && v["@type"] === "@id")
      .map(([k]) => k),
  );
  const found = new Map<string, { count: number; example: string }>();
  let documents = 0;
  const walk = (o: unknown, where: string): void => {
    if (Array.isArray(o)) return void o.forEach((x) => walk(x, where));
    if (!isRecord(o)) return;
    for (const [k, v] of Object.entries(o)) {
      if (idTerms.has(k)) {
        for (const x of Array.isArray(v) ? v : [v]) {
          if (typeof x !== "string" || !looksLikePath(x)) continue;
          const e = found.get(k);
          if (e) e.count++;
          else found.set(k, { count: 1, example: `${where}: ${x}` });
        }
      }
      if (isRecord(context[k]) && (context[k] as Record<string, unknown>)["@type"] === "@json") continue;
      walk(v, where);
    }
  };
  for (const f of contentDocuments(repo)) {
    let doc: unknown;
    try {
      doc = JSON.parse(readFileSync(f, "utf-8"));
    } catch {
      continue;
    }
    if (!namesContext(isRecord(doc) ? doc["@context"] : undefined, contextUrl)) continue;
    documents++;
    walk(doc, f.startsWith(repo) ? f.slice(repo.length + 1) : f);
  }
  return {
    documents,
    undeclared: [...found].map(([prefix, e]) => ({ prefix, ...e })).sort((a, b) => b.count - a.count),
  };
}

/** Print the path-under-`@id` half; return whether it failed. */
function reportPaths(p: KeyDeclarationReport): boolean {
  if (p.undeclared.length === 0) {
    console.log("✓ no file path sits under an `@id`-coerced term");
    return false;
  }
  console.error(`\n${p.undeclared.length} \`@id\` term(s) carry FILE PATHS — a processor resolves them against @base, to the wrong place:`);
  for (const u of p.undeclared) console.error(`  ✗ ${u.prefix}  ×${u.count}  e.g. ${u.example}`);
  console.error("\nDeclare the term a literal, or mint an absolute IRI for a file that is actually served (bean `589f`).");
  return true;
}

/** Print the undeclared-key half; return whether it failed. */
function reportKeys(k: KeyDeclarationReport): boolean {
  console.log(`\nKey declaration — ${k.documents} content-context document(s) read`);
  if (k.documents === 0) {
    console.error("::error::key declaration: no content-context document read — a clean run over nothing is not clean");
    return true;
  }
  if (k.undeclared.length > 0) {
    console.error(`\n${k.undeclared.length} key(s) are not declared terms — a JSON-LD processor DROPS them:`);
    for (const u of k.undeclared) console.error(`  ✗ ${u.prefix}  ×${u.count}  e.g. ${u.example}`);
    console.error("\nDeclare each in CONTENT_CONTEXT (schemas/kg/jsonld.ts), or nest it under an `@json` term if it is data rather than a property.");
    return true;
  }
  console.log("✓ every key in every content-context document is a declared term");
  return false;
}

if (import.meta.main) {
  const k = checkDeclaredKeys();
  const p = checkPathsAreNotLinks();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ keys: k, paths: p }, null, 2));
    process.exit(k.undeclared.length > 0 || k.documents === 0 || p.undeclared.length > 0 ? 1 : 0);
  }
  if (reportKeys(k)) process.exitCode = 1;
  if (reportPaths(p)) process.exitCode = 1;
}
