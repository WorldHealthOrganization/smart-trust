#!/usr/bin/env bun
/**
 * ingest-ig-chrome.ts — read a FHIR IG's published chrome out of its template chain.
 *
 * Third sibling of the retired `ingest-ig-artifacts.ts` (the IG's OUTPUT) and
 * `ingest-ig-menu.ts` (its SOURCE config). This one reads neither: an IG's
 * appearance is declared in the `fhir.template` packages its `ig.ini` names,
 * which are separate repositories the IG merely depends on.
 *
 * ```sh
 * bun run cat-harness/scripts/ingest-ig-chrome.ts \
 *   --layer /path/to/HL7/ig-template-base \
 *   --layer /path/to/WorldHealthOrganization/smart-ig-template \
 *   --out <chrome-owner>/fhir-artifact-index
 * bun run cat-harness/scripts/ingest-ig-chrome.ts --out … --check
 * ```
 *
 * **`--layer` is repeated, BASE FIRST.** Order is override order and this
 * script does not sort: a template package names its own `base` but not its
 * position in a chain somebody assembled, so the caller states the order and
 * the ingest records what it was given. Guessing it from `base` edges would be
 * a second, inferred answer free to disagree with `ig.ini`.
 *
 * ## Three states, and `--check` without layers is the third
 *
 * The template checkouts are not in this repository and are not reachable from
 * a runner. With no `--layer`, nothing can be compared: it reports that it
 * could not determine and exits **2**, never 0. The same line
 * `ingest-ig-menu.ts` draws, for the reason recorded there — a check that
 * silently passes over a comparison it never made is this repository's most
 * expensive recurring defect.
 *
 * ## What it extracts, and why only that
 *
 * Every `:root` custom property, plus the named rules in {@link MIRRORED} that
 * carry appearance no variable can hold. NOT the whole stylesheet: `who.css`
 * is 705 lines of layout for a Bootstrap document we do not serve, and copying
 * it would import an entire theme's box model into pages that already have one.
 *
 * @module scripts/ingest-ig-chrome
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import {
  IG_CHROME_SCHEMA_TAG,
  IgChromeSchema,
  tokensByPackage,
  type IgChrome,
  type IgChromeConflict,
  type IgChromeLayer,
  type IgChromeRule,
  type IgChromeToken,
} from "../schemas/ig-chrome.js";

const CHROME_FILENAME = "chrome.json";

/**
 * The selectors mirrored whole.
 *
 * Each is here because it carries appearance a custom property cannot: a tiled
 * data-URI watermark, or a rule the owner named by sight. Adding one is a
 * decision about what our pages claim to mirror, so the list is explicit
 * rather than a pattern — a regex over selectors would quietly widen the
 * mirror every time upstream added a rule that matched it.
 */
const MIRRORED = [
  // The DRAFT watermark. `ig-status` is set from `site.data.fhir.ig.status` in
  // the template's `fragment-pagebegin.html`, so the class is the IG's status
  // rather than a choice made here.
  "#ig-status.ig-status-draft",
  "#ig-status.ig-status-retired",
  // The white card the status text sits on, which is what keeps the watermark
  // BEHIND the words rather than through them.
  "#ig-status p",
  // The yellow box. Not WHO's — see `schemas/ig-chrome.ts`.
  "#publish-box",
] as const;

function args(name: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === `--${name}` && process.argv[i + 1] && !process.argv[i + 1]!.startsWith("--")) {
      out.push(process.argv[i + 1]!);
    }
  }
  return out;
}

function arg(name: string): string | undefined {
  return args(name)[0];
}

function gitRef(repo: string): string | undefined {
  const r = spawnSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf-8" });
  return r.status === 0 ? r.stdout.trim() : undefined;
}

function gitRemote(repo: string): string | undefined {
  const r = spawnSync("git", ["-C", repo, "remote", "get-url", "origin"], { encoding: "utf-8" });
  return r.status === 0 ? r.stdout.trim().replace(/\.git$/, "") : undefined;
}

/**
 * Strip comments before parsing.
 *
 * `who.css` annotates almost every variable (`/* 2. Header container color *​/`),
 * and a `;` or `}` inside one would end a declaration that has not ended. Done
 * first, once, rather than defended against in each regex below.
 */
function decomment(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Split a block body into its declarations, in order.
 *
 * A `;` ends a declaration and the FIRST `:` separates property from value —
 * but only outside a string and outside parentheses. The DRAFT watermark is
 * `url("data:image/svg+xml;utf8,<svg xmlns='http://…'>…")`: splitting it on
 * every `;` and `:` (what a `[^;]+` regex does) produced a truncated
 * `url("data:image/svg+xml` plus a bogus `http` property, and the unterminated
 * string that left in the mirrored stylesheet made browsers drop every rule
 * after it — the IG header bar among them.
 */
export function declarationsIn(body: string): Array<{ property: string; value: string }> {
  const out: Array<{ property: string; value: string }> = [];
  let quote: string | undefined;
  let depth = 0;
  let start = 0;
  let colon = -1;
  const flush = (end: number): void => {
    if (colon >= 0) {
      const property = body.slice(start, colon).trim();
      const value = body.slice(colon + 1, end).trim();
      if (/^-{0,2}[\w-]+$/.test(property) && value) out.push({ property, value });
    }
    start = end + 1;
    colon = -1;
  };
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = undefined;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0 && c === ":" && colon < 0) colon = i;
    else if (depth === 0 && c === ";") flush(i);
  }
  flush(body.length);
  return out;
}

/** Every custom property declared in a `:root` block, in file order. */
export function rootTokens(css: string): Array<{ name: string; value: string }> {
  const out: Array<{ name: string; value: string }> = [];
  for (const block of decomment(css).matchAll(/:root\s*\{([^}]*)\}/g)) {
    for (const d of declarationsIn(block[1]!)) {
      if (d.property.startsWith("--")) out.push({ name: d.property, value: d.value });
    }
  }
  return out;
}

/**
 * One named rule's declarations, or `undefined` when the selector is absent.
 *
 * Absent is a real answer and is kept distinct from "present and empty": a
 * layer that does not style `#publish-box` has said nothing about it, which is
 * exactly the fact that makes the yellow box HL7's rather than WHO's.
 */
export function ruleFor(css: string, selector: string): Array<{ property: string; value: string }> | undefined {
  const needle = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = decomment(css).match(new RegExp(`(?:^|[},])\\s*${needle}\\s*\\{([^}]*)\\}`));
  if (!m) return undefined;
  const decls = declarationsIn(m[1]!);
  return decls.length > 0 ? decls : undefined;
}

/**
 * Does this value look like a bare colour rather than a shorthand?
 *
 * Used only to CLASSIFY a disagreement, never to resolve one. A token whose
 * layers disagree on shape is reported; which layer is right is not this
 * script's call, and `schemas/ig-chrome.ts` says why.
 */
function isBareColour(v: string): boolean {
  return /^(#[0-9a-f]{3,8}|[a-z]+|rgba?\([^)]*\)|hsla?\([^)]*\))$/i.test(v.trim());
}

/** A CSS value that is a border SHORTHAND — it names a width or a style. */
function isShorthand(v: string): boolean {
  return /\b(solid|dashed|dotted|double|none|hidden|groove|ridge|inset|outset)\b/.test(v) || /\d\s*(px|em|rem)/.test(v);
}

/**
 * A value that is not valid CSS on its own terms.
 *
 * Deliberately NARROW. This is a mirror, not a linter: it reports only defects
 * that are unambiguous by inspection, because a false positive here accuses
 * somebody else's published stylesheet of a fault it does not have. Today that
 * is exactly one pattern — a doubled `#` before a hex value — which
 * `fhir.base.template` ships at `project.css:82`.
 */
export function malformation(value: string): string | undefined {
  const v = value.trim();
  if (/^#{2,}[0-9a-f]{3,8}$/i.test(v)) {
    return `a doubled "#" before a hex colour — "${v}" is not a CSS colour, so the declaration is dropped by the parser and the property falls back to its inherited value`;
  }
  return undefined;
}

export interface RawLayer {
  layer: IgChromeLayer;
  css: string;
}

/** Read one template checkout: its package identity, its commit, its stylesheet. */
export function readLayer(root: string, readAt: string): RawLayer {
  const pkgPath = join(root, "package", "package.json");
  if (!existsSync(pkgPath)) {
    throw new Error(`${root} has no package/package.json — it is not a fhir.template checkout`);
  }
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { name?: string; version?: string };
  const ref = gitRef(root);
  const of = gitRemote(root);
  if (!ref || !of) {
    throw new Error(
      `${root} is not a git checkout — chrome with no commit is chrome with no provenance, and this refuses to write it`,
    );
  }
  // The stylesheet is found rather than named: HL7 calls it `project.css` and
  // WHO calls it `who.css`, and a layer added later will call it something
  // else again. The rule is "the one that declares `:root` custom properties",
  // which is what makes it the palette layer.
  const dir = join(root, "content", "assets", "css");
  const candidates = ["project.css", "who.css", "hl7.css"];
  let path: string | undefined;
  let css = "";
  for (const c of candidates) {
    const p = join(dir, c);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, "utf-8");
    if (rootTokens(text).length === 0) continue;
    path = relative(root, p);
    css = text;
    break;
  }
  if (!path) {
    throw new Error(`${root}: no stylesheet under content/assets/css declares :root custom properties`);
  }
  return {
    layer: {
      package: pkg.name ?? "(unnamed)",
      version: pkg.version ?? "(unversioned)",
      of,
      ref,
      path,
      readAt,
    },
    css,
  };
}

/**
 * Overlay the layers base-first into resolved tokens, rules and conflicts.
 *
 * Exported and pure so the overlay can be tested on synthetic layers. The
 * conflict pass runs over the SAME token list, so a token cannot be resolved
 * without also being examined for disagreement — the two cannot drift apart
 * the way they would if a caller had to remember to run both.
 */
export function overlay(layers: RawLayer[]): {
  tokens: IgChromeToken[];
  rules: IgChromeRule[];
  conflicts: IgChromeConflict[];
} {
  /** name -> [{package, value}], base first. */
  const seen = new Map<string, Array<{ package: string; value: string }>>();
  for (const { layer, css } of layers) {
    for (const { name, value } of rootTokens(css)) {
      const list = seen.get(name) ?? [];
      // A layer may declare the same token twice (WHO uses two `:root` blocks).
      // The LAST one in the file wins within a layer, as CSS says.
      const already = list.findIndex((e) => e.package === layer.package);
      if (already >= 0) list[already] = { package: layer.package, value };
      else list.push({ package: layer.package, value });
      seen.set(name, list);
    }
  }

  const tokens: IgChromeToken[] = [];
  const conflicts: IgChromeConflict[] = [];
  for (const [name, list] of seen) {
    const winner = list[list.length - 1]!;
    const shadowed = list.slice(0, -1).reverse();
    tokens.push({
      name,
      value: winner.value,
      from: winner.package,
      // Only the ones whose value actually DIFFERS. A lower layer declaring
      // the identical value is not an override, and recording it as one would
      // make `overrides: []` stop meaning "one layer decided this".
      overrides: shadowed.filter((s) => s.value !== winner.value),
    });
    for (const site of list) {
      const bad = malformation(site.value);
      if (bad === undefined) continue;
      conflicts.push({
        token: name,
        kind: "malformed",
        detail:
          `${name} is not a valid CSS value in ${site.package}: ${bad}. ` +
          `Mirrored verbatim and recorded rather than corrected — a mirror that silently fixes its subject is not a mirror.`,
        sites: [{ package: site.package, value: site.value }],
      });
    }
    const shapes = new Set(list.map((e) => (isShorthand(e.value) ? "shorthand" : isBareColour(e.value) ? "colour" : "other")));
    if (shapes.size > 1) {
      conflicts.push({
        token: name,
        kind: "shape",
        detail:
          `${name} is declared as different KINDS of value by different layers. ` +
          `A rule written against one layer's shape emits something invalid when the other layer's value is substituted in. ` +
          `Recorded, not resolved: this repository is mirroring somebody else's stylesheet.`,
        sites: list.map((e) => ({ package: e.package, value: e.value })),
      });
    }
  }
  tokens.sort((a, b) => a.name.localeCompare(b.name));
  conflicts.sort((a, b) => a.token.localeCompare(b.token) || a.kind.localeCompare(b.kind));

  const rules: IgChromeRule[] = [];
  for (const selector of MIRRORED) {
    // Topmost layer that declares it wins, same as CSS.
    for (const { layer, css } of [...layers].reverse()) {
      const decls = ruleFor(css, selector);
      if (decls) {
        rules.push({ selector, from: layer.package, declarations: decls });
        break;
      }
    }
  }
  return { tokens, rules, conflicts };
}

/**
 * The chrome of a template chain, keyed by its TOP layer (`folio-ig-chrome/v2`).
 *
 * No IG is read: every IG building with this chain wears this chrome, so an
 * IG's identity is not the chrome's to state — it is the IG's own
 * `sushi-config.yaml`, which its artefact index records.
 */
export function buildChrome(layerRoots: string[], readAt: string): IgChrome {
  const read = layerRoots.map((r) => readLayer(resolve(r), readAt));
  const top = read[read.length - 1]!.layer;
  const { tokens, rules, conflicts } = overlay(read);
  const chrome: IgChrome = {
    $schema: IG_CHROME_SCHEMA_TAG,
    id: top.package,
    version: top.version,
    layers: read.map((r) => r.layer),
    tokens,
    rules,
    conflicts,
  };
  const parsed = IgChromeSchema.safeParse(chrome);
  if (!parsed.success) {
    throw new Error(
      `the chrome read from ${layerRoots.join(", ")} does not validate:\n` +
        parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n"),
    );
  }
  return parsed.data;
}

if (import.meta.main) {
  const layerRoots = args("layer");
  const out = arg("out");
  const check = process.argv.includes("--check");
  if (!out) {
    console.error("usage: ingest-ig-chrome.ts --layer <base> [--layer <next> …] --out <dir> [--check]");
    process.exit(2);
  }
  const readAt = new Date().toISOString().slice(0, 10);
  // `readAt` moves every run and says nothing about the CONTENT. `ref` does
  // NOT move for free: a different commit is different chrome even when the
  // values happen to match, and hiding that would pass over an upstream
  // change. Same rule as `ingest-ig-menu.ts`.
  const strip = (t: string): string => t.replace(/"readAt": "[^"]*"/g, '"readAt": "-"');
  let failed = false;

  /** Write `doc` to `target`, or with --check compare against what is committed. */
  const emit = (target: string, doc: unknown, what: string): void => {
    const serialised = `${JSON.stringify(doc, null, 2)}\n`;
    if (check) {
      if (!existsSync(target)) {
        console.error(`✗ no ${relative(process.cwd(), target)} — the ${what} has never been ingested`);
        failed = true;
      } else if (strip(readFileSync(target, "utf-8")) !== strip(serialised)) {
        console.error(`✗ ${relative(process.cwd(), target)} is stale against its source`);
        failed = true;
      } else {
        console.log(`✓ ${what} current — ${relative(process.cwd(), target)}`);
      }
      return;
    }
    mkdirSync(resolve(target, ".."), { recursive: true });
    writeFileSync(target, serialised);
    console.log(`${relative(process.cwd(), target)} written`);
  };

  if (out) {
    const target = join(resolve(out), CHROME_FILENAME);
    if (layerRoots.length === 0) {
      // THE THIRD STATE, and here it is the NORMAL one: the template packages
      // are separate repositories nobody clones to work in this one. Exits 2 —
      // not 0, and not 1.
      console.error("could not determine: no --layer checkouts, so there is nothing to read the chrome from.");
      console.error(`  ${existsSync(target) ? "The committed chrome was NOT verified." : "No chrome is committed either."}`);
      console.error("  Clone each fhir.template in the chain and pass them base-first with --layer.");
      process.exit(2);
    }
    const chrome = buildChrome(layerRoots, readAt);
    emit(target, chrome, "chrome");
    if (!check) {
      console.log(`  ${chrome.id} ${chrome.version}: ${chrome.tokens.length} token(s), ${chrome.rules.length} rule(s)`);
      for (const [pkg, n] of Object.entries(tokensByPackage(chrome))) console.log(`  ${pkg} won ${n}`);
      for (const r of chrome.rules) console.log(`  rule ${r.selector} ← ${r.from}`);
      for (const c of chrome.conflicts) {
        console.log(`  ⚠ ${c.kind} ${c.token}: ${c.sites.map((s) => `${s.package}="${s.value}"`).join(" vs ")}`);
      }
    }
  }

  process.exit(failed ? 1 : 0);
}
