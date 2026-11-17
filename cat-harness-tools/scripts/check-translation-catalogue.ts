#!/usr/bin/env bun
/**
 * A change may not PUBLISH a translated page without its `.po` catalogue.
 *
 * | gate | unit | question |
 * |---|---|---|
 * | `translation:drift:check` | the corpus | is every published translation catalogued and structurally current? |
 * | this | the CHANGE | does what you are about to merge publish a translation with no catalogue? |
 *
 * The drift gate may be held red by decision, and a red step cannot report
 * growth in its own subject. Keying on the diff needs no baseline and keeps
 * working while the corpus backlog stands.
 *
 * The file -> (locale, page) mapping is `fileForUrl` from `translation-drift.ts`
 * applied over `buildTranslationIndex`, and the catalogue path is that module's
 * own `catalogueFor`, so this gate and the drift gate cannot disagree.
 *
 * ## Exit codes
 *
 *     0  no added file publishes an uncatalogued translation — INCLUDING the
 *        determined empty, where the change touches no translated page at all
 *     1  at least one does
 *     2  could not determine: git would not answer, there is no site root, or
 *        the translation index is empty
 *
 * ```sh
 * bun run cat translation:catalogue:check                 # against origin/main
 * bun run cat translation:catalogue:check -- --staged     # pre-commit
 * bun run cat translation:catalogue:check -- --since HEAD~5
 * bun run cat translation:catalogue:check -- --base <sha>  # two dots; no merge base needed
 * CATALOGUE_BASE_SHA=<sha> bun run cat translation:catalogue:check   # how CI passes it
 * bun run cat translation:catalogue:check -- --warn       # report, exit 0
 * ```
 *
 * There is no `--check` flag and no `artefact-verification` entry: this gate
 * generates and writes nothing; its subject is a range of history.
 *
 * @covers translation-sources
 * @graphNode tool
 */
import { HARNESS_ROOT } from "./lib/roots.ts";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";

import { buildTranslationIndex, siteRoot } from "../pipeline/translation-index.ts";
import { catalogueFor, fileForUrl } from "../pipeline/translation-drift.ts";

/**
 * This layer's root — `cat-harness/`, one level up from `scripts/`.
 *
 * Computed the same way `pot-for-pages.ts` computes it rather than imported,
 * because no module exports it: every consumer derives it from its own location,
 * and a literal here is what `check:declared-paths` exists to refuse.
 */
const INSTANCE_ROOT = HARNESS_ROOT;

/** A published translation an added file would introduce with no catalogue. */
export type Uncatalogued = {
  /** `<locale>/<page>`, the same subject spelling the drift gate prints. */
  subject: string;
  /** The added file that publishes it, repository-relative. */
  file: string;
  /** Where its catalogue would have to be, repository-relative. */
  catalogue: string;
};

/**
 * Every published translation, keyed by the file that serves it.
 *
 * Absolute paths, because the git output is repository-relative and the index's
 * paths are instance-relative; resolving both to absolute is the only comparison
 * that does not depend on which directory the gate was invoked from.
 */
export function translationsByFile(
  instanceRoot: string,
): Map<string, { locale: string; page: string }> | undefined {
  const site = siteRoot(instanceRoot);
  if (!site) return undefined;
  const { index } = buildTranslationIndex(instanceRoot);
  const out = new Map<string, { locale: string; page: string }>();
  for (const page of Object.values(index.pages)) {
    // The page NAME the catalogue is keyed by, derived exactly as the drift
    // gate derives its own subject so the two cannot disagree.
    const name =
      page.sourceUrl.replace(/^\//, "").replace(/\.html$/, "").replace(/\/$/, "") || "index";
    // The FULL path, matching `driftFor`'s subject and `catalogueFor`'s
    // destination. This took the basename until 2026-09-27, which is the same
    // disagreement one gate over: this gate decided a page had no catalogue by
    // looking where `derive-po` would never have written one.
    for (const [locale, t] of Object.entries(page.translations)) {
      out.set(resolve(fileForUrl(site, t.url)), { locale, page: name });
    }
  }
  return out.size === 0 ? undefined : out;
}

/**
 * Files the change ADDS, repository-relative, or `undefined` if git would not say.
 *
 * ## Why there are two range modes and not one
 *
 * `since` uses THREE dots — what this side added since the merge base, not what
 * the other side did. A two-dot range against a moving branch would report a file
 * `main` added as this change's, and a gate about your own diff would then fail
 * you for somebody else's commit.
 *
 * `base` uses TWO, and it exists because three dots **needs a merge base that a
 * shallow clone does not have.** Measured on this gate's first CI run: the step
 * fetched `main` at depth 200, the ref was created (`* [new branch] main ->
 * origin/main`), and `origin/main...HEAD` still failed — the grafted history has
 * no common ancestor to find, so the gate correctly exited 2 rather than passing
 * blind.
 *
 * On a `pull_request` checkout `HEAD` is the merge commit, so it already CONTAINS
 * the base. Then `merge-base(base, HEAD) == base`, which makes `base..HEAD` and
 * `base...HEAD` the same set — and the two-dot form computes no merge base, so it
 * works with the base fetched at depth 1. That is the one case where dropping a
 * dot loses nothing, and it is why the mode is named for the thing it requires.
 */
export function addedFiles(
  mode: { staged: true } | { since: string } | { base: string },
): string[] | undefined {
  const args =
    "staged" in mode
      ? ["diff", "--name-only", "--diff-filter=A", "--cached"]
      : "base" in mode
        ? ["diff", "--name-only", "--diff-filter=A", mode.base, "HEAD"]
        : ["diff", "--name-only", "--diff-filter=A", `${mode.since}...HEAD`];
  try {
    // `stderr: "pipe"` so an unresolvable ref does not print git's own `fatal:`
    // over this gate's report. The refusal is already carried by `undefined`,
    // and a caller that prints a reason of its own should not also leak git's.
    return execFileSync("git", args, { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] })
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return undefined;
  }
}

/**
 * The base commit CI handed us, or `undefined` when it handed us none.
 *
 * ## Why the environment and not argv
 *
 * `gatesFrom` in `gates.ts` reads the gate set out of the workflow by taking
 * **every `bun …` LINE** of a step body as its own gate and running it verbatim.
 * So a step that chose its range with an `if`/`else` around two invocations
 * registered this one check TWICE, ran both locally with the variable unset, and
 * the `--base "$BASE_SHA"` half exited 2 with *"--base needs a ref"*. Measured
 * 2026-09-26; the same pair took the gate census from 167 to 168 and stranded
 * `audit-coverage`'s committed sidecar, which was recording the truth.
 *
 * One command line in the step is therefore not a tidiness preference — it is
 * what makes `bun run cat gates` run what CI runs, which is the entire premise of
 * deriving the local gate set from the workflow.
 *
 * **An empty string is `undefined`, not a ref.** GitHub expands
 * `github.event.pull_request.base.sha` to `""` on a `push` run, so treating
 * empty as present is exactly how the argv version failed.
 */
export function baseFromEnv(env: Record<string, string | undefined>): string | undefined {
  const v = env.CATALOGUE_BASE_SHA?.trim();
  return v ? v : undefined;
}

/**
 * The added files that publish a translation carrying no catalogue.
 *
 * A catalogue counts as present when it is on disk — added by this same change
 * or already committed. Both are correct: the gate's subject is "will this land
 * a publication with no catalogue", and a `.po` added in the same commit means
 * it will not.
 */
export function uncatalogued(
  instanceRoot: string,
  added: readonly string[],
  byFile: Map<string, { locale: string; page: string }>,
): Uncatalogued[] {
  const out: Uncatalogued[] = [];
  for (const file of added) {
    const hit = byFile.get(resolve(file));
    if (!hit) continue;
    const po = catalogueFor(instanceRoot, hit.locale, hit.page);
    if (existsSync(po)) continue;
    out.push({
      subject: `${hit.locale}/${hit.page}`,
      file,
      catalogue: relative(process.cwd(), po),
    });
  }
  return out;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const warn = argv.includes("--warn");
  const staged = argv.includes("--staged");
  const sinceAt = argv.indexOf("--since");
  const baseAt = argv.indexOf("--base");
  const since = sinceAt >= 0 ? argv[sinceAt + 1] : "origin/main";
  if (sinceAt >= 0 && !since) {
    console.error("--since needs a ref");
    process.exit(2);
  }
  if (baseAt >= 0 && !argv[baseAt + 1]) {
    console.error("--base needs a ref");
    process.exit(2);
  }
  // The base comes from the ENVIRONMENT when it is not on argv, and the CI step
  // sets it that way on purpose — see `baseFromEnv`.
  const base = baseAt >= 0 ? argv[baseAt + 1] : baseFromEnv(process.env);

  const byFile = translationsByFile(INSTANCE_ROOT);
  if (!byFile) {
    console.error(
      "could not determine: no site root, or the translation index lists no " +
        "published translation. A sweep over nothing is not agreement.",
    );
    process.exit(2);
  }

  const added = addedFiles(staged ? { staged: true } : base ? { base } : { since });
  if (!added) {
    console.error(
      `could not determine: git would not list what this change adds ` +
        `(${staged ? "--cached" : base ? `${base}..HEAD` : `${since}...HEAD`}). ` +
        `A three-dot range needs a merge base a shallow clone may not have — ` +
        `in CI pass \`--base <the PR's base sha>\` and fetch that commit.`,
    );
    process.exit(2);
  }

  const findings = uncatalogued(INSTANCE_ROOT, added, byFile);
  const scope = staged ? "staged" : base ? `${base}..HEAD` : `${since}...HEAD`;

  if (findings.length === 0) {
    console.log(
      `✓ no added file publishes an uncatalogued translation ` +
        `(${scope}: ${added.length} added file(s), ${byFile.size} published translation(s) known)`,
    );
    process.exit(0);
  }

  for (const f of findings) {
    console.error(
      `✗ ${f.subject}  ${f.file} publishes a translation with no catalogue — ` +
        `author ${f.catalogue}, or leave the page unpublished until it exists`,
    );
  }
  console.error(
    `\n${findings.length} translation(s) would be published with no \`.po\` (${scope}).\n` +
      "  This is NOT the existing backlog — it is what this change adds to it.\n" +
      "  `translation:drift:check` reports the backlog and is red by the owner's\n" +
      "  decision (bean `ngxj`, issue #206), so it cannot report growth in its own\n" +
      "  subject. That is what this gate is for (bean `3sm2`).\n" +
      "  Do NOT add an UNCATALOGED entry to silence this: #1384 reverted 25 of them\n" +
      "  on the owner's instruction, and that list is #1374's author's call.",
  );
  process.exit(warn ? 0 : 1);
}
