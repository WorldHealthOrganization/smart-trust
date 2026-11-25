#!/usr/bin/env node
// Mechanical checks for mid-fidelity wireframe candidates (methodology `wiregen`,
// process `wireframe-design-review`, step "Mechanical checks, both viewports").
//
//   bun run cat wireframe:check --use <design|as-is> --topic <slug> --surface <ref>
//                               [<candidate.html>...] [--out DIR]   (issue #1023)
//
// The three flags are the skill's required input (`use`, `topic`, `surface` in
// schemas/skills/wireframe-design-review/input.schema.json); the Tool node
// `wireframe-check` declares them so that its `satisfies` edge is true, and this
// script USES each of them (owner, 2026-10-14):
//   --topic   scopes WHICH wireframes are checked. It names the asset directory:
//             `wireframes/<topic>/` under a layer's declared `docs` directory
//             (`docs/wireframes/<topic>/` for most) for as-is use, `docs/proposals/<topic>/
//             wireframes/` for design use (or `docs/wireframes/<topic>/`, where
//             older design work sits). With no candidates given, every `.html`
//             in that directory is checked; a candidate given outside it is
//             refused. `--out` defaults to `<that directory>/checks`.
//   --use     sets the rule for the candidate set: `design` needs at least two
//             candidates (they are compared blind); `as-is` candidates are the
//             drawings of what renders on main, so each is marked `as-is` in its
//             file name.
//   --surface names what is drawn. For as-is use it must be the topic itself
//             (shared chrome such as the navbar) or one of the refs
//             `docs/wireframes/index.json` says the topic covers.
// All three are recorded in report.json beside the per-candidate entries.
//
// Each candidate is rendered at a WEB and a MOBILE viewport. Per candidate and
// viewport it records a `script` entry per criterion (pass/fail, never a score):
//   renders       - the page loads and has visible content
//   no-overflow   - no horizontal scroll (the mobile failure that matters most)
//   no-placeholder- no lorem ipsum, no TODO/FIXME/XXX marker: mid-fidelity means real content
// and writes a screenshot for the human and agent reviewers. Exit 1 on any fail,
// exit 2 on a usage error (a missing or invalid flag, a candidate set the use
// does not admit).
// Playwright is this repository's own dependency; Chromium from PLAYWRIGHT_BROWSERS_PATH.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

const VIEWPORTS = { web: { width: 1280, height: 800 }, mobile: { width: 390, height: 844 } };
// Filler prose is matched case-insensitively. Author markers (TODO, FIXME, XXX)
// only in capitals: "todo" is real content in this repository (a bean status,
// the todos/ graph), and a wireframe of those pages must be able to say it.
const PLACEHOLDER_PROSE = /lorem ipsum|dolor sit amet|placeholder text/i;
const PLACEHOLDER_MARKER = /\bTODO\b|\bFIXME\b|\bXXX+\b/;
const placeholderIn = (text) => text.match(PLACEHOLDER_PROSE) ?? text.match(PLACEHOLDER_MARKER);

/** The members of the Tool type `WireframeUse`. */
export const USES = ["design", "as-is"];
/** The patterns of the Tool types `Slug` and `SurfaceRef`, so a value the Tool refuses is refused here too. */
const TOPIC = /^[a-z0-9][a-z0-9-]*$/;
const SURFACE = /^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)*$/;
const USAGE =
  "usage: wireframe-check.mjs --use <design|as-is> --topic <slug> --surface <ref> [<candidate.html>...] [--out DIR]";

export class UsageError extends Error {}

/** argv -> flags and positionals. Every flag takes one value. */
export function parseArgs(argv) {
  const flags = {};
  const files = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      files.push(a);
      continue;
    }
    const name = a.slice(2);
    if (!["use", "topic", "surface", "out"].includes(name)) throw new UsageError(`unknown flag ${a}\n${USAGE}`);
    const v = argv[++i];
    if (v === undefined || v.startsWith("--")) throw new UsageError(`${a} needs a value\n${USAGE}`);
    flags[name] = v;
  }
  return { flags, files };
}

/**
 * The directories a topic's candidates may sit in, for a use, in order of
 * preference. Path suffixes. An as-is wireframe sits in `wireframes/<topic>/`
 * under any `docs` directory a layer declares — its site directory, or a
 * second one when its site directory is built at publish — which is the set
 * `check:wireframes` reads (`wireframeSources`).
 */
export function assetDirSuffixes(use, topic) {
  const asIs = join("wireframes", topic);
  return use === "design" ? [join("docs", "proposals", topic, "wireframes"), asIs] : [asIs];
}

/** Does `dir` (absolute) end in one of the suffixes? */
const inTopicDir = (dir, suffixes) => suffixes.some((s) => dir === s || dir.endsWith(sep + s));

/**
 * Where a topic's wireframes are when no candidate is given: the first existing
 * `<suffix>` directly under the root, or under a directory one or two levels
 * below it (an index checkout holds each layer in its own directory, and a
 * layer holds its `docs` directories at its own top level).
 */
export function findAssetDir(root, suffixes) {
  const below = (dir) => {
    try {
      return readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith(".") && d.name !== "node_modules")
        .map((d) => join(dir, d.name))
        .sort();
    } catch {
      return [];
    }
  };
  const first = below(root);
  const tops = [root, ...first, ...first.flatMap(below)];
  for (const s of suffixes)
    for (const t of tops) {
      const p = join(t, s);
      if (existsSync(p) && statSync(p).isDirectory()) return p;
    }
  return undefined;
}

/**
 * The surfaces an as-is wireframe of `topic` may name: the topic itself, and
 * what `docs/wireframes/index.json` (beside the topic's directory) says it
 * covers. `undefined` when the index does not list the topic.
 */
export function asIsSurfaces(assetDir, topic) {
  const indexFile = join(dirname(assetDir), "index.json");
  if (!existsSync(indexFile)) return undefined;
  const entry = JSON.parse(readFileSync(indexFile, "utf-8")).wireframes?.[topic];
  return entry ? [topic, ...(entry.covers ?? [])] : undefined;
}

/**
 * Turn argv into the run: which candidates, where the report goes, and the
 * `use`/`topic`/`surface` it records. Throws {@link UsageError} on anything the
 * skill's input contract does not admit. Pure apart from reading the tree.
 */
export function resolveRun(argv, root = process.cwd()) {
  const { flags, files } = parseArgs(argv);
  for (const f of ["use", "topic", "surface"])
    if (flags[f] === undefined) throw new UsageError(`--${f} is required (wireframe-design-review input)\n${USAGE}`);
  const { use, topic, surface } = flags;
  if (!USES.includes(use)) throw new UsageError(`--use must be one of ${USES.join(", ")}, not "${use}"`);
  if (!TOPIC.test(topic)) throw new UsageError(`--topic must be kebab-case, not "${topic}"`);
  if (!SURFACE.test(surface))
    throw new UsageError(`--surface must be a route key or a kebab-case name (e.g. cat-harness/beans, navbar), not "${surface}"`);

  const suffixes = assetDirSuffixes(use, topic);
  let assetDir;
  let candidates;
  if (files.length) {
    candidates = files.map((f) => resolve(root, f));
    const dirs = [...new Set(candidates.map((c) => dirname(c)))];
    const outside = dirs.filter((d) => !inTopicDir(d, suffixes));
    if (outside.length)
      throw new UsageError(
        `topic "${topic}" (${use}) checks candidates in ${suffixes.join(" or ")}; not in it: ${outside.map((d) => relative(root, d) || ".").join(", ")}`,
      );
    if (dirs.length > 1) throw new UsageError(`candidates of one topic sit in one directory; got ${dirs.length}`);
    assetDir = dirs[0];
  } else {
    assetDir = findAssetDir(root, suffixes);
    if (!assetDir) throw new UsageError(`no wireframes for topic "${topic}" (${use}): looked for ${suffixes.join(" and ")}`);
    candidates = readdirSync(assetDir)
      .filter((f) => f.endsWith(".html"))
      .sort()
      .map((f) => join(assetDir, f));
    if (!candidates.length) throw new UsageError(`no candidate .html in ${relative(root, assetDir)}`);
  }

  if (use === "design" && candidates.length < 2)
    throw new UsageError(`design use compares at least two candidates; topic "${topic}" has ${candidates.length}`);
  if (use === "as-is") {
    const unmarked = candidates.filter((c) => !basename(c).startsWith("as-is"));
    if (unmarked.length)
      throw new UsageError(`as-is candidates are marked as-is in their file name; not marked: ${unmarked.map((c) => basename(c)).join(", ")}`);
    const allowed = asIsSurfaces(assetDir, topic);
    if (allowed && !allowed.includes(surface))
      throw new UsageError(`surface "${surface}" is not what wireframe "${topic}" covers; one of: ${allowed.join(", ")}`);
  }

  return {
    use,
    topic,
    surface,
    assetDir,
    candidates,
    out: resolve(root, flags.out ?? join(relative(root, assetDir), "checks")),
  };
}

/** Render every candidate at both viewports; write the screenshots and report.json. Returns the fail count. */
export async function runChecks(run, root = process.cwd()) {
  const { chromium } = await import("playwright");
  // input-site: env CHROMIUM #5df7212a — a Chromium binary to use when the pre-installed one is absent
  const exe = ["/opt/pw-browsers/chromium", process.env.CHROMIUM].find((p) => p && existsSync(p));
  const browser = await chromium.launch({ args: ["--no-sandbox"], ...(exe ? { executablePath: exe } : {}) });
  mkdirSync(run.out, { recursive: true });

  const rel = (p) => relative(root, p) || ".";
  const report = {
    tool: "wireframe-check",
    use: run.use,
    topic: run.topic,
    surface: run.surface,
    assetDir: rel(run.assetDir),
    viewports: VIEWPORTS,
    candidates: [],
  };
  let failed = 0;
  for (const f of run.candidates) {
    const cand = { file: rel(f), entries: [] };
    for (const [vp, size] of Object.entries(VIEWPORTS)) {
      const page = await browser.newPage({ viewport: size });
      const entry = (criterion, ok, note) => {
        cand.entries.push({ kind: "script", viewport: vp, criterion, result: ok ? "pass" : "fail", notes: note });
        if (!ok) failed++;
      };
      try {
        await page.goto("file://" + f, { waitUntil: "load", timeout: 30000 });
        const m = await page.evaluate(() => ({
          text: document.body.innerText,
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
        }));
        entry("renders", m.text.trim().length > 0, `${m.text.trim().length} characters of visible text`);
        entry("no-overflow", m.scrollW <= m.clientW, `scrollWidth ${m.scrollW}, viewport ${m.clientW}`);
        const hit = placeholderIn(m.text);
        entry("no-placeholder", !hit, hit ? `found "${hit[0]}"` : "none found");
        const shot = resolve(run.out, `${basename(f, ".html")}.${vp}.png`);
        await page.screenshot({ path: shot, fullPage: true });
        cand[`${vp}Screenshot`] = rel(shot);
      } catch (e) {
        entry("renders", false, String(e).slice(0, 200));
      }
      await page.close();
    }
    report.candidates.push(cand);
  }
  await browser.close();
  writeFileSync(resolve(run.out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(`${run.use} wireframe "${run.topic}" of ${run.surface}:`);
  for (const c of report.candidates)
    console.log(`${c.file}: ` + c.entries.map((e) => `${e.viewport}/${e.criterion}=${e.result}`).join(" "));
  return failed;
}

if (import.meta.main) {
  let run;
  try {
    run = resolveRun(process.argv.slice(2));
  } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    console.error(e.message);
    process.exit(2);
  }
  process.exit((await runChecks(run)) ? 1 : 0);
}
