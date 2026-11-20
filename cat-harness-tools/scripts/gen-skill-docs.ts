#!/usr/bin/env bun
/**
 * gen-skill-docs.ts — Render the skill *instruction bodies* (the prose how-to
 * markdowns the LLM loads) as browsable HTML pages on the docs site, with an
 * index.
 *
 * Sources: every declared skills directory in the corpus, one group each.
 *
 * Output (consumed by Jekyll → HTML on GitHub Pages):
 *   docs/reference/skill-instructions/<name>.md   (+ index.md)
 *
 * Each generated page gets just-the-docs front matter (any front matter already
 * present in the source body is stripped first) and links back to the source
 * and the skill's typed schema. Never hand-edit the output; `--check` reports
 * drift. Regenerate with:
 *
 *     bun run cat-harness-tools/scripts/gen-skill-docs.ts
 *
 * @module scripts/gen-skill-docs
 * @covers skills, docs
 */

import { markdownEditLink, repoOf } from "../src/core/edit-links.js";
import { detectRepoUrl } from "../src/core/git-refs.js";
import { orphanPages } from "./doc-orphans.ts";
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "fs";
import { join, resolve, basename, dirname, relative, isAbsolute, sep } from "path";

import { isSkillMd, kgDirectories, corpusScopeFor } from "./known-skills.js";
import { packageDirsIn } from "./skill-topics.js";
import { instanceRoots, processRows, type ProcessRow } from "./gen-processes-viz.js";
import { forgeHrefFor, skillContractSectionMd } from "./tool-page.ts";
import { checkoutRootFor, readDeclaration, siteDirFor, repoRootFor } from "../schemas/kg/cat-harness.ts";
import { findDeclarationFile } from "../schemas/kg/instance-roots.ts";
import { stripInlineCode } from "../schemas/content/inline-code.ts";
import { wrapRaw } from "./lib/liquid-raw.ts";
import { publishedPagePath } from "./lib/jekyll-permalink.ts";
import { PAGE_LOCALE, visualiserSitePath } from "./viewer-declarations.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { writeProvenanceListing } from "./provenance-footer.ts";
import { readPathAt, writePathAt } from "./lib/layer-output.ts";

/** The repository the edit links name: this checkout's origin, else folio-assistant (bean v433). */
const SKILL_DOCS_REPO = repoOf(detectRepoUrl(process.cwd()));

const INSTANCE_ROOT = resolve(HARNESS_ROOT);
const REPO_ROOT = repoRootFor(INSTANCE_ROOT);

/**
 * The REPOSITORY-relative path of an absolute directory, or `undefined` when it
 * cannot be named as one.
 *
 * Bean `oe98`. The source and edit links were composed from a prefix relative
 * to the LAYER root, so 240 of 244 pages linked `skills/...` (the pre-split
 * path — there is no `skills/` at the repository root) and nine linked
 * `../bootstrap/skills/...`, a parent segment no GitHub URL can carry. Both are
 * the same mistake: a link into the repository has to be relative to the
 * repository, and `repoRootFor` is the one place that says where that is.
 *
 * A directory outside the checkout (a dependency resolved from a sibling
 * clone) has no path in THIS repository, so it gets no link rather than a
 * normalised one that 404s.
 */
export function repoRelative(abs: string, repoRoot: string = REPO_ROOT): string | undefined {
  const rel = relative(repoRoot, abs);
  if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return undefined;
  return rel.split(sep).join("/");
}
// A pencil, as a text glyph rather than an inline SVG. 130 generated pages
// each carrying an SVG is 130 copies of the same markup in the repo and in
// every reader's download; one character is not.
const EDIT_GLYPH = "\u270E";

/**
 * Where the process pages are: the route of the visualiser cat-harness
 * DECLARES rendered by `processes-viewer` (owner, 2026-10-09:
 * `<base>/<harness>/<visualizer>`, under the page locale — folio-assistant#2527),
 * read rather than spelled.
 */
const PROCESSES_ROUTE = ((): string => {
  try {
    return dirname(visualiserSitePath(INSTANCE_ROOT, "processes-viewer").rel);
  } catch {
    return `${PAGE_LOCALE}/cat-harness/processes`;
  }
})();
const OUT_DIR = join(INSTANCE_ROOT, siteDirFor(INSTANCE_ROOT), "reference", "skill-instructions");

/**
 * Where the pages are written, compared and listed.
 *
 * Where the layer is MOUNTED (bean `cat-tools-sm8r`, item 4), the pages are
 * computed output and live whole at the layer's output root
 * (`build/layers/<instance>/…`, `lib/layer-output.ts`), never in the pinned
 * mount; `compose-docs` lays that twin over the mount. A write goes to the
 * twin; `--check` compares each page a reader would see (the twin, else the
 * pinned copy), and judges orphans in the twin once it exists, else in the
 * pinned directory. In the layer's own checkout every path is `outDir`'s own.
 */
export function skillDocsTargets(
  outDir: string,
  check: boolean,
  checkout: string,
): { dir: string; writeAt: (abs: string) => string; readAt: (abs: string) => string } {
  const writeAt = (abs: string): string => writePathAt(checkout, abs);
  const readAt = (abs: string): string => readPathAt(checkout, abs);
  const twin = writeAt(outDir);
  return { dir: check && !existsSync(twin) ? outDir : twin, writeAt, readAt };
}
/** Resolved on first use, so a module that only imports a helper reads no lock. */
let targets: ReturnType<typeof skillDocsTargets> | undefined;
const TARGETS = (): ReturnType<typeof skillDocsTargets> =>
  (targets ??= skillDocsTargets(OUT_DIR, process.argv.includes("--check"), checkoutRootFor(INSTANCE_ROOT)));

/**
 * `--check`: verify the generated tree is current without writing to it.
 *
 * These pages are generated from skill sources and the repo forbids editing
 * them by hand, but nothing verified they had actually been regenerated after
 * a source change — so `document-intake.md` sat 35 lines behind its source
 * (the PDF-extraction ladder) and the published docs site served the stale
 * copy. A generated file with no drift guard is a file that silently rots.
 *
 * Collects every path whose content would change, so one run reports all of
 * them rather than the first.
 */
const CHECK_ONLY = process.argv.includes("--check");
const drifted: string[] = [];

/**
 * Published names two groups both claimed, with no `publishPrefix` between
 * them and no entry in {@link SAME_BASENAME_DIFFERENT_DOCUMENT}.
 *
 * Bean `v3se`. This was a `↪` line in a list of 173 successes, and the
 * consequence was the one bootstrap exists to prevent: `kg-navigation` existed
 * twice — bootstrap's assuming NOTHING, folio-core's assuming the harness is
 * installed — and the generator kept folio-core's. CatBootstrap's README sends a
 * cold agent to read that name *before anything else is known*, so the reader
 * least able to notice was served the body written for a repository it was not
 * in.
 *
 * A DECLARED pair is not this: it carries a prefix, publishes under two names
 * and gets a directional banner on each. What this catches is one name, two
 * documents, and nobody having decided which governs — which is a judgement
 * somebody has to make, not something a generator may settle by running order.
 *
 * Promoted to a hard failure while the count is ZERO (measured 2026-09-20,
 * after `3jj9` renamed bootstrap's copy). That is this repository's rule for
 * every ratchet — an error only once the backlog is drained — and it is also
 * the only moment the promotion is free.
 */
const collisions: Array<{ published: string; kept: string; from: string }> = [];

function emit(path: string, content: string): void {
  if (CHECK_ONLY) {
    const at = TARGETS().readAt(path);
    const current = existsSync(at) ? readFileSync(at, "utf-8") : null;
    if (current !== content) drifted.push(path);
    return;
  }
  const to = TARGETS().writeAt(path);
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, content);
}

/**
 * An undeclared collision fails the run — writing mode too, not just `--check`.
 *
 * Dropping a document is not a staleness problem that a re-run fixes; it is a
 * document that never reaches the site at all. Reporting it only under
 * `--check` would leave the writer cheerfully publishing 173 pages and one
 * silence.
 */
function reportCollisions(): void {
  if (collisions.length === 0) return;
  console.error(
    `\n✗ ${collisions.length} published name(s) claimed by two groups, with no ` +
      `prefix between them and no SAME_BASENAME_DIFFERENT_DOCUMENT entry.\n` +
      `  One name, two documents: the later one was DROPPED and is not on the site.\n`,
  );
  for (const c of collisions) {
    console.error(`  ${c.published}: kept ${c.kept}, dropped the copy from ${c.from}`);
  }
  console.error(
    `\n  Resolve it deliberately rather than by running order — give the group a ` +
      `\`publishPrefix\`, or\n  declare the pair in SAME_BASENAME_DIFFERENT_DOCUMENT ` +
      `so both publish with a directional banner.\n  Bean \`v3se\`: the collision this ` +
      `guards served a cold bootstrap agent the body for a\n  repository it was not in.`,
  );
  process.exit(1);
}

/**
 * The index row's summary: the first 100 characters of a skill's opening
 * paragraph, never ending inside a link.
 *
 * A plain cut at 100 lands inside a `](...)` target often enough to publish a
 * dead link in the index (`../../en/cat-harness/proces`). When the cut falls
 * inside a link target, it is extended to that link's closing parenthesis, so
 * the row keeps the link whole.
 */
export function indexSummary(line: string, max = 100): string {
  const cut = line.slice(0, max);
  if (cut.length === line.length) return cut;
  const open = cut.lastIndexOf("](");
  if (open === -1 || cut.includes(")", open)) return cut;
  const close = line.indexOf(")", open);
  return close === -1 ? cut : line.slice(0, close + 1);
}

export { orphanPages };

/**
 * A committed page no source produces is a STALE DOCUMENT, and it is the one
 * failure `--check` was structurally unable to see.
 *
 * `emit` compares content per path and collects what DIFFERS. A page whose
 * source has gone is never emitted at all, so it is never compared: the drift
 * report reads "up to date" over it, for as many months as nobody looks. Bean
 * `3x2o` measured it — `fhir-client-operations.md` and `smart-launch.md`, two
 * pages produced by nothing, dated to the commit that last regenerated them
 * while the skills they were generated from had become unreachable.
 *
 * The danger is not the stale bytes, it is the BANNER. Every page carries
 * "Generated from `<path>` — do not edit here" with an edit link; on an orphan
 * that is an instruction to go and edit a source that is not the source of
 * anything published. A reader cannot tell it apart from a live page.
 *
 * It REPORTS and never deletes. That is
 * `deletion-requires-confirmation` — an agent does not remove a durable
 * artefact on its own initiative — and it is not timidity here: an orphan has
 * two opposite causes. Either the skill was removed and the page should go, or
 * the DIRECTORY STOPPED BEING DECLARED and the page is the only surviving
 * evidence that it used to publish. This generator cannot tell which, and the
 * second case is what actually happened: `rm`-ing these two would have
 * destroyed the trace that led to the missing declaration.
 *
 * Promoted to a hard failure while the count is ZERO, which is this
 * repository's rule for every ratchet and also the only moment it is free.
 * Fails in writing mode too, for `reportCollisions`' reason: a re-run does not
 * fix it, so exiting 0 would bury it.
 */
/**
 * Twin entries naming a page this run does not produce.
 *
 * Pure and exported, for the reason {@link orphanPages} is: on the real corpus
 * the answer is the empty set, and an empty set is also what a guard computing
 * nothing returns.
 *
 * Both halves matter and they fail differently. A `published` name nothing
 * produces is the `bsay` defect — a banner asserting a document that is not
 * there, with a link to it. An entry whose OWN name is not among the twins is
 * a table that contradicts itself, which would make `other`/`self` below pick
 * the wrong side silently.
 */
export function unpublishedTwins(
  table: Readonly<Record<string, ReadonlyArray<{ published: string }>>>,
  produced: Iterable<string>,
): string[] {
  const made = new Set(produced);
  const out: string[] = [];
  for (const [name, twins] of Object.entries(table)) {
    if (!twins.some((t) => t.published === name)) out.push(`${name}: no twin publishes under "${name}" itself`);
    for (const t of twins) if (!made.has(t.published)) out.push(`${name} -> ${t.published}`);
  }
  return out.sort();
}

/**
 * A twin entry is only true while BOTH its pages are produced.
 *
 * Bean `bsay`. `kg-navigation` named a second document that stopped publishing
 * when `pve3` ruled bootstrap's skills out of this layer, and the generator
 * kept emitting a banner for it — naming a page and linking to it — because
 * the table is consulted for a name being PUBLISHED and never asked whether
 * the partner is. So the check ran on the wrong side of the relation.
 *
 * Distinct from {@link reportOrphans}, which compares the output DIRECTORY
 * against this run. An orphan is a page with no source; this is a LINK to a
 * page that was never a page, so no sweep of the directory can see it.
 *
 * Fatal, and in writing mode too, for `reportCollisions`' reason: the wrong
 * banner is already written by the time this runs, and a re-run does not
 * unwrite it. The count is zero once `kg-navigation` is out, so the ratchet is
 * free — this repository's rule for every promotion.
 */
/**
 * The twin entries that apply to THIS checkout: an entry is dropped when one of
 * its twins is published by a group whose directory this checkout does not
 * hold, so neither page carries a banner naming a page that cannot exist here,
 * and the guard below does not fail on it.
 *
 * Measured on smart-ra#66 (run 38714163952): `derive:publish` failed on
 * `skills:docs` because the `local-` twins come from `.claude/skills/local/`,
 * which the folio-assistant index has and a document folio does not. That is
 * not the `bsay` defect: no group stopped publishing; the group is not here.
 *
 * What it keeps fatal, so the `bsay` guard still holds wherever it can say
 * anything: a twin whose group directory IS present and that produced no page
 * (the stub was removed), and a twin no declared group would publish at all
 * (the table contradicts the group list). Both stay in the table, and
 * {@link unpublishedTwins} refuses them.
 */
export function twinsInCheckout<T extends { published: string }>(
  table: Readonly<Record<string, ReadonlyArray<T>>>,
  groups: ReadonlyArray<{ dir: string; publishPrefix?: string }>,
  exists: (dir: string) => boolean,
): { table: Record<string, ReadonlyArray<T>>; absent: string[] } {
  const out: Record<string, ReadonlyArray<T>> = {};
  const absent: string[] = [];
  for (const [name, twins] of Object.entries(table)) {
    const missing = twins.filter((t) => {
      const publishers = groups.filter((g) => `${g.publishPrefix ?? ""}${name}` === t.published);
      return publishers.length > 0 && !publishers.some((g) => exists(g.dir));
    });
    if (missing.length === 0) out[name] = twins;
    else absent.push(`${name} -> ${missing.map((t) => t.published).join(", ")}`);
  }
  return { table: out, absent: absent.sort() };
}

function reportUnpublishedTwins(produced: Iterable<string>): void {
  for (const a of TWINS.absent) console.log(`  twin not in this checkout (its group's directory is absent; no banner either side): ${a}`);
  const bad = unpublishedTwins(TWINS.table, produced);
  if (bad.length === 0) return;
  console.error(
    `\n✗ ${bad.length} SAME_BASENAME_DIFFERENT_DOCUMENT entr(y/ies) name a page this run did not produce.\n` +
      `  Each makes the OTHER page carry a banner asserting a document that is not there,\n` +
      `  with a link to it — which a reader acts on.\n`,
  );
  for (const b of bad) console.error(`  ${b}`);
  console.error(
    `\n  Either the twin stopped publishing (remove the entry, and SAY WHY — the entry is\n` +
      `  the record of a real collision), or it should publish and its group is missing.\n` +
      `  Do not "fix" it by renaming the target: a banner naming a page that exists but is\n` +
      `  not the twin is the same lie, harder to find.`,
  );
  process.exit(1);
}

function reportOrphans(produced: Iterable<string>): void {
  const orphans = orphanPages(existsSync(TARGETS().dir) ? readdirSync(TARGETS().dir) : [], produced);
  if (orphans.length === 0) return;
  console.error(
    `\n✗ ${orphans.length} page(s) in the output directory were produced by NO source.\n` +
      `  Each carries a "Generated from … — do not edit here" banner naming a source that\n` +
      `  publishes nothing, which a reader cannot distinguish from a live page.\n`,
  );
  for (const f of orphans) console.error(`  ${join(TARGETS().dir, f)}`);
  console.error(
    `\n  TWO opposite causes, and this cannot tell them apart, so it removes nothing:\n` +
      `    - the skill was deleted, and the page should be deleted too; or\n` +
      `    - its directory stopped being DECLARED, and the page is the only evidence\n` +
      `      that it used to publish — which is what bean \`3x2o\` found.\n` +
      `  Check the declaration first. If the source really is gone, a person deletes the\n` +
      `  page; \`deletion-requires-confirmation\` is why this does not.`,
  );
  process.exit(1);
}

function reportDrift(): void {
  if (!CHECK_ONLY) return;
  if (drifted.length === 0) {
    console.log("generated docs are up to date");
    process.exit(0);
  }
  console.error(
    `generated docs are STALE (${drifted.length} file(s)); re-run without --check:`,
  );
  for (const p of drifted) console.error(`  ${p}`);
  process.exit(1);
}

const SCHEMA_DIR = join(INSTANCE_ROOT, siteDirFor(INSTANCE_ROOT), "reference", "skills");

interface Group {
  category: string;
  dir: string;
  /**
   * REPOSITORY-relative path of {@link dir}, for the "source" and "edit"
   * links — derived by {@link repoRelative}, never written by hand.
   * `undefined` when the directory is not inside this checkout; the page then
   * says so instead of linking.
   */
  repoPrefix: string | undefined;
  /**
   * Prefix for the PUBLISHED filename, for a group whose basenames can collide
   * with another group's.
   *
   * The output directory is flat, so two groups' identical basenames would have
   * one silently overwrite the other. `.claude/skills/local/todo-manager.md`
   * and `work-plan/skills/work-plan/todo-manager.md` collide that way.
   *
   * **The divergence that made this urgent is RESOLVED (bean `tdmg`,
   * 2026-09-19); the prefix is still required.** They were 369 and 396 lines
   * with 261 diff lines, each carrying sections the other lacked, and which
   * was canonical was open. It is now settled by measurement — `LOCAL_PACKAGES`
   * in `src/tools/skill-fetch.ts` serves `skills/folio-core` and has no
   * `.claude/skills/local` entry, so only the former was ever servable — and
   * the local copies are stubs pointing at it. The collision remains because
   * the stubs still publish, so do not drop `published`.
   *
   * So the prefix is not cosmetic: it is what lets both be published, which is
   * what makes the divergence visible instead of letting the generator pick a
   * winner by directory order.
   */
  publishPrefix?: string;
}

/**
 * Basenames held by more than one group as GENUINELY DIFFERENT documents.
 *
 * Not a list of duplicates to deduplicate — the generator's `written` map
 * already collapses a true duplicate. This is the opposite case: one name, two
 * documents, neither a copy of the other, which the flat output directory would
 * otherwise resolve by whichever group ran first.
 *
 * Kept as data rather than inferred by diffing, because "these two files differ"
 * is not the same claim as "these two files are meant to be different". The
 * first is measurable and the second is a judgement somebody has to make.
 */
const SAME_BASENAME_DIFFERENT_DOCUMENT: Record<
  string,
  Array<{ published: string; label: string; canonical?: true }>
> = {
  "todo-manager": [
    {
      published: "todo-manager",
      label: "Session Task Manager (folio-core)",
      canonical: true,
    },
    {
      published: "local-todo-manager",
      label: "todo-manager (local stub)",
    },
  ],
  // THERE IS NO `kg-navigation` ENTRY, and removing it was the `bsay` repair.
  //
  // It was added with `tdmg` for a real collision: bootstrap's copy and the
  // tooled one are different documents, and neither page said the other
  // existed. Then `pve3` ruled bootstrap's skills out of this layer
  // entirely, and the SECOND DOCUMENT STOPPED PUBLISHING HERE while this entry
  // stayed. Nothing downstream checks that a twin's page is produced, so the
  // generator went on emitting the banner:
  //
  // > **This is the skill `skill_fetch` serves.** A stub of the same name is
  // > published as [Reading a knowledge graph before you have anything
  // > (bootstrap)](local-kg-navigation.html); it only points here.
  //
  // `local-kg-navigation.html` does not exist and cannot: that name comes from
  // the `local-` prefixed group, and `.claude/skills/local/` holds three
  // skills of which `kg-navigation` is not one. So the live page a reader is
  // sent to for "how to find the skill you need" asserted a document that is
  // not there and linked a 404 — worse than the `bootstrap` heading's silence,
  // because a reader ACTS on a banner.
  //
  // {@link twinsPublish} is the guard, and it is the reason this is a comment
  // rather than a quiet deletion: an entry here is only meaningful while BOTH
  // its pages are produced, and until now nothing said so.
  "bean-coordination": [
    {
      published: "bean-coordination",
      label: "Bean Coordination (folio-core)",
      canonical: true,
    },
    {
      published: "local-bean-coordination",
      label: "bean-coordination (local stub)",
    },
  ],
};

/**
 * A human-readable category per skill package, for the packages under
 * `skills/`.
 *
 * **The DIRECTORIES are discovered; only the LABEL is declared**, because a
 * label is prose nobody can derive. A package found on disk with no entry here
 * is a hard error naming it — see {@link discoverGroups}.
 */
const SKILLS_CATEGORIES: Record<string, string> = {
  "content-lifecycle": "Lifecycle skills",
  "folio-core": "Platform core (folio-core)",
  workflow: "Workflow & process (workflow)",
  "graph-management": "Graph management (graph-management)",
  // The `kg` and `library` topics' packages (bean `9umr`): keyed by the
  // package's own basename, like every entry here — the topic is a level of
  // the directory, not part of the name.
  "kg-core": "Knowledge graph — declaration, placement, export, audit (kg-core)",
  "library-core": "Library and information management (library-core)",
  "ui-core": "Rendering, UI and publication surfaces (ui-core)",
  "conduct-core": "Agent conduct (conduct-core)",
  "process-core": "Process model — roles, authorization, methodology (process-core)",
  "authoring-core": "Content authoring and editorial review (authoring-core)",
  "sdlc-core": "Software delivery practice — review, merge, CI, coordination (sdlc-core)",
  // Split out of `sdlc-core` into the opt-in `work-plan` sub-graph of cat-harness (cat-harness#991 step 23.2).
  "work-plan": "The work plan — beans, claiming, blocking, draining, the store (work-plan)",
  // The opt-in sub-graphs of card Q-SG-1 C (2026-11-10): packages moved out of
  // always-on ones so a layer that does not enable them mounts less.
  "editorial-audits": "Editorial audits — voice, readability, watchers (editorial-audits)",
  "kg-ops": "Knowledge graph operations — N-Quads, named queries, fencing (kg-ops)",
  "platform-ui": "Platform UI — theming checks, viewers, render QC (platform-ui)",
  dsa: "Data Sharing Agreements — DCAT records, checksums, ODRL (dsa)",
  board: "The board — diagram interchange and windows (board)",
  "library-extras": "Library extras — transcription, photo ingestion, catalogue search (library-extras)",
  theming: "Theming (theming)",
  // Keyed by basename: a package subdirectory of the declared `skills/`,
  // like `theming` above. Bean `6bhf`, owner 2026-09-25 — "bean as
  // ceybeesquity sub KG in tools ... consolidate". The heading names the
  // BOUNDARY axis rather than a list of attacks, because that is the split
  // the package is built on and a reader meeting it here should see which.
  security: "Security — values crossing a boundary (security)",
  "folio-document-adapter": "Document adapter (folio-document-adapter)",
  "folio-paper-adapter": "Paper adapter (folio-paper-adapter)",
  "authoring-math": "Mathematical authoring (authoring-math)",
  "authoring-who-smart-guidelines": "WHO SMART Guidelines (authoring-who-smart-guidelines)",
  // The SMART Guidelines knowledge levels: each level's skill package sits in
  // its own opt-in group, mounted only where enabled, so each needs a label.
  "smart-l1": "SMART Guidelines L1: narrative guidance (smart-l1)",
  "smart-l2": "SMART Guidelines L2: operational content (smart-l2)",
  "smart-l3": "SMART Guidelines L3: machine-readable content (smart-l3)",
  "smart-l4": "SMART Guidelines L4: executable components (smart-l4)",
  // Packages of a health-credential library layer mounted above this one
  // (owner, 2026-11-07). Headings say what the skills are about, never which
  // layer holds them: this layer may not name a higher one.
  hcert: "Health certificates — encoding, signing and verifying an HCERT (hcert)",
  "hcert-library": "Health-certificate libraries — architecture, contract and conformance (hcert-library)",
  vhl: "Verifiable Health Links — sharing and receiving (vhl)",
  wallet: "Health-credential wallets — holding, handing over and scanning (wallet)",
  // Placement PR1 (bean `ybwt`): packages split out of the harness's content
  // packages when they moved up to their owning layer, by #1702's theme.
  "fhir-ig-authoring": "FHIR IG authoring (fhir-ig-authoring)",
  "content-lifecycle-ext": "Content lifecycle refinements (content-lifecycle-ext)",
  "requirements-planning": "Requirements planning (requirements-planning)",
  ingestion: "Document ingestion methods (ingestion)",
  // Bean `7eak`: rendering catalogue records as standard Dublin Core.
  catalogue: "Catalogue records — Dublin Core renderings (catalogue)",
  // Placement PR6 (bean `apcg`): the cataloguing methods that moved up out of
  // the harness's `library-core`.
  cataloguing: "Cataloguing methods (cataloguing)",
  // The content core's 6fc33b4 (bean `0jtl`): a pointer package naming the
  // review skills in reading order. Without a heading `skills:docs` throws and
  // `skill:register` stops.
  review: "Where to start reviewing a large folio (review)",
  // Declared directories that hold their skills DIRECTLY, so they are keyed by
  // the declaration's id, like `crdm` and `bootstrap` below. All three were
  // declared in `cat-harness.json` with no label here, which made
  // `skills:docs` — and through it `skill:register` — throw on main
  // (found 2026-10-01 while working #1757).
  "folio-assistant-core-skills": "Core layer — high-level processes (folio-assistant-core-skills)",
  "folio-assistant-sci-lean-skills": "Science layer — Lean tooling (folio-assistant-sci-lean-skills)",
  "folio-assistant-sci-data-skills": "Science layer — reference data (folio-assistant-sci-data-skills)",
  // Stubs for skills a remote package DECLARES and this layer does not
  // vendor. The heading says "not implemented" in the reader's own words,
  // because the published page is where somebody meets one of these first and
  // the worst outcome is following it as guidance. `kg:audit` carries the same
  // fact for machines, under `skill-is-a-stub`.
  // Each methodology under `workflow-methodologies/` is its own declared
  // subgraph and gets its own heading — the point of the layout is that a
  // reader meets CRDM as a THING rather than as three skills scattered
  // through folio-core with a filename prefix relating them. Owner,
  // 2026-09-20: RACI, SDLC and MADR join it, each with a heading of its own
  // when it exists. Nothing is declared before it has content — a
  // declared-but-absent directory is the `dh4f` defect.
  // Keyed on the DECLARATION'S id, not the directory basename: this root
  // holds its skills directly, so `discoverGroups` takes the
  // `SKILLS_CATEGORIES[decl.id]` branch — the same one `bootstrap` uses
  // below. Keyed on `crdm` it threw, naming the id it actually wanted.
  // `theming` is above, keyed by its package-subdirectory name. Two sessions
  // built that package independently on 2026-09-20 and this entry was the
  // duplicate: one put it at `skills/ui/theming/` (a subdirectory, keyed by
  // basename) and the other at a top-level `cat-harness/theming/` (a declared
  // directory, keyed by id). Same key either way, so the object literal had
  // it twice. The subdirectory won on evidence — bean `lps0` measured that
  // `kg-audit`'s `skillFiles()` walks a hardcoded `skills/`, so the top-level
  // placement silently dropped its skills out of skill QA.
  // KEYED BY BASENAME SINCE 2026-09-22, not by declaration id. These two
  // were `methodology-crdm` and `methodology-raci` while they were
  // top-level declared directories under `methodologies/`; the owner's
  // "dont bury sub-graph assets" moved them into `skills/`, where they are
  // package subdirectories and `discoverGroups` takes the basename branch
  // instead. The old keys would not have failed loudly — they would simply
  // never match, and the generator throws naming the id it wanted, which is
  // how this was caught rather than shipped as two uncategorised packages.
  crdm: "CRDM requirements methodology (skills/process/crdm)",
  raci: "RACI involvement model (skills/process/raci)",
  "spec-kit": "Spec Kit spec-driven development (sdlc/skills/spec-kit)",
  // Synced from claude-scientific-skills at a pinned commit (issue #556):
  // somebody else's bytes, one package per skill so upstream's relative links
  // resolve. `remote-stubs` was retired when these arrived.
  "hypothesis-generation": "Synced from claude-scientific-skills (pinned, read-only)",
  "scientific-critical-thinking": "Synced from claude-scientific-skills (pinned, read-only)",
  "scientific-visualization": "Synced from claude-scientific-skills (pinned, read-only)",
  // The entries below are declared kg directories that hold their skills
  // DIRECTLY rather than in package subdirectories, so they are keyed by the
  // directory's DECLARED ID — `bootstrap`, not `bootstrap/skills`.
  //
  // #428 keyed them by repo-relative path, which works and has a short
  // half-life: the declaration says on its own entry that "ids are stable
  // across a relocation, paths are not", and this file had already paid for
  // that twice in one day — the basename was `bootstrap` only until #422 moved
  // those skills to `bootstrap/skills/`.
  //
  // `cat-harness-src` was a third such entry, for `src/skills/`, and is gone
  // as of #760. That directory held ONE skill beside the `.ts` implementing
  // it — a thing `skills/folio-core/` already does eight times over — and its
  // only distinguishing property was that `discoverLocalPackages` named it
  // `cat-harness` while the declaration gave that id to `skills/`: one name,
  // two real directories. `corpus-grep` now sits in `folio-core` with its
  // siblings and needs no category of its own.
  // THERE IS NO `bootstrap` HEADING, AND THERE MUST NOT BE — the owner ruled
  // it out. `pve3`, 2026-09-21: the root declares BOTH halves of bootstrap or
  // NEITHER, and the answer was neither. Carrying its skills without its
  // process minted three dangling `bindsLane` links and the `v3se` collision;
  // carrying both would undo #432's isolation and put a process this layer
  // does not own into its published graph. So bootstrap's skills publish
  // through `bootstrap.jsonld` alone, and their absence from this site is the
  // DECISION, not a gap.
  //
  // A heading survived that ruling, keyed `bootstrap`, reaching nothing. On
  // 2026-09-27 I read it as evidence that bootstrap publishes, declared
  // `bootstrap/skills/` here to make the seven pages appear, and three tests
  // caught it: `tools.test.ts`'s deliberately INVERTED
  // `expect(s.has("confirm-harness")).toBe(false)`, and `kg-export.test.ts`'s
  // `a Tool satisfying a sibling's skill links into the SIBLING's document` —
  // the `discuss` Tool's `satisfies` stopped pointing into bootstrap's document the moment this
  // layer claimed the skill. Removing the key rather than rekeying it is
  // the fix, because the key WAS the lure: `discoverGroups` throws on an id
  // with no heading and never on a heading with no id, so a stale one is
  // unfalsifiable from this file and reads as an unfinished job.
  // CatBootstrap's SECOND declared directory, and the one that constitutes its
  // exemption rather than describing it: the layer is excused a visualiser and
  // owes its own `.jsonld`/`.json` instead, so the skills governing that
  // emission ARE the substitute. Its own heading, because a reader meeting
  // "how bootstrap emits its graph" under "read before anything else is
  // known" would reasonably conclude they have to read it first. Bean `hfkl`.
  // Two top-level named subgraphs, staged ahead of the split (#223) and both
  // keyed by DECLARED ID for the reason the comment above gives: their paths
  // will change at the `cat-harness/` move and their ids will not.
  //
  // `kg-navigation` shares its name with `bootstrap/skills/kg-navigation.md`
  // and the two are DIFFERENT DOCUMENTS — the tooled route and the zero-install
  // floor. Measured 2026-09-20, before this entry existed: the published page
  // carried bootstrap's body under the tooled one's name, so a reader landing
  // there got the wrong skill with nothing saying so. That is the same
  // collision `todo-manager` and `bean-coordination` are listed for below, and
  // it is resolved the same way.
  "kg-navigation": "Knowledge-graph navigation (tooled)",
  // The content core’s own `skills/`, keyed by DECLARED ID for the same
  // reason as the two below it: the directory moves when core splits out and
  // the id does not. A LABEL is data, not a dependency — nothing here imports
  // core, so naming its package does not invert the layer order that
  // the content core's declared `needs: ["cat-harness"]` fixes.
  //
  // THE OWNER'S ids since placement PR0 (bean `ejye`): the platform's mirrors
  // (`folio-assistant-core-skills`, `folio-assistant-sci-lean-skills`, …) are
  // gone, and the corpus is read from each owner's own declaration — where
  // cmsl measured five of the mirror ids had already drifted.
  "core-skills": "Content layer ({instance})",
  // The science layer's Lean tooling (folio-assistant#1492): tooling lives in
  // the formal-math (sci) layer, never in core. Declared from within sci's `skills/`.
  "lean-skills": "Science layer: Lean tooling ({instance})",
  "data-skills": "Science layer: reference data ({instance})",
  // `large-datasets` is a package of the harness's `library` group since bean
  // `j7ql` (2026-10-01), keyed by basename like the packages above; it was
  // the `large-datasets-skills` root of its own layer before.
  "large-datasets": "Large data sets (subsetting, materializing, publishing)",
  "who-iris-skills": "WHO IRIS (catalogue instance)",
  // The FHIR IG harness instance's two packages, keyed by BASENAME because they
  // are package subdirectories of a declared root (`fhir-ig-skills`), not roots
  // holding skills directly. Two headings rather than one "FHIR IG" because the
  // packages answer different questions — how an IG is BUILT versus how a
  // client TALKS to a server — and a reader meeting `smart-launch` under "IG
  // build pipeline" would reasonably conclude it is a build step.
  "fhir-ig-base": "FHIR IG build ({instance-path})",
  "fhir-client": "FHIR client & SMART launch ({instance-path})",
};

/**
 * A heading with the declaring layer filled in.
 *
 * A heading for a package another layer owns names that layer, and the
 * name is READ from the declaration found above the directory rather than
 * written into this table: this layer sits below the layers whose skills
 * it publishes, and must not spell their names. `{instance}` is the declared
 * `name`; `{instance-path}` is that name followed by the directory's path
 * inside the layer (`<name>/skills/<package>`). A heading with neither
 * placeholder is returned as written.
 */
export function headingFor(template: string, dir: string): string {
  if (!template.includes("{instance")) return template;
  let root = resolve(dir);
  while (findDeclarationFile(root) === undefined) {
    const up = dirname(root);
    if (up === root) throw new Error(`gen-skill-docs: no instance declaration above ${dir}, for heading "${template}"`);
    root = up;
  }
  const name = readDeclaration(root)?.name ?? basename(root);
  const inside = relative(root, resolve(dir)).split(sep).join("/");
  return template
    .replaceAll("{instance-path}", inside === "" ? name : `${name}/${inside}`)
    .replaceAll("{instance}", name);
}

/**
 * Every skill package under `skills/`, found on disk.
 *
 * ## The defect this replaces
 *
 * `GROUPS` listed four `skills/` packages. **Six hold `.md`.** Measured
 * 2026-09-19: `authoring-math` (3 skills) and
 * `authoring-who-smart-guidelines` (9) were absent, so all twelve of their
 * instruction bodies were NEVER PUBLISHED — and four of them
 * (`fhir-validation`, `l2-dak-authoring`, `bpmn-authoring`,
 * `latex-authoring`) are named by `<bootstrap.processes:skill ref>` in the BPMN diagrams.
 * An agent following `workflow_next` to one of those steps is handed a skill
 * whose published reference page 404s.
 *
 * The comment on the `.claude/skills/local` entry below records the SAME bug
 * being fixed for one directory earlier the same day. Fixing one member of a
 * family and leaving two is what a hardcoded list guarantees, so the list is
 * gone.
 *
 * ## Forgetting is loud, not silent
 *
 * A discovered package with no {@link SKILLS_CATEGORIES} label **throws**,
 * naming the directory. That is deliberate: the alternative — deriving a label
 * from the directory name — would publish the package under a plausible
 * heading nobody chose, and the whole failure being fixed here is content
 * going missing without anything saying so. Adding a package is one line;
 * forgetting it stops the build.
 */
/** Does this directory hold at least one skill `.md` directly? */
function holdsSkill(dir: string): boolean {
  try {
    return readdirSync(dir).some((f) => f.endsWith(".md") && isSkillMd(join(dir, f)));
  } catch {
    return false;
  }
}

function discoverGroups(): Group[] {
  const out: Group[] = [];
  const undeclared: string[] = [];
  // Every DECLARED knowledge-graph directory, not `skills/` alone: a layer
  // may put its graph anywhere, and this repository declares three —
  // `skills/`, `bootstrap/skills/` and `src/skills/` (beans `x3bd`, `osbo`).
  //
  // A directory may hold skills DIRECTLY as well as in packages: `src/skills/`
  // holds `corpus-grep.md` beside the `.ts` implementing it, and
  // `bootstrap/skills/` holds both of bootstrap's.
  //
  // THE TWO CASES ARE KEYED DIFFERENTLY, and that is the point. A package
  // NAMES ITSELF, so its basename is the key. A root does not — its basename
  // is an artefact of where the declaration happens to point — so the key is
  // its DECLARED ID. This file keyed a root by basename until #422 moved
  // bootstrap's skills one level down and the generator demanded a heading for
  // a package called "skills"; #428 then keyed by repo-relative path, which
  // has the same shape of failure one move later.
  const decls = kgDirectories(INSTANCE_ROOT, corpusScopeFor(INSTANCE_ROOT));
  // A subdirectory DECLARED in its own right (sci's `skills/lean/`, declared
  // from within `skills/skills.json`) is a root, keyed by its id — never also
  // a package of its parent, or it would be published twice under two keys.
  const declaredRoots = new Set(decls.map((d) => resolve(d.absPath)));
  for (const decl of decls) {
    const skillsRoot = decl.absPath;
    if (holdsSkill(skillsRoot)) {
      const direct = SKILLS_CATEGORIES[decl.id];
      if (direct === undefined) undeclared.push(decl.id);
      else out.push({ category: headingFor(direct, skillsRoot), dir: skillsRoot, repoPrefix: repoRelative(skillsRoot) });
    }
    for (const d of packageDirsIn(skillsRoot)) {
      const dir = d.dir;
      if (declaredRoots.has(resolve(dir))) continue;
      // No SKILL `.md` means it is not a skill package: `workflows/`,
      // `roles/`, `permissions/`, `requirements/`, `framework/`,
      // `remote-packages/` and `memory/` are other node kinds.
      //
      // Literally the same test as `scripts/known-skills.ts`, by calling it.
      // This comment used to CLAIM that while carrying its own copy, and the
      // copy was falsified by `skills/memory/` — 25 agent-memory nodes, every
      // one a `.md`, none a skill. The generator then demanded a category
      // heading for a package that publishes nothing.
      if (!holdsSkill(dir)) continue;
      const category = SKILLS_CATEGORIES[d.name];
      if (category === undefined) {
        undeclared.push(d.name);
        continue;
      }
      out.push({ category: headingFor(category, dir), dir, repoPrefix: repoRelative(dir) });
    }
  }
  if (undeclared.length > 0) {
    throw new Error(
      `skill package(s) with no category in SKILLS_CATEGORIES: ${undeclared.join(", ")}.
` +
        `Add a heading for each in scripts/gen-skill-docs.ts. A package is not published ` +
        `under a guessed heading — that is how twelve skills went unpublished unnoticed.`,
    );
  }
  return out;
}

/**
 * Repository-relative directory of the group that publishes `name` as
 * `published`, or `undefined` when no group does or it is outside the checkout.
 */
function publishedSourceDir(name: string, published: string): string | undefined {
  return GROUPS.find(
    (g) => `${g.publishPrefix ?? ""}${name}` === published && existsSync(join(g.dir, `${name}.md`)),
  )?.repoPrefix;
}

const GROUPS: Group[] = [
  ...discoverGroups(),
  // Local skills — the harness-specific ones under `.claude/skills/local/`.
  //
  // Absent from this list until 2026-09-19, which meant the authoritative spec
  // for the ten `trap-*` criteria was neither published nor guarded by
  // `--check`, while the copy of `todo-manager.md` beside it carried the MOST
  // inbound references of the three and had no guard at all (`AGENTS.md`, bean
  // `rmer`). Only `.md` files are read, so the 23 `.json` capability and skill
  // descriptors in that directory are not mistaken for instruction bodies.
  //
  // `todo-manager.md` and `bean-coordination.md` here are now STUBS pointing at
  // `skills/folio-core/` (bean `tdmg`): those were never servable by
  // `skill_fetch` and had drifted from the copies that were. `language-trap-
  // agent-audit.md` is the real content this group exists to publish.
  {
    category: "Local skills (.claude/skills/local)",
    dir: join(REPO_ROOT, ".claude", "skills", "local"),
    repoPrefix: repoRelative(join(REPO_ROOT, ".claude", "skills", "local")),
    publishPrefix: "local-",
  },
];

/** {@link SAME_BASENAME_DIFFERENT_DOCUMENT}, less the entries this checkout cannot publish both halves of. */
const TWINS = twinsInCheckout(SAME_BASENAME_DIFFERENT_DOCUMENT, GROUPS, existsSync);

/**
 * Inline a split skill's parts into its published page.
 *
 * A long skill may be an entry point plus siblings under `<name>/`, read on
 * demand — the pattern `AGENTS.md` prescribes for `MEMORY.md`, and what
 * `kg-audit`'s `skill-not-a-document` pushes a 1281-line skill towards. That
 * split exists to bound what an AGENT loads at invocation time. It is not a
 * reason to fragment the human-facing reference, where a reader browsing one
 * skill wants the whole of it.
 *
 * So the parts are appended here rather than published as pages of their own.
 * Publishing them separately would also collide: this output directory is
 * flat, and `integration-watcher/idle-backlog.md` shares a basename with the
 * real `idle-backlog` skill.
 *
 * Found by measurement, not design: splitting five skills silently dropped
 * ~2,500 lines from the published site, and left every entry point linking to
 * a path that 404s there. The link rewrite below is the other half — a
 * relative `](name/part.md)` becomes an in-page anchor.
 */
function withParts(
  dir: string,
  name: string,
  body: string,
  flat: ReadonlyMap<string, string>,
  processPages: ReadonlyMap<string, string>,
): string {
  const partsDir = join(dir, name);
  if (!existsSync(partsDir)) return body;
  const parts = readdirSync(partsDir)
    .filter((f) => f.endsWith(".md") && isSkillMd(join(partsDir, f))).sort();
  if (parts.length === 0) return body;

  // `](integration-watcher/lifecycle.md)` -> `](#part-lifecycle)`
  let out = body.replace(
    new RegExp(`\\]\\(${name}/([\\w.-]+)\\.md\\)`, "g"),
    (_m, part: string) => `](#part-${part})`,
  );
  for (const part of parts) {
    const stem = basename(part, ".md");
    const text = stripFrontMatter(readFileSync(join(partsDir, part), "utf-8")).replace(/^\n+/, "");
    // A part is authored one directory deeper than its skill, so its links
    // are rebased against `partsDir`, not against the skill's own directory.
    out += `\n\n---\n\n<a id="part-${stem}"></a>\n\n${rebaseLinks(partsDir, text, flat, processPages)}`;
  }
  return out;
}

/**
 * A skill body's relative links, re-expressed for the FLAT output directory.
 *
 * Skills are authored in PACKAGES — `skills/process/workflow/process-state.md` links
 * to a sibling package as `](../folio-core/task-authorization.md)` — and this
 * generator publishes every one of them into a single flat directory. The
 * link is correct where it is written and wrong once the page moves, so a
 * body copied through verbatim arrives on the site addressing a directory
 * layout the site does not have.
 *
 * Measured 2026-09-25 while closing bean `mi97`: **110** such links across the
 * generated pages, every one a 404 for a reader. They were invisible for the
 * same reason the `mi97` links were — `docs/` was undeclared until 2026-09-20,
 * so no consumer walked them (the `dh4f` shape).
 *
 * RESOLVED against disk and looked up in the published set, never composed —
 * the rule `repoRelative` keeps for the same reason (bean `oe98`). A target
 * this cannot place is **left alone**, so it stays a finding in
 * `check:subgraphs` rather than being quietly rewritten into a path that
 * merely exists. Rewriting to something plausible is how a broken link
 * becomes an undetectable one.
 */
/**
 * Absolute source path → the flat page name it publishes under.
 *
 * Built from {@link GROUPS} by exactly the rule the writer below uses, so the
 * two cannot disagree: the same `isSkillMd` predicate, the same
 * `publishPrefix`, the same first-group-wins on a duplicate. Where two groups
 * hold one basename the index calls them "(same page)" — so BOTH source paths
 * map to that one page, and a link to either lands where the reader expects.
 */
function flatPublishedNames(): Map<string, string> {
  const flat = new Map<string, string>();
  for (const group of GROUPS) {
    if (!existsSync(group.dir)) continue;
    for (const file of readdirSync(group.dir)) {
      if (!file.endsWith(".md") || !isSkillMd(join(group.dir, file))) continue;
      flat.set(join(group.dir, file), `${group.publishPrefix ?? ""}${basename(file, ".md")}`);
    }
  }
  return flat;
}

/** The layer's site root — what `../../` means from a published skill page. */
const SITE_ROOT = join(INSTANCE_ROOT, siteDirFor(INSTANCE_ROOT));

/**
 * Absolute diagram path → the stem its published page uses.
 *
 * Keyed on the ABSOLUTE PATH rather than the basename, because
 * {@link ProcessRow.file} is documented as the identity for precisely this
 * reason: basenames collide across layers, and two diagrams sharing one
 * would otherwise make a link land on whichever page was built last.
 */
function processPageStems(rows: readonly ProcessRow[]): Map<string, string> {
  const byPath = new Map<string, string>();
  for (const r of rows) byPath.set(join(REPO_ROOT, r.file), r.stem);
  return byPath;
}

/**
 * Where a link target publishes, or `undefined` if this cannot say.
 *
 * FOUR answers, in order, because a target can satisfy more than one and the
 * most specific is the right one. Every branch RESOLVES against disk and looks
 * the result up; none composes a path and hopes.
 *
 * `undefined` is a real answer and the most important one. It means the caller
 * leaves the link exactly as written, so it stays a finding in
 * `check:subgraphs` instead of becoming a plausible path that 404s. Bean
 * `hloc`: "rewriting to something plausible is how a broken link becomes an
 * undetectable one."
 *
 * Two of the four rules are NOT new here. `../../processes/<stem>.html` is
 * what {@link processRows} already composes for a skill's own process, and the
 * blob URL is what the source/edit banner already composes through
 * {@link repoRelative} (bean `oe98`). Restating either would be a second
 * answer free to disagree with the first.
 */
function publishedLocation(
  baseDir: string,
  target: string,
  flat: ReadonlyMap<string, string>,
  processPages: ReadonlyMap<string, string>,
): string | undefined {
  const abs = resolve(baseDir, target);

  // Outside this checkout — a dependency resolved from a sibling clone has no
  // path in THIS repository, so it gets no link rather than a normalised one
  // that 404s. `repoRelative` already draws that line; do not redraw it.
  const rel = repoRelative(abs);
  if (rel === undefined) return undefined;

  // Broken at the SOURCE. Rewriting it would move a detectable defect into the
  // generated tree and hide it; the source is where it wants fixing.
  if (!existsSync(abs)) return undefined;

  // 1. Another published skill — the flat page name, the `mi97` rule.
  const skill = flat.get(abs);
  if (skill !== undefined) return `${skill}.md`;

  // 2. A process or decision diagram that publishes a page of its own. The
  //    page is what a reader can read; the XML is not.
  //
  //    ASKED OF `processRows`, not of the filesystem. The first draft joined
  //    a literal `"processes"` onto the site root, which `check:declared-paths`
  //    refused — "a DIRECTORY the declaration already answers" — and it was
  //    right twice over: the directory is declared, and a stem test would key
  //    on a BASENAME, which `ProcessRow.file` documents as exactly the wrong
  //    identity ("basenames collide across instances"). Matching the absolute
  //    path fixes both.
  const stem = processPages.get(abs);
  if (stem !== undefined) return `../../${PROCESSES_ROUTE}/${stem}.html`;

  // 3. A page already inside the site tree — address it site-relatively.
  //    `.md` only: an asset under the site tree is served at its own path.
  const fromSite = relative(SITE_ROOT, abs).split(sep).join("/");
  if (!fromSite.startsWith("../")) {
    // A page's PUBLISHED path is Jekyll's answer, not its source path: the
    // docs-folder pages publish under `docs/<instance>/` (bean `kc7k`).
    return fromSite.endsWith(".md")
      ? `../../${publishedPagePath(SITE_ROOT, fromSite)}`
      : `../../${fromSite}`;
  }

  // 4. A repository file that publishes no page — `.ts`, `.py`, `.sh`,
  //    `.json`, and the markdown under `methodologies/` and `docs/source/`
  //    that this checked for rather than assumed: `docs/methodologies/` holds
  //    only `index.md`, so those nine sources publish NOWHERE, and the bean's
  //    instruction to give them a site-relative path would have composed nine
  //    links to pages that do not exist.
  // `tree` for a directory, `blob` for a file. GitHub serves a directory under
  // `blob/` as a 404, so getting this wrong would trade one broken link for
  // another — and the directory case only started arriving here when the
  // matcher below learned to see it.
  const kind = statSync(abs).isDirectory() ? "tree" : "blob";
  return `https://github.com/litlfred/folio-assistant/${kind}/main/${rel}`;
}

function rebaseLinks(
  baseDir: string,
  text: string,
  flat: ReadonlyMap<string, string>,
  processPages: ReadonlyMap<string, string>,
): string {
  return text.replace(
    /\]\((\.{0,2}[^)\s:]*?(?:\.[A-Za-z0-9]+|\/))(#[^)\s]*)?\)/g,
    (whole, target: string, anchor?: string) => {
      if (isAbsolute(target) || target.startsWith("#")) return whole;
      const published = publishedLocation(baseDir, target, flat, processPages);
      return published === undefined ? whole : `](${published}${anchor ?? ""})`;
    },
  );
}

/** Strip a leading YAML front-matter block (`---\n…\n---`) if present. */
function stripFrontMatter(text: string): string {
  if (text.startsWith("---")) {
    const end = text.indexOf("\n---", 3);
    if (end !== -1) {
      const after = text.indexOf("\n", end + 1);
      return after !== -1 ? text.slice(after + 1) : "";
    }
  }
  return text;
}

/** Derive a concise nav title from the first H1, else the filename. */
function deriveTitle(body: string, name: string): string {
  const m = body.match(/^#\s+(.+)$/m);
  let title = m ? m[1].trim() : name;
  // Trim "<thing> — long descriptor" down to the lead, and a trailing " Skill".
  title = title.split(" — ")[0].replace(/\s+Skill$/i, "").trim();
  return title || name;
}

function escapePipes(s: string): string {
  return s.replace(/[\\|]/g, "\\$&");
}

/**
 * The processes that run a skill, appended to its page (bean `ooq3`).
 *
 * The reverse of `<bootstrap.processes:skill ref>`, which `processes/index.md` tabulates and
 * which a reader standing on the skill could not see. When a process shares the
 * skill's name it is the skill's OWN procedure, so its diagram is embedded
 * here rather than only linked — that is the case `adjudication` was in: a
 * skill, a process, and no page showing the second from the first.
 */
function processesSection(name: string, rows: readonly ProcessRow[]): string[] {
  const own = rows.find((r) => r.stem === name && r.loadError === undefined);
  const runners = rows
    .filter((r) => r.loadError === undefined)
    .map((r) => ({ r, steps: r.steps.filter((st) => st.skills.includes(name)) }))
    .filter((x) => x.steps.length > 0);
  if (!own && runners.length === 0) return [];
  const out: string[] = ["", "## Processes that run this skill", ""];
  if (own) {
    out.push(`This skill has its own process: **[${own.name}](../../${PROCESSES_ROUTE}/${own.stem}.html)**.`);
    out.push("");
    if (own.svg) {
      out.push(`<img src="../../assets/img/workflows/${own.stem}.svg" alt="BPMN diagram: ${own.name.replace(/"/g, "&quot;")}" style="max-width:100%">`);
      out.push("");
    }
  }
  if (runners.length) {
    out.push("| process | step(s) that name it |");
    out.push("|---|---|");
    for (const { r, steps } of runners) {
      const names = steps.map((st) => (st.calledElement ? `${st.name} (calls a sub-process)` : st.name));
      out.push(`| [${escapePipes(r.name)}](../../${PROCESSES_ROUTE}/${r.stem}.html) | ${escapePipes(names.join("; "))} |`);
    }
    out.push("");
  }
  return out;
}

async function main(): Promise<void> {
  if (!CHECK_ONLY) mkdirSync(TARGETS().dir, { recursive: true });
  const procRows = await processRows();
  /** Every layer of the checkout, for finding a skill's contracts wherever its layer keeps them. */
  const contractRoots = instanceRoots(REPO_ROOT);
  const contractHref = forgeHrefFor(REPO_ROOT);

  const indexRows: Record<string, string[]> = {};
  // One page per skill id in a flat output dir; if a skill appears in more than
  // one source group (e.g. an agent skill that also has a folio-core copy), the
  // first group wins and later duplicates are listed as a cross-reference.
  const written = new Map<string, string>(); // skill name → category that emitted it
  const provenancePages = new Map<string, string[]>();

  // WHERE EVERY SKILL LANDS, computed before a single body is written.
  //
  // `rebaseLinks` needs to answer "does this path publish, and under what
  // name" for a target in ANOTHER package, which the group loop below has not
  // reached yet. A one-pass generator can only answer it for groups already
  // seen, and a link would then be rebased or not depending on alphabetical
  // order — the worst kind of defect, because half the corpus looks correct.
  const flat = flatPublishedNames();
  // Same one-pass hazard as `flat` above: computed before any body is written,
  // so a link never rebases or not depending on which group was reached first.
  const processPages = processPageStems(procRows);

  for (const group of GROUPS) {
    indexRows[group.category] = [];
    if (!existsSync(group.dir)) continue;
    // `isSkillMd`, not a bare `.md` test — the FOURTH place in this repository
    // that predicate was spelled out by hand, and the second in this file.
    // Without it `bootstrap/README.md` was published as a skill instruction
    // page titled "bootstrap", complete with an "edit this page's source"
    // link, for a file that is not a skill.
    const files = readdirSync(group.dir)
      .filter((f) => f.endsWith(".md") && isSkillMd(join(group.dir, f)))
      .sort();

    for (const file of files) {
      const name = basename(file, ".md");
      const published = `${group.publishPrefix ?? ""}${name}`;
      // Keyed on the PUBLISHED name, not the source basename. Two groups may
      // legitimately hold different documents under one basename, and keying on
      // the basename made the generator drop the second one while the index
      // claimed it was "(same page)". A false claim about two documents is
      // worse than either publishing or omitting one, because a reader stops
      // looking. (The `todo-manager` pair that motivated this is now a skill
      // plus a stub — bean `tdmg` — but the key must stay published-name-based:
      // the stubs still publish, and `language-trap-agent-audit.md` shows the
      // local group holds real content of its own.)
      if (written.has(published)) {
        indexRows[group.category].push(
          `| [${name}](${published}.html) | \`${name}\` | — | _also in ${written.get(published)} (same page)_ |`,
        );
        console.log(`  ↪ ${published} (dup — kept ${written.get(published)})`);
        collisions.push({
          published,
          kept: written.get(published) ?? "(unknown)",
          from: group.category,
        });
        continue;
      }
      // Where another group holds the same basename, say so on both pages: a
      // reader who lands on one has no way to know the other exists.
      //
      // **The text is now directional, and that is the `tdmg` correction.** It
      // used to read "Two different skills share this name … They are not
      // copies … Which is canonical is an open question … Read both before
      // relying on either." Every clause of that is now false — the local
      // copies are stubs, `skill_fetch` only ever served `skills/folio-core`,
      // and reading both is the opposite of the advice. A generator that
      // publishes a stale claim about which document governs is worse than one
      // that publishes no banner, because a reader acts on it.
      const twin = TWINS.table[name];
      const raw = readFileSync(join(group.dir, file), "utf-8");
      // The body first, based at the skill's own package; then the parts, each
      // based one level deeper. Two different bases, so two calls.
      let body = rebaseLinks(group.dir, stripFrontMatter(raw).replace(/^\n+/, ""), flat, processPages);
      body = withParts(group.dir, name, body, flat, processPages);
      if (twin) {
        const other = twin.find((t) => t.published !== published);
        const self = twin.find((t) => t.published === published);
        // The twin's location is LOOKED UP from the group that publishes it,
        // not written into the table: the table carried `skills/folio-core`,
        // the pre-split path, three times (bean `oe98`).
        const otherAt = other ? publishedSourceDir(name, other.published) : undefined;
        const at = otherAt === undefined ? "" : `lives at \`${otherAt}\` and `;
        const from = otherAt === undefined ? "" : `, from \`${otherAt}\``;
        if (other) {
          body =
            (self?.canonical === true
              ? `> **This is the skill \`skill_fetch\` serves.** A stub of the same name\n` +
                `> ${at}is published as\n` +
                `> [${other.label}](${other.published}.html); it only points here.\n` +
                `> Edit this page's source, never the stub.\n\n`
              : `> **This is a stub, not the skill.** The skill is\n` +
                `> [${other.label}](${other.published}.html)${from},\n` +
                `> which is what \`skill_fetch\` serves. Read that one; this page exists\n` +
                `> only so an old link still lands somewhere truthful.\n\n`) +
            body;
        }
      }
      const title = deriveTitle(body, name);

      const hasSchema = existsSync(join(SCHEMA_DIR, `${name}.md`));
      const sourcePath = group.repoPrefix === undefined ? undefined : `${group.repoPrefix}/${file}`;
      const sourceUrl = `https://github.com/litlfred/folio-assistant/blob/main/${sourcePath}`;
      // `/edit/`, not `/blob/`. The banner has always carried the CORRECT
      // source path -- the thing it lacked was a way to act on it. GitHub's
      // in-browser editor lives at /edit/<branch>/<path>; /blob/ is read-only,
      // so a reader who spotted a typo had to navigate to the file, find the
      // pencil, and then edit. This is the same target, one click instead of
      // three.
      // The link itself is built by markdownEditLink below (bean v433).

      const page: string[] = [];
      page.push("---");
      page.push("layout: default");
      // The page SAYS it is generated, so a consumer need not infer it from a
      // path. `check:reference-direction` reads exactly this: a name in
      // machine output is not an authored reference, and the fix for one is
      // in the SOURCE skill, not here (145 occurrences across 31 of these
      // pages were reporting as authored prose until 2026-09-24).
      page.push("generated: scripts/gen-skill-docs.ts — do not hand-edit; edit the skill");
      // QUOTED, always. A skill's title is its H1, which is prose — so it
      // carries colons ("Contrast: measured over the darkest thing that could
      // be there") and backticks, and YAML rejects both unquoted. The page
      // then has front matter Jekyll cannot parse, which `translation:index`
      // reports as *"it could not be translated as things stand"* and nothing
      // else notices, because the page still renders.
      //
      // Measured 2026-09-20: SIX generated pages were in that state, four of
      // them predating the skill that made the seventh. Quoting here fixes the
      // class rather than renaming headings one at a time.
      //
      // Single quotes, with YAML's own escape (a doubled quote), because a
      // title may contain a backtick and a double-quoted scalar would then
      // need backslash rules a heading has no reason to obey.
      //
      // Backtick MARKERS are stripped (bean `mylx`): the theme prints `title`
      // as plain text in the sidebar on every page, so a heading's
      // `MathlibExt` showed its backticks about 1,000 times across the site.
      // The page body keeps the heading as written.
      page.push(`title: '${stripInlineCode(title).replace(/'/g, "''")}'`);
      page.push("parent: Skill instructions");
      page.push("---");
      page.push("");
      page.push("{: .note }");
      const schemaNote = hasSchema ? ` Typed contract: [schema reference](../skills/${name}.html).` : "";
      if (sourcePath === undefined) {
        // Bean `oe98`: a source outside this checkout has no repository path,
        // so it is SAID rather than linked — a normalised URL would 404.
        page.push(
          `> Generated from \`${file}\` in a dependency outside this repository — do not edit here.` +
            schemaNote,
        );
      } else {
        page.push(`> Generated from [\`${sourcePath}\`](${sourceUrl}) — do not edit here.` + schemaNote);
      }
      page.push(">");
      // The edit affordance is a SEPARATE line inside the callout rather than
      // more prose on the end of it. "do not edit here" and "edit it there"
      // are opposite instructions, and running them into one sentence is how
      // a reader ends up editing the generated copy anyway.
      if (sourcePath !== undefined) {
        page.push(`> ${markdownEditLink({ repo: SKILL_DOCS_REPO }, { source: sourcePath, text: `${EDIT_GLYPH} Edit this page's source`, className: "fa-edit-source" })}`);
      } else {
        page.push("> The source is not in this repository, so there is no edit link.");
      }
      page.push("");
      // Wrap the body in a Liquid raw block so prose containing `{{ }}` / `{% %}`
      // (math, code, templates) is emitted verbatim, not parsed by Jekyll —
      // including a skill that writes the closing raw tag itself (bean kjbb).
      page.push(...wrapRaw(body.trimEnd()));
      // The skill's I/O contracts as a class diagram (bean `cat-tools-4xq6`).
      page.push(...skillContractSectionMd(name, contractRoots, REPO_ROOT, contractHref));
      page.push(...processesSection(name, procRows));
      page.push("");
      emit(join(OUT_DIR, `${published}.md`), page.join("\n"));
      written.set(published, group.category);
      // The page's source, for its provenance footer (`provenance-footer.ts`).
      // The key is the page's path in the site, as `page.path` gives it.
      provenancePages.set(`reference/skill-instructions/${published}`, [join(group.dir, file)]);

      const desc = escapePipes(indexSummary(body.match(/^#\s+.+\n+([^\n#].*)$/m)?.[1] ?? ""));
      const schemaCell = hasSchema ? `[schema](../skills/${name}.html)` : "—";
      indexRows[group.category].push(`| [${title}](${published}.html) | \`${name}\` | ${schemaCell} | ${desc} |`);
      console.log(`  ✓ ${published}.md (${group.category})`);
    }
  }

  // Index page
  const idx: string[] = [];
  idx.push("---");
  idx.push("layout: default");
  idx.push("generated: scripts/gen-skill-docs.ts — do not hand-edit; edit the skill");
  idx.push("title: Skill instructions");
  idx.push("nav_order: 6");
  idx.push("has_children: true");
  idx.push("---");
  idx.push("");
  idx.push("# Skill instructions");
  idx.push("");
  idx.push("The prose **instruction bodies** the LLM loads (via `skill_fetch`) when it");
  idx.push("runs a skill. These are generated from the skill source markdowns, so the");
  idx.push("published reference always matches what the agent actually reads.");
  idx.push("");
  idx.push("For each skill's *typed input/output contract*, see the");
  idx.push("[Skill schema reference](../skills/); for the conceptual overview of skills,");
  idx.push(`roles, and how they compose with the LLM, see [Skills & roles](../../${publishedPagePath(SITE_ROOT, "concepts/skills")}).`);
  idx.push("");
  for (const group of GROUPS) {
    const rows = indexRows[group.category];
    idx.push(`## ${group.category}`);
    idx.push("");
    if (rows.length === 0) {
      idx.push("_None yet._");
      idx.push("");
      continue;
    }
    idx.push("| Skill | Id | Schema | Summary |");
    idx.push("|-------|----|--------|---------|");
    idx.push(...rows);
    idx.push("");
  }
  idx.push("> The `authoring-math` and `authoring-who-smart-guidelines` packages ship");
  idx.push("> skill *definitions* + typed schemas today; their prose instruction bodies");
  idx.push("> will appear here as they are authored.");
  idx.push("");
  emit(join(OUT_DIR, "index.md"), idx.join("\n"));
  const total = Object.values(indexRows).reduce((n, r) => n + r.length, 0);
  console.log(`  ✓ index.md (${total} instruction bodies)`);
  // THE PROVENANCE FOOTER (owner, 2026-11-05, "2B"): one site-data slice for
  // these pages, read by `footer_custom.html` like every other slice.
  {
    const result = writeProvenanceListing({
      siteDir: join(INSTANCE_ROOT, siteDirFor(INSTANCE_ROOT)),
      producer: "skill-instructions",
      pages: provenancePages,
      check: CHECK_ONLY,
      emit,
    });
    // Generated and gitignored, like the pages themselves, so a stale
    // fragment is drift, not an error of its own.
    for (const f of result.stale) drifted.push(`_includes/generated/provenance/skill-instructions/${f}`);
    console.log(`  ✓ provenance footers (${result.pages} page(s), ${result.entries} entries)`);
  }
  // BEFORE the drift report: a dropped document is not staleness, and a run
  // that exits 0 on "up to date" would bury it.
  reportCollisions();
  // BEFORE `reportDrift`, which `process.exit(0)`s on a clean tree — anything
  // after it is unreachable in exactly the run that matters, `--check` on a
  // tree whose only defect is an orphan.
  reportOrphans(written.keys());
  reportUnpublishedTwins(written.keys());
  reportDrift();
  console.log(`\nWrote skill instruction docs to ${TARGETS().dir}`);
}

if (import.meta.main) await main();
