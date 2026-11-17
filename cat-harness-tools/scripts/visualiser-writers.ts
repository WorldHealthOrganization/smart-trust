#!/usr/bin/env bun
/**
 * Which command writes which declared visualiser, and how to point it at a
 * site: read from the declarations, never kept as a list here.
 *
 * @module scripts/visualiser-writers
 * @covers none — a build step: it runs the declared writers and judges no graph
 *
 * A repository's own site (`build-instance-site.ts`) must carry the
 * visualiser pages of it and all its dependencies (checked by
 * `site-coverage.ts`); this is how every site build runs their writers.
 *
 * ## Where the list is: the declarations already carry it
 *
 *   visualiser (`<harness>.json` `visualisers`) ─renderedBy→ Tool node
 *   Tool node ─invoke.shell→ the command that writes it
 *   Tool node ─io.inputs `site`, arg.flag→ how to point it at a site
 *   Tool node ─io.inputs `instance`, arg.flag→ the harness it is run for
 *
 * So a new visualiser whose Tool declares a `site` input is run by every site
 * build the day it is declared, and one whose Tool declares none is REPORTED
 * as not runnable into a site, with the reason — never skipped in silence.
 * The inputs are explicit per Tool (`ToolArgSchema`); the one thing written
 * here is which input NAMES this runner fills: `site` (and `out`,
 * archimate-pages' name for the same thing) with the site, and `instance`
 * with the declaring harness's root.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/visualiser-writers.ts [--root <checkout>] [--list] [--json]
 *   bun run cat-harness-tools/scripts/visualiser-writers.ts [--root <checkout>] --site <dir> [--staging] [--missing]
 *
 * `--list` prints the writers and runs nothing. Without `--site` each writer
 * writes into its harness's own site directory, as `docs-site.yml`'s steps do.
 * `--missing` runs only the writers of pages `--site` does not hold yet.
 * Exit: 0 every writer run ran or declined (exit 78) · 1 a writer failed or cannot be run.
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { checkoutDirectories, instanceConfigFor } from "../schemas/kg/harness-config.js";
import type { ToolDefinition } from "../schemas/tools/tool.js";

import { discoverTools } from "../tools/discover.ts";
import { declaredPlan, runWriter, writersOf, type WriterOutcome } from "./derive-at-publish.ts";
import { writerCommand } from "./lib/script-command.ts";
import { expectedPages, missingPages, type ExpectedPage } from "./site-coverage.ts";
import { declaredVisualisers, type DeclaredVisualiser } from "./viewer-declarations.ts";
import { SCOPE_INPUT, scopeArg } from "./lib/site-scope.ts";

/** The Tool input names this runner fills with the site being built. */
export const SITE_INPUTS = ["site", "out"] as const;
/** The Tool input name this runner fills with the declaring harness's root. */
export const INSTANCE_INPUT = "instance";

/** A visualiser, by its route segments. */
export interface VisualiserRef {
  harness: string;
  visualiser: string;
  /** The declaring harness's root, absolute. */
  harnessRoot: string;
}

/** One run of a declared writer, and the visualisers it draws. */
export interface VisualiserWriter {
  /** The Tool node the visualisers are `renderedBy`. */
  tool: string;
  visualisers: VisualiserRef[];
  /** The command's words, from `invoke.shell`; undefined when the Tool has none. */
  invoke?: string[];
  /** The flag of the Tool's site input ({@link SITE_INPUTS}). */
  siteFlag?: string;
  /** The flag of the Tool's `scope` input, when it declares one ({@link SCOPE_INPUT}). */
  scopeFlag?: string;
  /** For a Tool with an `instance` input: its flag and the harness root it is run for. */
  instance?: { flag: string; root: string };
  /** Why it cannot be run into a site, when it cannot. */
  unrunnable?: string;
}

/** Shell words that would make `invoke.shell` more than a command and its arguments. */
const SHELL_META = /[;&|$`<>(){}'"*?\\\n]/;

type ToolLike = Pick<ToolDefinition, "id" | "invoke" | "io">;

/**
 * The writers of the given visualisers, one per Tool (and per harness, for a
 * Tool run for one layer at a time), each with what the Tool declares about
 * pointing it at a site.
 */
export function visualiserWriters(
  root: string,
  visualisers: readonly DeclaredVisualiser[] = declaredVisualisers(root),
  tools: readonly ToolLike[] = discoverTools(root).tools,
): VisualiserWriter[] {
  const byId = new Map(tools.map((t) => [t.id, t]));
  const out = new Map<string, VisualiserWriter>();
  for (const v of visualisers) {
    const ref: VisualiserRef = { harness: v.harness, visualiser: v.id, harnessRoot: resolve(v.harnessRoot) };
    const t = byId.get(v.renderedBy);
    const inputs = t?.io?.inputs ?? [];
    const flagOf = (name: string): string | undefined => {
      const a = inputs.find((i) => i.name === name)?.arg;
      return a !== undefined && "flag" in a ? a.flag : undefined;
    };
    const instanceInput = inputs.find((i) => i.name === INSTANCE_INPUT);
    const key = instanceInput ? `${v.renderedBy}@${ref.harnessRoot}` : v.renderedBy;
    const known = out.get(key);
    if (known) {
      known.visualisers.push(ref);
      continue;
    }
    const w: VisualiserWriter = { tool: v.renderedBy, visualisers: [ref] };
    out.set(key, w);
    if (t === undefined) {
      w.unrunnable = `renderedBy "${v.renderedBy}" names no discovered Tool node`;
      continue;
    }
    const shell = t.invoke.shell;
    if (shell === undefined) {
      w.unrunnable = `Tool ${t.id} has no shell invocation`;
      continue;
    }
    if (SHELL_META.test(shell)) {
      w.unrunnable = `Tool ${t.id}'s invocation is not a plain command: ${JSON.stringify(shell)}`;
      continue;
    }
    w.invoke = shell.trim().split(/\s+/);
    w.siteFlag = SITE_INPUTS.map(flagOf).find((f) => f !== undefined);
    w.scopeFlag = flagOf(SCOPE_INPUT);
    if (instanceInput) {
      const flag = flagOf(INSTANCE_INPUT);
      if (flag === undefined) w.unrunnable = `Tool ${t.id}'s \`instance\` input declares no flag`;
      else w.instance = { flag, root: ref.harnessRoot };
    }
    const owed = inputs.filter((i) => i.required && i.name !== INSTANCE_INPUT && i.name !== SCOPE_INPUT && !(SITE_INPUTS as readonly string[]).includes(i.name));
    if (owed.length > 0 && w.unrunnable === undefined) {
      w.unrunnable = `Tool ${t.id} requires input(s) ${owed.map((i) => `\`${i.name}\``).join(", ")}, which a site build has no value for`;
    }
  }
  return [...out.values()];
}

/**
 * The argv one writer runs as, into `site` when given. `bun run cat <name>`
 * goes through `writerCommand`, so a checkout with no `cat` script still
 * runs it. Throws when the writer cannot be run that way.
 */
export function writerArgv(root: string, w: VisualiserWriter, site?: string, scope?: readonly string[]): string[] {
  if (w.unrunnable !== undefined) throw new Error(w.unrunnable);
  if (w.invoke === undefined) throw new Error(`Tool ${w.tool} has no shell invocation`);
  if (site !== undefined && w.siteFlag === undefined) throw new Error(`Tool ${w.tool} declares no \`site\` input, so it cannot be pointed at a site being built`);
  const words = w.invoke;
  const base = words[0] === "bun" && words[1] === "run" && words[2] === "cat" && words[3] !== undefined
    ? [...writerCommand(root, words[3]), ...words.slice(4)]
    : [...words];
  return [
    ...base,
    ...(w.instance ? [w.instance.flag, w.instance.root] : []),
    ...(site !== undefined ? [w.siteFlag!, resolve(site)] : []),
    // A scope reaches only a writer that declares one: the others still write every instance.
    ...(scope !== undefined && w.scopeFlag !== undefined ? [w.scopeFlag, scopeArg(scope)] : []),
  ];
}

/**
 * The writers of the expected pages in `pages`: each writer once, with only the
 * visualisers it owes.
 *
 * A writer run for one layer at a time (an `instance` input) is keyed on the
 * harness that DECLARES the visualiser, so by itself it draws that harness's
 * pages only. A visualiser with `subgraphs: "instance"` also owes a page to
 * every OTHER layer with entries of the kinds it covers: the DAK base
 * layer's `artifact-index` owes `en/<dak-base>/artifact-index/<dak-ig>/` on
 * that DAK IG's site (2026-10-15), and `ig-pages --instance <dak-base>`
 * never drew it. So for each such owed page whose layer `rootOf` can place,
 * the writer runs once more, pointed at that layer.
 */
export function writersFor(
  writers: readonly VisualiserWriter[],
  pages: readonly ExpectedPage[],
  rootOf: (instance: string) => string | undefined = () => undefined,
): VisualiserWriter[] {
  const owed = new Set(pages.map((p) => `${p.harness}/${p.visualiser}`));
  const out: VisualiserWriter[] = [];
  for (const w of writers) {
    const visualisers = w.visualisers.filter((v) => owed.has(`${v.harness}/${v.visualiser}`));
    if (visualisers.length === 0) continue;
    out.push({ ...w, visualisers });
    if (w.instance === undefined) continue;
    const runFor = new Set([resolve(w.instance.root)]);
    for (const p of pages) {
      if (p.instance === undefined || !visualisers.some((v) => v.harness === p.harness && v.visualiser === p.visualiser)) continue;
      const at = rootOf(p.instance);
      if (at === undefined || runFor.has(resolve(at))) continue;
      runFor.add(resolve(at));
      out.push({ ...w, visualisers: visualisers.filter((v) => v.harness === p.harness && v.visualiser === p.visualiser), instance: { ...w.instance, root: resolve(at) } });
    }
  }
  return out;
}

/** The root of each layer in the checkout at `root`, by name: where a writer run for that layer is pointed. */
export function instanceRoots(root: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const d of checkoutDirectories(root)) {
    const at = instanceConfigFor(d.absPath);
    if (at !== undefined && !out.has(at.name)) out.set(at.name, at.root);
  }
  return out;
}

/** What one writer did. */
export interface WriterRun {
  writer: VisualiserWriter;
  outcome: WriterOutcome | { kind: "unrunnable"; why: string };
}

const label = (w: VisualiserWriter): string => `${w.tool} (${w.visualisers.map((v) => `${v.harness}/${v.visualiser}`).join(", ")})`;

/**
 * Run each writer, into `site` when given. A writer that fails or cannot be
 * run is RETURNED, not thrown: the caller judges the pages it owed, as the
 * site build does through `site-coverage.ts`.
 */
export function runVisualiserWriters(
  root: string,
  writers: readonly VisualiserWriter[],
  site?: string,
  runOne: (argv: readonly string[], cwd: string) => WriterOutcome = runWriter,
  scope?: readonly string[],
): WriterRun[] {
  const runs: WriterRun[] = [];
  for (const w of writers) {
    let argv: string[];
    try {
      argv = writerArgv(root, w, site, scope);
    } catch (e) {
      console.error(`  ✗ visualiser writer ${label(w)} not run: ${(e as Error).message}`);
      runs.push({ writer: w, outcome: { kind: "unrunnable", why: (e as Error).message } });
      continue;
    }
    console.log(`▶ visualiser writer: ${label(w)}`);
    const outcome = runOne(argv, root);
    if (outcome.kind === "failed") console.error(`  ✗ visualiser writer ${label(w)} failed (exit ${outcome.exit ?? "on a signal"})`);
    if (outcome.kind === "skipped") console.log(`  skipped ${w.tool} — it does not apply to this root: ${outcome.why}`);
    runs.push({ writer: w, outcome });
  }
  return runs;
}

/**
 * The site build's step: run the writer of every expected page `site` does
 * not hold yet — the checkout's own visualisers and every layer it needs.
 * A page a recipe step already wrote (smart-ra's `site:archimate`) is not
 * written twice. With `opts.scope`, only the scope's instances' pages are
 * owed, and each writer that declares a `scope` input is told it.
 */
export function writeMissingVisualisers(root: string, site: string, opts: { staging?: boolean; scope?: readonly string[] } = {}, runOne?: (argv: readonly string[], cwd: string) => WriterOutcome): WriterRun[] {
  const missing = missingPages(expectedPages(root, opts), (p) => existsSync(join(site, p)));
  if (missing.length === 0) return [];
  const roots = instanceRoots(root);
  const writers = writersFor(visualiserWriters(root), missing, (name) => roots.get(name));
  return runVisualiserWriters(root, inPublishOrder(writers, publishOrder(root)), site, runOne, opts.scope);
}

/** The publish-time writers in the order `derive:publish` runs them; empty when the plan cannot be read. */
function publishOrder(root: string): string[] {
  try {
    return writersOf(declaredPlan(root));
  } catch {
    return [];
  }
}

/**
 * The writers, with those `derive:publish` also runs put in its order.
 *
 * A viewer can read what another viewer writes: the methodologies page links
 * an ingested source only when the library's projection and pages are already
 * in the site (owner, 2026-11-10). The declarations order them (`cat-harness`
 * lists `library:viz` before `methodologies:viz`), but this step ran writers in
 * VISUALISER order, where `methodologies` comes first, so on every IG site the
 * page was written before the pages it links and linked none of them. Writers
 * the plan does not name keep their place; the named ones are reordered among
 * the slots they hold.
 */
export function inPublishOrder(writers: readonly VisualiserWriter[], order: readonly string[]): VisualiserWriter[] {
  const rank = new Map(order.map((w, k) => [w, k] as const));
  const rankOf = (w: VisualiserWriter): number | undefined => rank.get(w.invoke?.at(-1) ?? "");
  const slots = writers.flatMap((w, k) => (rankOf(w) === undefined ? [] : [k]));
  const sorted = slots.map((k) => writers[k]!).sort((a, b) => rankOf(a)! - rankOf(b)!);
  const out = [...writers];
  slots.forEach((k, i) => (out[k] = sorted[i]!));
  return out;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const at = (k: string): string | undefined => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const root = resolve(at("--root") ?? ".");
  const site = at("--site");
  const staging = argv.includes("--staging");
  const declared = visualiserWriters(root, declaredVisualisers(root).filter((v) => staging || v.publish !== "staging-only"));
  if (argv.includes("--list")) {
    if (argv.includes("--json")) console.log(JSON.stringify(declared, null, 2));
    else {
      for (const w of declared) {
        const how = w.unrunnable ? `not runnable: ${w.unrunnable}` : `${w.invoke!.join(" ")}${w.instance ? ` ${w.instance.flag} <${w.visualisers[0]!.harness}>` : ""}${w.siteFlag ? ` [${w.siteFlag} <site>]` : "  (declares no site input)"}`;
        console.log(`${label(w)}\n    ${how}`);
      }
    }
    process.exit(0);
  }
  const runs = site !== undefined && argv.includes("--missing")
    ? writeMissingVisualisers(root, site, { staging })
    : runVisualiserWriters(root, declared, site);
  const bad = runs.filter((r) => r.outcome.kind === "failed" || r.outcome.kind === "unrunnable");
  console.log(`visualiser writers: ${runs.length} run, ${bad.length} failed or not runnable`);
  process.exit(bad.length ? 1 : 0);
}
