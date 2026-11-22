/**
 * Render BPMN 2.0 sources to standalone SVG.
 *
 * The `.bpmn` files under `processes/` are the source of truth — plain BPMN
 * 2.0 with diagram interchange, so any BPMN tool opens them. This script
 * renders them to SVG for the docs site and for GitHub's Markdown renderer.
 *
 * Usage:  bun run cat-harness-tools/scripts/render-bpmn.ts [--check]
 *
 * `--check` renders to memory and fails if a committed beside-source SVG is
 * stale; the site copy is built at publish and is not judged.
 *
 * Never hand-edit `docs/assets/img/workflows/*.svg` — regenerate instead.
 *
 * The drawing itself (bpmn-js in headless Chromium, byte-stable and
 * responsive) is bootstrap-tools'
 * `scripts/render-bpmn.ts`. This is the SITE half: every layer's
 * diagrams, into this site's `workflows/`, with each step's title linking to
 * its page and each call activity's [+] to the process it calls
 * (`src/workflow/diagram-links.ts`).
 *
 * @covers processes, business-processes — it draws both kinds' diagrams (a folio block brings its own SVG)
 *
 * @conformsTo omg-bpmn-2.0
 * @conformsTo omg-dd-1.0
 */
import { businessProcessFiles, workflowFiles } from "./known-skills.js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { overlayPath, writePathOf } from "./lib/layer-output.ts";
import { basename, dirname, join, relative, resolve } from "node:path";
import {
  besideSource as besideSourceSvg,
  drawing,
  openRenderer,
  VIEWER_BUNDLE,
} from "@litlfred/bootstrap-tools/scripts/render-bpmn.ts";
import { checkXmlComments } from "./xml-comment-check";
import { diagramFit, type DrawnLabels } from "../src/workflow/diagram-fit.ts";
import { countLinks, EXPAND_LINK_CLASS, linkSteps, stepsOf, TITLE_LINK_CLASS } from "../src/workflow/diagram-links.ts";
import {
  siteDirFor,
  repoRootFor,
  layerRootsIn,
} from "../schemas/kg/cat-harness.ts";
import { checkoutProcessPresentations, processTarget } from "./process-presentations.js";
import { isGlobalTasksFile } from "../src/workflow/process-model.js";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { BESIDE_SOURCE_OUT_ENV, besideSourceTarget } from "./lib/beside-source-out.ts";
import { subjectHref } from "./lib/subject-pages.ts";
import { definersFrom, nearestDefiner, processDefiners } from "./lib/process-definers.ts";

const ROOT = resolve(HARNESS_ROOT);
/**
 * The `.bpmn` sources, from EVERY layer in the repository — each one's
 * declared knowledge-graph directories, via `workflowFiles` — not from the
 * literal `processes/`, and not from this layer alone.
 *
 * `workflowFiles` returns absolute paths, so `file` below is already complete
 * and nothing joins it to a base. That is the point: a topical layout
 * (`bootstrap/processes/`, `crdm/workflows/`) is found without this script
 * knowing the layout exists.
 *
 * Every layer, not just this one, since bean `oqdr` (2026-09-26): bootstrap
 * is a separate layer, so `workflowFiles(ROOT)` never reached its three
 * diagrams. Their SVGs sat in this site's `workflows/` rendered by nothing —
 * `initialize-harness.svg` went ten source commits stale, still drawing the
 * pre-rename role — and `render:bpmn:check`, which checks only what this
 * function returns, could not see it. The same walk `audit-coverage` and
 * `check-asset-roles` already do.
 *
 * Output names are the BASENAME, so two layers holding a diagram of the
 * same name would silently overwrite one SVG with the other. That was
 * "latent" while one directory fed this; with every layer feeding it, it
 * is refused rather than trusted.
 */
function bpmnSources(): string[] {
  const all = new Set<string>();
  for (const inst of layerRootsIn(repoRootFor(ROOT))) {
    // A layer's shared global tasks hold no process and so no diagram to
    // draw (owner, 2026-10-20, "a1"): each is drawn in the processes that call it.
    for (const f of workflowFiles(inst)) if (f.endsWith(".bpmn") && !isGlobalTasksFile(readFileSync(f, "utf8"))) all.add(f);
    // Business processes are drawn too, so their viewer pages have a diagram (Q-SUBG-3).
    for (const f of businessProcessFiles(inst, { folio: false })) all.add(f);
  }
  const byName = new Map<string, string[]>();
  for (const f of all) byName.set(basename(f), [...(byName.get(basename(f)) ?? []), f]);
  const clashes = [...byName].filter(([, fs]) => fs.length > 1);
  if (clashes.length > 0) {
    throw new Error(
      "render-bpmn: two diagrams would render to the same SVG name:\n" +
        clashes.map(([n, fs]) => `  ${n}: ${fs.join(", ")}`).join("\n"),
    );
  }
  return [...all].sort();
}
const OUT_DIR = join(ROOT, siteDirFor(ROOT), "assets/img/workflows");
// `node_modules/` is a REPOSITORY artefact — it sits beside `package.json` and
// `bun.lock`, which is where `bun install` writes it, and there is one per
// repository however many layers it holds. `ROOT` is this layer's root
// since the move (bean `wggr`), so joining here looked for
// `cat-harness/node_modules/` and reported bpmn-js as not installed.
//
// The message was the honest kind and still misleading: it named the exact
// missing file and told you to run `bun install`, which would not have helped
// because the package was already there, one level up.
const VIEWER = join(repoRootFor(ROOT), VIEWER_BUNDLE);

const check = process.argv.includes("--check");

/**
 * A site build sends the beside-source drawings out of the checkout
 * (`lib/beside-source-out.ts`): written beside an IG's `input/` they made its
 * cached AST stale. `--check` always compares the committed copies.
 */
const besideOut = check ? undefined : process.env[BESIDE_SOURCE_OUT_ENV] || undefined;
if (besideOut) console.log(`beside-source drawings → ${besideOut} (${BESIDE_SOURCE_OUT_ENV}), not beside each .bpmn`);

if (!existsSync(VIEWER)) {
  console.error(
    `bpmn-js not installed (${VIEWER} missing).\n` +
      `Run \`bun install\` — bpmn-js is a devDependency.`,
  );
  process.exit(1);
}

const sources = bpmnSources();
if (sources.length === 0) {
  console.error("No .bpmn sources found in any declared knowledge-graph directory");
  process.exit(1);
}

// Well-formedness before rendering, and before the browser launch: a diagram a
// conformant parser rejects is broken whether or not an SVG comes out of it,
// and bpmn-js will draw it regardless (that is how seven of these shipped).
// Reporting it here costs nothing and does not need Chromium.
const commentFindings = sources.flatMap((f) =>
  checkXmlComments(readFileSync(f, "utf8"), relative(ROOT, f)),
);
if (commentFindings.length > 0) {
  console.error(`${commentFindings.length} malformed XML comment(s) — refusing to render:\n`);
  for (const f of commentFindings) console.error(`  ${f.file}:${f.line}  ${f.detail}`);
  console.error(`\nRun \`bun run cat check:xml-comments\` for the full report.`);
  process.exit(1);
}

// `CHROMIUM_PATH` wins when set, then a probe of PLAYWRIGHT_BROWSERS_PATH: an
// explicit variable only helps someone who already knows the build numbers
// disagree, and re-downloading browsers is blocked in the sandbox.
const renderer = await openRenderer(VIEWER);

/**
 * Every `bpmn:process` id and ALL the files that define it, so a call
 * activity's `calledElement` can be resolved to a diagram rather than to a
 * bare id. Two layers of a composed checkout may define the same id; a link
 * then resolves to the definer nearest the referring diagram by path
 * (`lib/process-definers.ts`), never to whichever file was read last.
 */
const definers = processDefiners(
  await Promise.all(
    sources.map(async (file): Promise<[string, string[]]> => [
      file,
      [...(await readFile(file, "utf8")).matchAll(/<bpmn:process\s+id="([^"]+)"/g)].map((m) => m[1]!),
    ]),
  ),
);

/**
 * Page sections presenting each diagram, keyed relative to this layer —
 * from every docs source in the checkout, so a diagram presented on a page a
 * layer above this one authors is still linked to that section.
 */
const presentations = await checkoutProcessPresentations(ROOT);

/**
 * From a rendered SVG back up to the site root. Every link is written
 * relative to the SVG FILE, so it resolves correctly when the file is opened
 * on its own; `docs-ui.js` re-anchors it to the file's URL when it inlines the
 * drawing into a page, which may sit at any depth (the docs root, or
 * `processes/`). A link written relative to the page instead worked from the
 * docs root and broke under `processes/` — bean `xl55`.
 */
const SITE_UP = `${relative(OUT_DIR, join(ROOT, siteDirFor(ROOT))).split("\\").join("/")}/`;

/**
 * A step's own entry on its process's page in the processes viewer: the page
 * plus the step's anchor (`gen-processes-viz.ts` `stepAnchor`). Without the
 * anchor every title of a drawing shown ON that page linked the page itself,
 * so a click did nothing (smart-trust-demo, J3 "Verify each HCERT against the
 * trust list", 2026-11-11).
 */
export function stepOnProcessPage(home: string, step: string): string {
  return `${processTarget(home, undefined)}#step-${step}`;
}

/**
 * Where a call activity should take a reader who clicks it: the called
 * process's own page, `<doc dir>/process/P` (#603), where one is published.
 *
 * Otherwise DERIVED from the pages, never authored on the process: the page section
 * whose `asset.source` names the called diagram, or — when none does, or more
 * than one — the called process's own generated page
 * (`process-presentations.ts`). The process names no page; the page names
 * the process (data-modelling step 8, bean `xl55`).
 */
function subprocessLinks(file: string, xml: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of xml.matchAll(/<bpmn:callActivity\b([^>]*)>/g)) {
    const id = /\sid="([^"]+)"/.exec(m[1])?.[1];
    const called = /\scalledElement="([^"]+)"/.exec(m[1])?.[1];
    if (!id || !called) continue;
    const calledPath = nearestDefiner(definers, called, file);
    if (!calledPath) continue;
    const home = basename(calledPath, ".bpmn");
    const calledFile = relative(ROOT, calledPath);
    // The called process's own page, its subject IRI (owner, 2026-10-23: "the
    // info button/icons in the bpmn rendering should point to those new
    // IRIs", #603) — where its layer's graph publishes one; else its page
    // section or diagram page, as before.
    out.set(
      id,
      subjectHref(resolve(ROOT, calledFile), "process", called) ??
        SITE_UP + processTarget(home, presentations.get(calledFile)),
    );
  }
  return out;
}

/**
 * Every diagram ALSO gets an SVG beside its own `.bpmn`, which its layer
 * commits.
 *
 * Owner, 2026-11-05 (bean folio-assistant-akiq): *"why would source drawings
 * be in another layer?"* — each layer draws its own diagrams. The copy in
 * this site's `workflows/` links every step and [+] to this site's pages, so
 * it changes with the index's pins and is built at publish (one declared
 * directory). The copy beside the source links only to sibling diagrams, so
 * it is a function of its own layer's commit and that layer commits it:
 * a new diagram is judged in the layer that added it, and no lower layer
 * lists a higher layer's files. Once only the layers exempt from the
 * `workflow-visualiser` obligation got one (owner, 2026-09-29: *"display
 * bpmn(s) etc in README.md"*); that left every other layer's drawing in a
 * layer below it.
 */
const besideSource = new Set(sources);

let stale = 0;

/** Write `text` to `out`, or with `--check` report whether it is current. */
async function emit(out: string, text: string, besideSource = false): Promise<void> {
  // Read over the layer overlay: a mounted layer's drawing may already sit at
  // its output root (bean `cat-tools-sm8r`).
  const at = overlayPath(out);
  const previous = existsSync(at) ? await readFile(at, "utf8") : null;
  const shown = relative(repoRootFor(ROOT), out);
  if (check) {
    if (previous !== text) {
      console.error(`✗ ${shown} is stale — re-run \`bun run cat render:bpmn\``);
      stale++;
    } else {
      console.log(`✓ ${shown} up to date`);
    }
    return;
  }
  // Unchanged bytes are not rewritten: a rewrite of the same picture moved
  // the file's mtime inside every mounted layer (152 of the 165 diagrams a
  // composed publish touched in mounts, measured 2026-11-15). A changed
  // BESIDE-SOURCE drawing of a mounted layer goes to the output root's twin,
  // never into the mount; the site copy stays where it is declared
  // `builtAtPublish` (`docs/assets/img/workflows/`), so no site reader moves.
  if (previous === text) {
    console.log(`= ${shown}`);
    return;
  }
  const to = besideSource ? writePathOf(out) : out;
  await mkdir(dirname(to), { recursive: true });
  await writeFile(to, text, "utf8");
  console.log(`✓ ${shown}${to === out ? "" : ` → ${relative(repoRootFor(ROOT), to)}`}`);
}

for (const file of sources) {
  const xml = await readFile(file, "utf8");
  let rendered: { svg: string; warnings: string[]; layout?: DrawnLabels };
  try {
    rendered = await renderer.render(xml);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`✗ ${file}: ${msg.split("\n")[0]}`);
    process.exitCode = 1;
    continue;
  }

  const { svg, warnings } = rendered;

  // Readable at 100%, and untangled (owner, 2026-10-31: "QA on too wide/too
  // tall bpms?", "add as QA and author check"). Reported, never failed: most
  // diagrams predate the budget, and the fix is an author's layout call. The
  // same report, with the lane-swap fix, is `bun run cat bpmn:detangle`.
  const fit = Object.entries(diagramFit(xml, rendered.layout)).filter(([, fs]) => fs.length > 0);
  if (fit.length > 0) {
    const n = fit.reduce((t, [, fs]) => t + fs.length, 0);
    console.warn(`⚠ ${relative(ROOT, file)}: ${n} readability finding(s): ${fit.map(([k, fs]) => `${k} ×${fs.length}`).join(", ")}`);
  }

  if (warnings.length > 0) {
    console.error(`✗ ${file}: ${warnings.length} import warning(s)`);
    for (const w of warnings) console.error(`    ${w}`);
    process.exitCode = 1;
    continue;
  }

  // Deterministic arrowhead ids, a white backdrop and a responsive width —
  // bootstrap-tools' `drawing`, which says why each is there.
  const responsive = drawing(svg, "folio-marker-");
  if (responsive === undefined) {
    console.error(`✗ ${file}: could not make the SVG responsive — bpmn-js output changed shape`);
    process.exitCode = 1;
    continue;
  }

  // Each link on the part of the shape it names (owner, 2026-11-03,
  // cat-harness#991: "linked tasks should be on the task title only, not the
  // whole box. the subprocess should be opened by the [+] not the whole box"):
  // a step's TITLE opens the step's own page, `process/P/node/T`, and a call
  // activity's [+] opens the process it calls. Only live once the SVG is in the
  // DOM — inside an `<img>` it is inert — which docs-ui.js arranges by
  // inlining these figures. `diagram-links.ts` says why each is shaped so.
  //
  // A step with no page of its own — a downstream site, where kg-export
  // writes no subject pages (#1581) — still has a title link: to its
  // process's page in the processes viewer, which lists the steps. Every site
  // that publishes this drawing publishes that page (the visualiser writes it
  // from the same sources), whereas a docs page presenting the diagram may
  // be the host's alone, so it is the one target sure to resolve. Every
  // title is then clickable on every site, and a page that shows the drawing
  // — a process page, a guide's business-processes page — shows the same
  // affordances.
  const steps = stepsOf(xml);
  const stepName = new Map(steps.map((s) => [s.id, s.name]));
  const titles = new Map<string, { href: string; name: string }>();
  for (const s of steps) {
    const href = subjectHref(file, "process", `${s.process}/node/${s.id}`) ?? SITE_UP + stepOnProcessPage(basename(file, ".bpmn"), s.id);
    titles.set(s.id, { href, name: s.name });
  }
  const expands = new Map([...subprocessLinks(file, xml)].map(([id, href]) => [id, { href, name: stepName.get(id) ?? id }]));
  const linked = linkSteps(responsive, titles, expands);
  const nTitles = countLinks(linked, TITLE_LINK_CLASS);
  const nExpands = countLinks(linked, EXPAND_LINK_CLASS);
  if (nExpands !== expands.size || nTitles !== titles.size) {
    console.error(
      `✗ ${file}: ${expands.size} [+] and ${titles.size} title link(s) to place but ${nExpands} and ${nTitles} placed — ` +
        `bpmn-js shape markup changed, so the links would be silently missing`,
    );
    process.exitCode = 1;
    continue;
  }

  // The site copy is built at publish (cat-harness.json `builtAtPublish`
  // `docs/assets/img/workflows/`), never committed, so `--check` has no
  // committed bytes to compare it with: judging it read every diagram as stale
  // in any checkout that had not just run the writer, and kept this gate red on
  // main. `--check` judges the committed beside-source copy only, as a QA
  // report, not a merge gate (owner, 2026-11-13: "bpmn and svg dont need to
  // render to merge. that QA report").
  if (!check) await emit(join(OUT_DIR, `${basename(file, ".bpmn")}.svg`), linked);

  if (besideSource.has(file)) {
    // bootstrap-tools' OWN writer, not a copy of it. The two used to be
    // separate implementations of the same picture, and they drifted the day
    // bootstrap-tools began stamping "Generated by bootstrap-tools" on what it
    // writes into bootstrap (bean `xsqm`, owner 2026-09-30): this copy wrote the
    // SVG without the note, so each writer called the other's output stale and
    // `render:bpmn:check` went red on main. One writer, one set of bytes.
    const own = await besideSourceSvg(renderer, file, definersFrom(definers, file));
    if ("error" in own) {
      console.error(`✗ ${file}: ${own.error}`);
      process.exitCode = 1;
      continue;
    }
    await emit(besideSourceTarget(file, repoRootFor(ROOT), besideOut), own.svg, true);
  }
}

await renderer.close();
if (stale > 0) process.exit(1);
