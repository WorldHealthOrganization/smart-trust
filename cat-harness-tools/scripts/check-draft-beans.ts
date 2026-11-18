#!/usr/bin/env bun
/**
 * Detect branch-only draft decision beans.
 *
 * A ruling request bean awaiting a decision from the owner is marked
 * `status: draft` in front matter and carries a recommendation/safe default.
 * When such a bean exists ONLY on an unmerged feature branch, it is invisible
 * to sibling sessions reading the committed store on main.
 *
 * Reports beans that are `status: draft` AND carry a recommendation/default
 * section AND exist on no ancestor of the default branch, with a denominator.
 * `could not determine` is a finding, never green.
 *
 * Usage:
 *   bun run cat check:draft-beans
 *   bun run cat check:draft-beans -- --json
 *
 * Exit: 0 clean (or no bean store), 1 unmerged draft decision bean, 2 could not determine.
 *
 * @module scripts/check-draft-beans
 * @covers bean-defs, beans
 */
import { spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { relative, resolve } from "node:path";

import { beanDefsDir, readBeans, resolveBeanDefs, type BeanNode } from "./beans.ts";
import { isAncestor } from "./git-ancestry.ts";
import { BeanStoreAbsentError, exitIfBeanStoreAbsent } from "./lib/bean-store-absent.ts";

/** A defect found: a draft decision bean reachable from no ancestor of the default branch. */
export interface DraftBeanFinding {
  id: string;
  file: string;
  title: string;
  reason: string;
}

/** Result of the draft decision beans check. */
export interface DraftBeansReport {
  /** The bean store directory, or null if no store declared. */
  store: string | null;
  /** Default branch ref resolved, e.g. "origin/main". */
  defaultBranch?: string;
  /** Denominator: total number of beans in the store. */
  total: number;
  /** Number of beans with status: draft. */
  draftCount: number;
  /** Beans that are status: draft AND have recommendation/default section. */
  decisionDraftCount: number;
  /** Defects found: draft decision beans reachable from no ancestor of default branch. */
  findings: DraftBeanFinding[];
  /**
   * Undetermined states (could not determine git ancestry, unreadable store, etc.).
   * dh4f: could-not-determine is never rendered as clean.
   */
  undetermined: string[];
}

/** Options for testing and overriding check behaviour. */
export interface CheckDraftBeansOptions {
  /** Override the default branch ref to test against (e.g. "origin/main" or "main"). */
  defaultRef?: string;
  /** Custom beans provider for unit testing without filesystem. */
  beans?: BeanNode[];
  /** Custom isAncestor implementation for unit testing. */
  isAncestorFn?: typeof isAncestor;
  /** Custom git runner for unit testing. */
  gitFn?: (args: string[], cwd: string) => { status: number; stdout: string; stderr: string };
}

function runGit(args: string[], cwd: string): { status: number; stdout: string; stderr: string } {
  const r = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf-8" });
  return {
    status: r.status ?? (r.error ? 1 : 0),
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

/**
 * Detects whether a bean's body carries a recommendation or safe default section.
 *
 * A ruling request bean puts a decision in front of the owner with options,
 * a recommended course of action, and/or a stated safe default.
 */
export function hasRecommendationOrDefaultSection(body: string): boolean {
  // Phrase "safe default" anywhere in body
  if (/\bsafe\s+default\b/i.test(body)) return true;

  // Heading containing recommendation or default
  if (/^#{1,6}\s+.*?\b(?:recommendation|default)\b/im.test(body)) return true;

  // Heading containing "options" combined with a recommendation or default phrasing
  if (
    /^#{1,6}\s+.*?\boptions\b/im.test(body) &&
    (/\b(?:recommend|recommended|recommends)\b/i.test(body) || /\bif\s+(?:you\s+say\s+nothing|silent)\b/i.test(body))
  ) {
    return true;
  }

  // Explicit decision request pattern (ifSilent / If you say nothing)
  if (/\bif\s+silent\b/i.test(body) || /\bif\s+you\s+say\s+nothing\b/i.test(body)) {
    return true;
  }

  return false;
}

/**
 * Resolves the default branch ref (e.g. "origin/main" or "main").
 */
export function resolveDefaultRef(
  repo: string,
  customRef?: string,
  gitRunner = runGit,
): string | null {
  if (customRef) {
    const res = gitRunner(["rev-parse", "-q", "--verify", customRef], repo);
    return res.status === 0 ? customRef : null;
  }
  // Try origin/HEAD symbolic ref first
  const sym = gitRunner(["symbolic-ref", "-q", "--short", "refs/remotes/origin/HEAD"], repo);
  if (sym.status === 0 && sym.stdout.trim() !== "") {
    return sym.stdout.trim();
  }
  for (const cand of ["origin/main", "main", "origin/master", "master"]) {
    const res = gitRunner(["rev-parse", "-q", "--verify", cand], repo);
    if (res.status === 0) return cand;
  }
  return null;
}

/**
 * Checks all beans for branch-only draft decision beans.
 */
export function checkDraftBeans(
  root: string,
  opts: CheckDraftBeansOptions = {},
): DraftBeansReport {
  const storeRes = resolveBeanDefs(root);
  if (storeRes.unreachable) {
    if (storeRes.absent) throw new BeanStoreAbsentError(storeRes.unreachable);
    return {
      store: null,
      total: 0,
      draftCount: 0,
      decisionDraftCount: 0,
      findings: [],
      undetermined: [`cannot resolve the bean store: ${storeRes.unreachable}`],
    };
  }

  const beans = opts.beans ?? readBeans(root);
  if (beans === null) {
    // No bean store declared or present
    return {
      store: null,
      total: 0,
      draftCount: 0,
      decisionDraftCount: 0,
      findings: [],
      undetermined: [],
    };
  }

  const gitRunner = opts.gitFn ?? runGit;
  const gitTop = gitRunner(["rev-parse", "--show-toplevel"], root);
  if (gitTop.status !== 0) {
    return {
      store: beanDefsDir(root),
      total: beans.length,
      draftCount: 0,
      decisionDraftCount: 0,
      findings: [],
      undetermined: [
        `git rev-parse --show-toplevel failed: ${gitTop.stderr.trim() || "not a git repository"}`,
      ],
    };
  }
  const realRoot = existsSync(root) ? realpathSync(root) : root;
  const rawGitRoot = gitTop.stdout.trim();
  const gitRoot = existsSync(rawGitRoot) ? realpathSync(rawGitRoot) : rawGitRoot;

  const defRef = resolveDefaultRef(gitRoot, opts.defaultRef, gitRunner);
  if (!defRef) {
    return {
      store: beanDefsDir(root),
      total: beans.length,
      draftCount: 0,
      decisionDraftCount: 0,
      findings: [],
      undetermined: ["could not determine default branch ref"],
    };
  }

  const draftBeans = beans.filter((b) => b.status === "draft");
  const decisionDraftBeans = draftBeans.filter((b) => hasRecommendationOrDefaultSection(b.body));

  const findings: DraftBeanFinding[] = [];
  const undetermined: string[] = [];
  const ancFn = opts.isAncestorFn ?? isAncestor;

  for (const b of decisionDraftBeans.sort((x, y) => x.id.localeCompare(y.id))) {
    const fullPath = resolve(realRoot, b.file);
    const relPath = relative(gitRoot, fullPath);

    // Check if the default branch already contains this bean with status: draft
    const show = gitRunner(["show", `${defRef}:${relPath}`], gitRoot);
    if (show.status === 0) {
      const defStatus = /^status:\s*(\S+)/m.exec(show.stdout)?.[1];
      if (defStatus === "draft" && hasRecommendationOrDefaultSection(show.stdout)) {
        // The default branch itself carries this draft decision bean — it is landed and visible
        continue;
      }
    }

    // Has it ever been committed on HEAD or in the checkout?
    const logHead = gitRunner(["log", "-n", "1", "--format=%H", "HEAD", "--", relPath], gitRoot);
    const headCommit = logHead.stdout.trim();

    if (!headCommit) {
      // Uncommitted file on branch
      findings.push({
        id: b.id,
        file: b.file,
        title: b.title,
        reason: `draft decision bean is uncommitted and exists on no ancestor of ${defRef}`,
      });
      continue;
    }

    // Check ancestry against defRef
    const anc = ancFn(gitRoot, headCommit, defRef, { deepen: true });
    if (!anc.known) {
      undetermined.push(
        `could not determine ancestry for ${b.id} (${headCommit.slice(0, 9)}): ${anc.reason}`,
      );
    } else if (!anc.ancestor) {
      findings.push({
        id: b.id,
        file: b.file,
        title: b.title,
        reason: `draft decision bean exists on branch commit ${headCommit.slice(0, 9)} which is no ancestor of ${defRef}`,
      });
    }
  }

  return {
    store: beanDefsDir(root),
    defaultBranch: defRef,
    total: beans.length,
    draftCount: draftBeans.length,
    decisionDraftCount: decisionDraftBeans.length,
    findings,
    undetermined,
  };
}

/**
 * Format the check report as human-readable text.
 */
export function formatReport(report: DraftBeansReport): string {
  if (report.store === null && report.undetermined.length === 0) {
    return "Draft decision beans\n  · no bean store declared — nothing to check";
  }

  const out: string[] = [];
  const denominator = `${report.findings.length} unmerged of ${report.decisionDraftCount} draft decisions (${report.draftCount} draft, ${report.total} total)`;
  out.push(`Draft decision beans (${denominator})`);

  if (report.undetermined.length > 0) {
    for (const u of report.undetermined) {
      out.push(`  ✗ could not determine: ${u}`);
    }
    out.push("  · dh4f: could not determine is a finding, never green");
  }

  if (report.findings.length > 0) {
    for (const f of report.findings) {
      out.push(`  ✗ ${f.id} (${f.title}): ${f.reason}`);
    }
    out.push("");
    out.push("  A draft ruling request on an unmerged branch is invisible to sibling sessions.");
    out.push('  See work-plan/skills/work-plan/bean-coordination.md §"A DECISION bean you will not land soon".');
  }

  if (report.findings.length === 0 && report.undetermined.length === 0) {
    if (report.decisionDraftCount > 0) {
      out.push(
        `  ✓ every draft decision bean exists on an ancestor of ${report.defaultBranch ?? "default branch"}`,
      );
    } else {
      out.push("  ✓ no branch-only draft decision beans");
    }
  }

  return out.join("\n");
}

if (import.meta.main) {
  let report: DraftBeansReport;
  try {
    report = checkDraftBeans(resolve("."));
  } catch (e) {
    exitIfBeanStoreAbsent("check:draft-beans", e);
    console.error(`Could not check draft beans: ${e instanceof Error ? e.message : e}`);
    console.error("This is NOT a pass. Treat it as unknown.");
    process.exit(2);
  }

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatReport(report));
  }

  if (report.undetermined.length > 0) {
    process.exit(2);
  }
  process.exit(report.findings.length > 0 ? 1 : 0);
}
