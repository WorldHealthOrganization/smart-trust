#!/usr/bin/env bun
/**
 * A forge field that goes stale is never named in advice **unqualified**.
 *
 * GitHub keeps serving a merged PR's pre-merge `mergeable`, `mergeable_state`,
 * `head.sha` and `updated_at` long after the merge; only `merged` is
 * stale-safe. Advice that tells a reader to read such a field must say
 * something about its reliability.
 *
 * The rule is structural, not a judgement of intent: a mention passes when its
 * neighbourhood **says something about the field's reliability**, and fails
 * when it is bare. Both legitimate shapes pass:
 *
 * - a **caution** — *"`unknown` means GitHub has not finished computing it,
 *   not that the PR is fine"*;
 * - a **measured licence** — *"when it is `dirty`, merge the base in"*
 *   (sound because a false `dirty` costs nothing).
 *
 * Default-deny: a qualifier must be present at the mention; there is no
 * per-line exemption table. Whole PATHS can be declined (see
 * {@link skipPath}); each carries its reason and is COUNTED in the summary.
 * `beans/` is out of scope: a bean is a past-tense record that may quote the
 * very string a fix removed.
 *
 * Exit: 0 every mention qualified, 1 one is bare, 2 could not check.
 *
 * @module folio-assistant/scripts/check-stale-field-advice
 * @covers skills, docs, processes — it walks every advice-bearing file, and the
 *   three kinds that hold one are the skills, the guides and the workflows.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { gitCorpus } from "../schemas/sdlc/git-corpus.js";
import { join, relative, resolve } from "node:path";

/** The repository root — this file lives at `<root>/cat-harness/scripts/`. */
export const ROOT = resolve(import.meta.dir, "..", "..");

/** A marker that makes a nearby mention qualified, and why it counts as one. */
export interface Qualifier {
  /** Matched case-insensitively as a substring. */
  readonly marker: string;
  /** What a reader learns from it about the field's reliability. */
  readonly because: string;
}

/** A forge field whose served value can be behind the truth. */
export interface StaleField {
  /** The token as it appears in prose. */
  readonly token: string;
  /** The bean that measured the staleness. */
  readonly bean: string;
  /** One line on what it serves wrongly, printed in every finding. */
  readonly why: string;
  /** Markers that qualify a mention of it. */
  readonly qualifiers: readonly Qualifier[];
}

/**
 * The fields. One today, and the shape is a table because the next one costs a
 * row rather than a second script.
 *
 * `mergeable` and `head.sha` went stale in the SAME measurement and are
 * deliberately absent: both are ordinary words in this corpus — `head.sha` is
 * read correctly dozens of times from a check-run payload, where it is not
 * served by the PR endpoint and not stale. A gate that cried wolf on those
 * would be deleted, and would take the one true rule with it.
 */
export const STALE_FIELDS: readonly StaleField[] = [
  {
    token: "mergeable_state",
    bean: "fx5r",
    why:
      "45 minutes after a PR merged, `GET /pulls/N` still served its PRE-MERGE " +
      "value. Only `merged` went stale-safe.",
    qualifiers: [
      { marker: "fx5r", because: "the bean that measured the 45-minute staleness" },
      { marker: "h2s9", because: "the bean that established `unknown` means NOT COMPUTED YET" },
      { marker: "yv4z", because: "the bean that measured what a `dirty` reading licenses" },
      { marker: "not `mergeable_state`", because: "the field is named only to warn against it" },
      { marker: "not that the pr", because: "states what the value does NOT mean" },
      { marker: "has not finished computing", because: "states the `unknown` semantics outright" },
      { marker: "not computed yet", because: "the same, in `h2s9`'s phrasing" },
      { marker: "serving", because: "as in `kept serving the pre-merge view` — names the staleness" },
      { marker: "pre-merge", because: "names WHICH view the field is stuck on" },
      { marker: "goes stale", because: "an explicit reliability claim" },
      { marker: "stale", because: "an explicit reliability claim" },
      { marker: "does not buy you", because: "denies the field answers the question asked of it" },
      { marker: "is not the way", because: "denies the field is the instrument for this" },
      { marker: "only `dirty`", because: "restricts trust to the one value whose falsity is free" },
      { marker: "when it is `dirty`", because: "the same restriction, as a condition" },
    ],
  },
];

/**
 * Directory names never descended into.
 *
 * `beans` is the substantive one and the docblock says why; the rest are
 * checkouts, caches and build output that this repository does not author.
 */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  // input-site: inert #b44a6f1d — names a build-output directory only to leave it out of a walk
  "dist",
  // input-site: inert #16b14f5d — names a build-output directory only to leave it out of a walk
  "build",
  ".next",
  "beans",
  "vendor",
  "__pycache__",
]);

/** File extensions that can carry advice a person or an agent reads. */
const ADVICE_EXT = /\.(md|ts|tsx|js|mjs|cjs|sh|yml|yaml)$/;

/**
 * A path this check declines to judge, with its reason.
 *
 * Kept to the two classes that are structurally not advice. Each is counted in
 * the report rather than dropped, so a reader can see what the coverage
 * excludes instead of inferring it from a clean verdict.
 */
export function skipPath(rel: string): string | undefined {
  // Generated from the skills themselves. Editing it is forbidden, so a
  // finding here is unactionable and would sit red until somebody deleted the
  // gate — and the source it is generated FROM is checked.
  if (rel.startsWith("cat-harness/docs/reference/")) return "generated — the source it comes from is checked"; // declared-path-literal: `rel` is repo-root-relative, so the prefix is too
  // This file declares the token in a table; every occurrence below is the
  // subject rather than advice. Self-reference, stated rather than assumed.
  if (rel === "cat-harness-tools/scripts/check-stale-field-advice.ts") return "the checker's own declaration";
  if (rel === "cat-harness-tools/scripts/tests/stale-field-advice.test.ts") return "the checker's own fixtures";
  // Its fixtures are VERBATIM turns from the session that earned the detector,
  // quoted so the guard is tested on the real defect rather than on the
  // author's idea of it. One of them happens to name this field, and inserting
  // a qualifier into it would make it not verbatim — which is the whole
  // property the fixture has.
  if (rel === "cat-harness-tools/scripts/tests/decisions-named-not-asked.test.ts") {
    return "verbatim transcript fixtures — a qualifier inserted here would stop them being verbatim";
  }
  return undefined;
}

/** One place a field is named, with the verdict on it. */
export interface Mention {
  readonly path: string;
  /** 1-indexed. */
  readonly line: number;
  readonly token: string;
  readonly text: string;
  /** The marker that qualified it, or `undefined` when it is bare. */
  readonly qualifier?: string;
}

/**
 * How far from the mention a qualifier still counts, in lines either way.
 *
 * Three, measured rather than chosen: it is the smallest window that reaches
 * every qualified site in this corpus at the time of writing, and the largest
 * that does not span a paragraph break in any of them. A line window rather
 * than a paragraph because a paragraph inside a `/** *\/` docblock is
 * delimited by ` *`, not by a blank line, so blank-line splitting silently
 * treats a 60-line docblock as one paragraph and passes everything in it.
 */
export const WINDOW = 3;

/** Every mention of `field` in `text`, each judged against the window around it. */
export function scanText(path: string, text: string, field: StaleField): Mention[] {
  const lines = text.split("\n");
  const out: Mention[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]!.includes(field.token)) continue;
    const window = lines
      .slice(Math.max(0, i - WINDOW), Math.min(lines.length, i + WINDOW + 1))
      .join("\n")
      .toLowerCase();
    const q = field.qualifiers.find((x) => window.includes(x.marker.toLowerCase()));
    out.push({
      path,
      line: i + 1,
      token: field.token,
      text: lines[i]!.trim(),
      ...(q === undefined ? {} : { qualifier: q.marker }),
    });
  }
  return out;
}

/**
 * Advice-bearing files relative to {@link ROOT} — **asked of git**, not walked.
 *
 * ## Why this asks git rather than reading the disk
 *
 * This sweep descends into `.claude/` on purpose: agent instructions live
 * there and they carry advice strings. But `.claude/worktrees/<id>/` is where
 * a worktree-isolated agent keeps a **complete second checkout of this
 * repository**, so a bare walk reads every advice string in the corpus twice
 * — once at its own path and once under `.claude/worktrees/agent-.../`.
 *
 * Measured 2026-09-30 with one agent worktree live: the sweep reported six
 * findings, **all six** with paths beginning `.claude/worktrees/agent-`, and
 * `bun test` went red on a branch whose diff did not touch any of them. Bean
 * `vpek` fixed the same class in `eslint.config.mjs` and left open the general
 * question — *are there other tools that walk from the root and would find a
 * worktree there?* This is one of the two that answer it yes.
 *
 * `.claude/worktrees/` is **gitignored** (`.gitignore:31`) and untracked, so
 * `git ls-files --cached --others --exclude-standard` never lists it. Asking
 * git is therefore both the narrow fix and the rule this repository already
 * states for corpus sweeps (`xd1g`, `ramz`, `root-scan-census`): a walk is a
 * guess at what the corpus is, and git knows.
 *
 * ## The fallback is NOT silent
 *
 * `gitCorpus` returns `undefined` when git cannot answer — not an empty list.
 * An empty corpus would make this check vacuously pass, which is the `dh4f`
 * shape: a consumer scanning nothing and reporting a clean run. So the walk
 * survives as an explicit fallback, and {@link adviceCorpusSource} says which
 * one ran so a caller can tell "clean" from "could not look".
 */
export type CorpusSource = "git" | "filesystem-fallback";

let lastSource: CorpusSource = "git";

/** Which enumeration produced the last {@link adviceFiles} result. */
export function adviceCorpusSource(): CorpusSource {
  return lastSource;
}

export function adviceFiles(root = ROOT): string[] {
  const listed = gitCorpus(root);
  if (listed !== undefined) {
    lastSource = "git";
    return listed
      .filter((abs) => ADVICE_EXT.test(abs))
      // The walk's OWN exclusions, re-applied to git's list. Asking git is a
      // change of enumeration, not of scope: without this the corpus widens
      // — `SKIP_DIRS` holds `beans`, which git lists and the walk never
      // entered, so 21 archived beans became findings the moment the source
      // changed. A fix that silently rescopes a check is a second defect
      // wearing the first one's clothes.
      .filter((abs) => {
        const segs = relative(root, abs).split(/[\\/]/);
        const dirs = segs.slice(0, -1);
        if (dirs.some((d) => SKIP_DIRS.has(d))) return false;
        return !dirs.some((d) => d.startsWith(".") && d !== ".github" && d !== ".claude");
      })
      .filter((abs) => {
        try {
          return statSync(abs).size < 2_000_000;
        } catch {
          // Listed by git but gone from the disk — a deleted-but-staged path.
          // Skipping it is right; counting it as advice is not.
          return false;
        }
      })
      .map((abs) => relative(root, abs))
      .sort();
  }
  lastSource = "filesystem-fallback";
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".") && e.name !== ".github" && e.name !== ".claude") continue;
      const abs = join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        walk(abs);
      } else if (e.isFile() && ADVICE_EXT.test(e.name) && statSync(abs).size < 2_000_000) {
        out.push(relative(root, abs));
      }
    }
  };
  walk(root);
  return out.sort();
}

export interface Report {
  readonly bare: readonly Mention[];
  readonly qualified: readonly Mention[];
  /** Paths declined, with the reason — counted so the coverage is visible. */
  readonly declined: ReadonlyArray<{ path: string; because: string }>;
  readonly filesScanned: number;
}

export function check(root = ROOT): Report {
  const bare: Mention[] = [];
  const qualified: Mention[] = [];
  const declined: Array<{ path: string; because: string }> = [];
  let filesScanned = 0;

  for (const rel of adviceFiles(root)) {
    const why = skipPath(rel);
    let text: string;
    try {
      text = readFileSync(join(root, rel), "utf8");
    } catch {
      continue;
    }
    // Declined paths are only reported when they would otherwise have had
    // something to say — a list of every generated file says nothing.
    if (why !== undefined) {
      if (STALE_FIELDS.some((f) => text.includes(f.token))) declined.push({ path: rel, because: why });
      continue;
    }
    filesScanned++;
    for (const f of STALE_FIELDS) {
      for (const m of scanText(rel, text, f)) (m.qualifier === undefined ? bare : qualified).push(m);
    }
  }
  return { bare, qualified, declined, filesScanned };
}

function main(): number {
  // The vacuity guard. A checker over an empty field table exits 0 and reads
  // as a clean sweep — `gates.ts`'s own argument, and `1xhc` in one line: a
  // gate that does not fire is indistinguishable from one that passed.
  if (STALE_FIELDS.length === 0) {
    console.error("check-stale-field-advice: the field table is empty — a bug here, not a clean tree.");
    return 2;
  }

  const r = check();
  if (r.filesScanned === 0) {
    console.error("check-stale-field-advice: scanned no files. Could not check.");
    return 2;
  }

  console.log(
    `check-stale-field-advice: ${r.filesScanned} file(s), ` +
      `${STALE_FIELDS.length} field(s), ` +
      `${r.qualified.length} qualified mention(s), ${r.bare.length} bare, ` +
      `${r.declined.length} path(s) declined.`,
  );
  for (const d of r.declined) console.log(`  · declined ${d.path} — ${d.because}`);

  if (r.bare.length === 0) {
    console.log("✓ every mention says something about the field's reliability.");
    return 0;
  }

  const byToken = new Map<string, StaleField>(STALE_FIELDS.map((f) => [f.token, f]));
  console.error(`\n${r.bare.length} unqualified mention(s):\n`);
  for (const m of r.bare) {
    const f = byToken.get(m.token)!;
    console.error(`  ${m.path}:${m.line}`);
    console.error(`    ${m.text}`);
    console.error(`    \`${m.token}\` — bean \`${f.bean}\`: ${f.why}`);
    console.error("");
  }
  console.error(
    `Say something about the field's reliability within ${WINDOW} line(s) of the\n` +
      `mention — a caution, or a measured licence naming the values you trust and\n` +
      `why. Naming the bean counts. This is not a style rule: the string this gate\n` +
      `exists for was posted to live PRs for four days after its fix merged,\n` +
      `because nothing linked the two copies.\n\n` +
      `If the file is not advice, decline the PATH in \`skipPath\` with a reason —\n` +
      `never a line number, which the next inserted paragraph invalidates.\n`,
  );
  return 1;
}

if (import.meta.main) process.exit(main());
