#!/usr/bin/env bun
/**
 * Which open PRs' bean edits must LAND before `beans/` can leave `main`, and
 * which can simply be PORTED to `cat/cat-harness/beans` instead?
 *
 * @module scripts/bean-rollover
 * @graphNode none — a read-only report over git and the open PRs
 * @covers none — a merge-steward report: it inventories, it judges no declared graph
 *
 * "Touches `beans/`" covers three different situations:
 *
 *   - a generated region (`beans/README.md`'s file COUNT) that is regenerated
 *     and needs nothing;
 *   - a bean whose edit `main` already carries, so the PR differs only because
 *     `main` moved on;
 *   - a bean that exists only on that PR — usually the session's own handover
 *     bean — which can be copied onto the beans branch without that PR landing
 *     at all.
 *
 * Only the last group is work, and only a bean BOTH sides edited needs a
 * person. This separates them.
 *
 * ## Five states per authored bean path, and the fifth is never clean
 *
 * | state | meaning |
 * |---|---|
 * | `already-on-main` | the PR's version matches the base, or its patch applies in reverse to the base — the base has the change |
 * | `port` | the base has not touched this bean since the fork point, so the PR's version can be copied onto the beans branch with nothing to lose |
 * | `port-superset` | both sides touched this bean, but one side is a strict superset once `updated_at` is set aside — portable without human adjudication; carries the superset side and the exact diff |
 * | `adjudicate` | BOTH the PR and the base changed this bean since the fork with divergent edits — a person picks, because either choice drops someone's edit |
 * | `could-not-determine` | git would not answer for this path. **Never reported as portable, never counted clean** |
 *
 * Porting over a bean the base also edited would silently destroy the base's
 * edit, which is why `adjudicate` is never folded into `port`.
 *
 * ## What this does NOT do
 *
 * **It never writes to `cat/cat-harness/beans`.** That branch is a seed copy
 * (`status: seed`, `authoritative: false`) and `main` remains the source of
 * truth; the port is a steward action, taken after the freeze, against a
 * re-copied seed.
 *
 * It also never deletes or rewrites a bean anywhere. `deletion-requires-confirmation`.
 *
 * ## Shared classifier
 *
 * `pathClass` and `differsOnlyInRegions` come from `merge-pipeline-paths.ts` —
 * the same functions `merge:overlap` and `merge:train` use, so this cannot
 * disagree with them about what "authored" means. The reverse-patch test for
 * "the base already carries this change" is the one `merge:leftover` uses for
 * its `landed` verdict.
 *
 * Usage:
 *   bun run cat beans:rollover                      # every open PR, via gh
 *   bun run cat beans:rollover -- 1764 1766         # just these
 *   bun run cat beans:rollover -- --base origin/main --no-fetch
 *   bun run cat beans:rollover -- --json            # the report on stdout
 *
 * Exit 0 nothing needs porting or adjudicating · 1 some does · 2 could not
 * determine for at least one path, or the PR list could not be read.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

import { directoryForGraph } from "../schemas/kg/cat-harness.ts";
import { git, parseMemberSpec, resolveMember } from "./merge-pipeline-git.ts";
import { pathClass, differsOnlyInRegions } from "./merge-pipeline-paths.ts";

const ROOT = join(import.meta.dir, "..", "..");
// The DECLARED beans subgraph (bean `gz47`), not a spelled "beans/". A
// checkout that declares none has no bean store to roll over, which is a
// usage error rather than an empty diff.
const SUBGRAPH = (() => {
  const dir = directoryForGraph(ROOT, "beans");
  if (dir === undefined) throw new Error("bean-rollover: no `beans` directory is declared in this checkout");
  return `${relative(ROOT, dir)}/`;
})();

export type State = "already-on-main" | "port" | "port-superset" | "adjudicate" | "could-not-determine";

export interface PathVerdict {
  path: string;
  state: State;
  /** Why, in one line, so a reader need not re-derive it. */
  because: string;
  /** Which side is the superset, when state is "port-superset". */
  superset?: "base" | "head";
  /** The exact diff showing lines added by the superset, when state is "port-superset". */
  diff?: string;
}

export interface SupersetResult {
  side: "base" | "head";
  diff: string;
}

interface PrVerdict {
  number: number | null;
  ref: string;
  head: string | null;
  authored: PathVerdict[];
  generatedRegions: string[];
  generated: string[];
  error?: string;
}

/** The blob at `ref:path`, or undefined when the path is absent there. */
export function blob(ref: string, path: string, root = ROOT): string | undefined {
  const r = git(root, ["show", `${ref}:${path}`]);
  return r.ok ? r.out : undefined;
}

/**
 * Strip the `updated_at:` front-matter line so two versions of a bean that
 * differ only in their timestamp compare equal.
 */
export function stripUpdatedAt(text: string): string {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return text;
  const fmRaw = m[1]!;
  const strippedFm = fmRaw
    .split(/\r?\n/)
    .filter((line) => !/^updated_at:\s*/.test(line))
    .join("\n");
  const rest = text.slice(m[0].length);
  return `---\n${strippedFm}\n---\n${rest}`;
}

/** Whether two versions of a bean differ only in the front-matter `updated_at` field. */
export function differsOnlyInUpdatedAt(a: string, b: string): boolean {
  return stripUpdatedAt(a) === stripUpdatedAt(b);
}

/**
 * Check if one version of a bean is a strict superset of the other once
 * `updated_at` is set aside.
 *
 * A strict superset means every line of the subset exists in the superset
 * in identical order with zero deletions, and the superset carries additional
 * lines.
 */
export function checkStrictSuperset(baseText: string, headText: string): SupersetResult | undefined {
  const cleanB = stripUpdatedAt(baseText);
  const cleanH = stripUpdatedAt(headText);
  if (cleanB === cleanH) return undefined;

  const dir = mkdtempSync(join(tmpdir(), "bean-superset-"));
  try {
    const pathH = join(dir, "head.md");
    const pathB = join(dir, "base.md");
    const normH = cleanH.endsWith("\n") ? cleanH : cleanH + "\n";
    const normB = cleanB.endsWith("\n") ? cleanB : cleanB + "\n";
    writeFileSync(pathH, normH);
    writeFileSync(pathB, normB);
    const r = spawnSync("git", ["diff", "--no-index", "-u", pathH, pathB], { encoding: "utf-8" });
    const out = r.stdout ?? "";
    if (!out) return undefined;

    const lines = out.split("\n");
    let inHunk = false;
    let additions = 0;
    let deletions = 0;
    const diffLines: string[] = [];

    for (const l of lines) {
      if (l.startsWith("@@")) {
        inHunk = true;
        diffLines.push(l);
        continue;
      }
      if (!inHunk) continue;
      diffLines.push(l);
      if (l.startsWith("+") && !l.startsWith("+++")) additions++;
      else if (l.startsWith("-") && !l.startsWith("---")) deletions++;
    }

    if (additions > 0 && deletions === 0) {
      return { side: "base", diff: diffLines.join("\n") };
    }
    if (deletions > 0 && additions === 0) {
      const rHead = spawnSync("git", ["diff", "--no-index", "-u", pathB, pathH], { encoding: "utf-8" });
      const headOut = rHead.stdout ?? "";
      const headHunks = headOut.split("\n").filter((l, i, arr) => {
        const firstHunk = arr.findIndex((x) => x.startsWith("@@"));
        return firstHunk !== -1 && i >= firstHunk;
      });
      return { side: "head", diff: headHunks.join("\n") };
    }
    return undefined;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Does `base` already carry the change this PR made to `path`?
 *
 * Two ways, cheapest first: the blobs are equal (or differ only inside
 * generated regions or updated_at), or the PR's own patch applies in REVERSE to the base's
 * version — meaning the change is present and the files differ only because
 * the base moved on. The reverse-patch runs in a throwaway index; no working
 * tree is touched. `merge:leftover` established this test.
 */
export function baseCarries(base: string, head: string, fork: string, path: string, root = ROOT): boolean | undefined {
  const b = blob(base, path, root);
  const h = blob(head, path, root);
  if (b === undefined || h === undefined) return b === h ? true : false;
  if (b === h) return true;
  if (differsOnlyInUpdatedAt(b, h)) return true;
  if (differsOnlyInRegions(b, h)) return true;

  // If head only touched updated_at compared to fork, head made no authored changes
  const f = blob(fork, path, root);
  if (f !== undefined && differsOnlyInUpdatedAt(f, h)) {
    return true;
  }

  const patch = git(root, ["diff", `${fork}..${head}`, "--", path]);
  if (!patch.ok) return undefined;
  if (patch.out.trim() === "") return true; // the PR did not change it after all

  const dir = mkdtempSync(join(tmpdir(), "bean-rollover-"));
  try {
    const r = spawnSync(
      "git",
      ["apply", "--reverse", "--check", "--unidiff-zero", "-"],
      { cwd: root, input: patch.out, env: { ...process.env, GIT_INDEX_FILE: join(dir, "idx") }, encoding: "utf-8" },
    );
    if (r.status === null) return undefined;
    return r.status === 0;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Did `base` itself change `path` since the fork point? */
export function baseTouched(base: string, fork: string, path: string, root = ROOT): boolean | undefined {
  const b = blob(base, path, root);
  const f = blob(fork, path, root);
  if (b === undefined || f === undefined) {
    const r = git(root, ["diff", "--name-only", `${fork}..${base}`, "--", path]);
    if (!r.ok) return undefined;
    return r.out.trim() !== "";
  }
  if (b === f) return false;
  if (differsOnlyInUpdatedAt(b, f)) return false;
  if (differsOnlyInRegions(b, f)) return false;
  return true;
}

export function classify(base: string, head: string, fork: string, path: string, root = ROOT): PathVerdict {
  const carries = baseCarries(base, head, fork, path, root);
  if (carries === undefined) {
    return { path, state: "could-not-determine", because: "git would not produce or test the patch for this path" };
  }
  if (carries) {
    return { path, state: "already-on-main", because: "the base carries this change; the files differ only because the base moved on" };
  }
  const touched = baseTouched(base, fork, path, root);
  if (touched === undefined) {
    return { path, state: "could-not-determine", because: "git would not say whether the base changed this path since the fork" };
  }
  if (touched) {
    const b = blob(base, path, root);
    const h = blob(head, path, root);
    if (b !== undefined && h !== undefined) {
      const superset = checkStrictSuperset(b, h);
      if (superset) {
        return {
          path,
          state: "port-superset",
          superset: superset.side,
          diff: superset.diff,
          because:
            superset.side === "base"
              ? "the base is a strict superset of this PR's version once updated_at is set aside — take-base preserves every edit"
              : "this PR's version is a strict superset of the base once updated_at is set aside — take-head preserves every edit",
        };
      }
    }
    return {
      path,
      state: "adjudicate",
      because: "both this PR and the base changed this bean since the fork — porting either way drops the other's edit",
    };
  }
  return { path, state: "port", because: "the base has not touched this bean since the fork, so the PR's version can be copied with nothing to lose" };
}

function openPrs(): Array<{ number: number; ref: string }> | undefined {
  const r = spawnSync("gh", ["api", "repos/litlfred/folio-assistant/pulls?state=open&per_page=100"], {
    encoding: "utf-8",
    cwd: ROOT,
  });
  if (r.status !== 0) return undefined;
  try {
    const d = JSON.parse(r.stdout) as Array<{ number: number; head: { ref: string } }>;
    return d.map((p) => ({ number: p.number, ref: p.head.ref }));
  } catch {
    return undefined;
  }
}

function main(): number {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const noFetch = args.includes("--no-fetch");
  const bi = args.indexOf("--base");
  const base = bi >= 0 ? args[bi + 1]! : "origin/main";
  const specs = args.filter((a) => !a.startsWith("--") && a !== base);

  let members: Array<{ number: number | null; ref: string }>;
  if (specs.length > 0) {
    members = specs.map((s) => ({ number: /^\d+$/.test(s) ? Number(s) : null, ref: s }));
  } else {
    const prs = openPrs();
    if (!prs) {
      console.error("beans:rollover: could not list the open PRs — COULD NOT DETERMINE, not a clean run.");
      return 2;
    }
    members = prs;
  }

  const verdicts: PrVerdict[] = [];
  for (const m of members) {
    const spec = parseMemberSpec(m.number ? String(m.number) : m.ref);
    const resolved = resolveMember(ROOT, spec, { fetch: !noFetch });
    if (!("sha" in resolved) || !resolved.sha) {
      verdicts.push({ number: m.number, ref: m.ref, head: null, authored: [], generatedRegions: [], generated: [], error: "head could not be resolved or fetched" });
      continue;
    }
    const head = resolved.sha;
    const fb = git(ROOT, ["merge-base", base, head]);
    if (!fb.ok) {
      verdicts.push({ number: m.number, ref: m.ref, head, authored: [], generatedRegions: [], generated: [], error: "no merge base with the base ref" });
      continue;
    }
    const fork = fb.out.trim();
    const names = git(ROOT, ["diff", "--name-only", `${fork}..${head}`, "--", SUBGRAPH]);
    if (!names.ok) {
      verdicts.push({ number: m.number, ref: m.ref, head, authored: [], generatedRegions: [], generated: [], error: "git would not list this PR's bean paths" });
      continue;
    }
    const paths = names.out.split("\n").map((s) => s.trim()).filter(Boolean);
    const v: PrVerdict = { number: m.number, ref: m.ref, head, authored: [], generatedRegions: [], generated: [] };
    for (const p of paths) {
      const cls = pathClass(p).class;
      if (cls === "generated") v.generated.push(p);
      else if (cls === "generated-regions") v.generatedRegions.push(p);
      else v.authored.push(classify(base, head, fork, p));
    }
    verdicts.push(v);
  }

  const all = verdicts.flatMap((v) => v.authored);
  const n = (s: State) => all.filter((a) => a.state === s).length;
  const undetermined = n("could-not-determine") + verdicts.filter((v) => v.error).length;

  if (json) {
    console.log(
      JSON.stringify(
        {
          $schema: "bean-rollover/v1",
          base,
          subgraph: SUBGRAPH,
          generated_at: new Date().toISOString(),
          summary: {
            prs: verdicts.length,
            authored: all.length,
            port: n("port"),
            port_superset: n("port-superset"),
            adjudicate: n("adjudicate"),
            already_on_main: n("already-on-main"),
            could_not_determine: n("could-not-determine"),
          },
          prs: verdicts,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`Bean rollover inventory — #1850 step 2, against ${base}\n`);
    for (const v of verdicts.filter((x) => x.authored.length || x.error)) {
      const label = v.number ? `#${v.number}` : v.ref;
      if (v.error) {
        console.log(`  ${label.padEnd(7)} COULD NOT DETERMINE — ${v.error}`);
        continue;
      }
      const c = (s: State) => v.authored.filter((a) => a.state === s).length;
      console.log(
        `  ${label.padEnd(7)} ${v.authored.length} authored · port ${c("port")} · port-superset ${c("port-superset")} · adjudicate ${c("adjudicate")} · already-on-main ${c("already-on-main")} · undetermined ${c("could-not-determine")}`,
      );
      for (const a of v.authored.filter((x) => x.state === "adjudicate" || x.state === "port-superset" || x.state === "could-not-determine")) {
        console.log(`            ${a.state.toUpperCase()}  ${a.path}`);
        console.log(`              ${a.because}`);
        if (a.state === "port-superset" && a.diff) {
          for (const line of a.diff.split("\n")) {
            console.log(`                ${line}`);
          }
        }
      }
    }
    console.log(`
  ${verdicts.length} PR(s) · ${all.length} authored bean path(s)
    port                ${n("port")}   copy onto the beans branch after the freeze; the PR need not land first
    port-superset       ${n("port-superset")}   one side is a strict superset — portable without human picking, diff recorded
    adjudicate          ${n("adjudicate")}   both sides changed the bean — a person picks
    already-on-main     ${n("already-on-main")}   nothing to do
    could-not-determine ${n("could-not-determine")}   NOT portable and NOT clean`);
    console.log(`
  This REPORTS. Porting is a steward action taken after step 3's freeze, against
  a re-copied seed — never by this script, which does not write to
  cat/cat-harness/beans at all: that branch is still status:seed,
  authoritative:false, and main is the store until fs43 migrates the writers.`);
  }

  if (undetermined > 0) return 2;
  return n("port") + n("port-superset") + n("adjudicate") > 0 ? 1 : 0;
}

// Guarded: importing this module must not run a rollover over every open PR
// (declared-directory-resolves imports each module that resolves a declared
// directory, which this one does since bean `gz47`).
if (import.meta.main) process.exit(main());
