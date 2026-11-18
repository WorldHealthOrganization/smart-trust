/**
 * Generic orphan detection across declared graph kinds.
 *
 * Checks artefacts across declared graph kinds that reference a target/subject
 * that does not exist in the graph (e.g. beans referencing nonexistent parents,
 * sidecars whose subject file is missing, etc.).
 *
 * ## Vacuity Guard
 *
 * If no candidate artefacts are found across the inspected graph kinds (e.g. an
 * empty or uninitialized repository), the detector returns `unknown` rather than
 * a false `pass`.
 *
 * @module scripts/orphan-detector
 * @covers bean-defs, beans, qa, attestations, cat-harness
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, relative } from "node:path";

import type { KgCriterionEntry, KgFinding } from "../schemas/sdlc/kg-qa.js";
import { checkoutRootFor } from "../schemas/kg/harness-config.js";
import { resolveBeanDefs } from "./beans.ts";

export interface BeanReferenceCandidate {
  id: string;
  parent?: string;
  blocking?: string[];
  declaredBlockedBy?: string[];
  file?: string;
}

export interface SidecarCandidate {
  path: string;
  subjectPath?: string;
  unreadable?: boolean;
}

export interface AttestationCandidate {
  path: string;
  subjectPath?: string;
  unreadable?: boolean;
}

export interface OrphanDetectorOptions {
  /** The root directory of the layer being audited */
  root?: string;
  /** Repository root (defaults to checkoutRootFor(root) or climbing out of worktree) */
  repoRoot?: string;
  /** Custom beans directory (overrides default bean discovery) */
  beansDir?: string | null;
  /** In-memory beans array (for testing) */
  beans?: BeanReferenceCandidate[];
  /** Custom sidecars directory (overrides default discovery) */
  sidecarDir?: string | null;
  /** In-memory sidecars array (for testing) */
  sidecars?: SidecarCandidate[];
  /** Custom attestations directory (overrides default discovery) */
  attestationsDir?: string | null;
  /** In-memory attestations array (for testing) */
  attestations?: AttestationCandidate[];
}

export interface OrphanDetectionResult {
  entry: KgCriterionEntry;
  candidatesExamined: number;
  findings: KgFinding[];
  stats: {
    beansExamined: number;
    sidecarsExamined: number;
    attestationsExamined: number;
  };
}

/** Recursively collect all files under a directory. */
function walkFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  const walk = (d: string) => {
    try {
      const entries = readdirSync(d, { withFileTypes: true });
      for (const e of entries) {
        const full = join(d, e.name);
        if (e.isDirectory()) {
          walk(full);
        } else if (e.isFile()) {
          results.push(full);
        }
      }
    } catch {
      // unreadable directory is skipped
    }
  };
  walk(dir);
  return results;
}

/** Parse front-matter fields needed for bean orphan detection. */
function parseBeanReference(content: string, filename: string): BeanReferenceCandidate {
  const fileStem = basename(filename).replace(/\.md$/, "");
  const idFromFileName = fileStem.split("--")[0];

  const idMatch = /^id:\s*['"]?([a-z0-9-]+)['"]?/m.exec(content);
  const id = idMatch ? idMatch[1] : idFromFileName;

  const parentMatch = /^parent:\s*['"]?([^'"\n\r]+)['"]?/m.exec(content);
  const parent = parentMatch ? parentMatch[1].trim() : undefined;

  const blocking: string[] = [];
  const blockingMatch = /^blocking:\s*\n((?:[ \t]+-[ \t]*\S.*(?:\n|$))+)/m.exec(content);
  if (blockingMatch) {
    const lines = blockingMatch[1].split("\n");
    for (const l of lines) {
      const b = l.replace(/^[ \t]*-[ \t]*/, "").trim().replace(/^['"]|['"]$/g, "");
      if (b) blocking.push(b);
    }
  }

  const declaredBlockedBy: string[] = [];
  const blockedByMatch = /^blocked_by:\s*\n((?:[ \t]+-[ \t]*\S.*(?:\n|$))+)/m.exec(content);
  if (blockedByMatch) {
    const lines = blockedByMatch[1].split("\n");
    for (const l of lines) {
      const b = l.replace(/^[ \t]*-[ \t]*/, "").trim().replace(/^['"]|['"]$/g, "");
      if (b) declaredBlockedBy.push(b);
    }
  }

  return { id, parent, blocking, declaredBlockedBy, file: filename };
}

/**
 * Detect orphans across declared graph kinds:
 * - Beans referencing nonexistent parent or blocking targets.
 * - QA sidecars referencing nonexistent subject files.
 * - Attestations referencing nonexistent subjects.
 */
export function detectOrphansAcrossGraphs(options?: OrphanDetectorOptions): OrphanDetectionResult {
  const root = options?.root ?? process.cwd();
  let repoRoot = options?.repoRoot;
  if (!repoRoot) {
    try {
      repoRoot = checkoutRootFor(root);
    } catch {
      repoRoot = root;
    }
  }

  // If in a worktree, allow coordinator root fallback for repository-wide state
  const coordinatorRoot = repoRoot.includes("/.claude/worktrees")
    ? repoRoot.replace(/\/\.claude\/worktrees.*$/, "")
    : repoRoot;

  const findings: KgFinding[] = [];
  let beansExamined = 0;
  let sidecarsExamined = 0;
  let attestationsExamined = 0;

  // ── 1. Beans Graph ──────────────────────────────────────────────
  let beansList: BeanReferenceCandidate[] = [];
  const allBeanIds = new Set<string>();

  if (options?.beans) {
    beansList = options.beans;
    for (const b of beansList) {
      allBeanIds.add(b.id);
    }
  } else {
    // Resolve beans directory
    let defsDir: string | null = options?.beansDir ?? null;
    if (!defsDir) {
      // The bean store each root's graph DECLARES (`resolveBeanDefs`), in
      // the order the old literals tried — never a spelled `beans/defs`.
      for (const r of [root, repoRoot, coordinatorRoot]) {
        let cand: string | null = null;
        try {
          cand = resolveBeanDefs(r).dir;
        } catch {
          continue;
        }
        if (cand !== null && existsSync(cand)) {
          defsDir = cand;
          break;
        }
      }
    }

    if (defsDir && existsSync(defsDir)) {
      const activeFiles = readdirSync(defsDir)
        .filter((f) => f.endsWith(".md"))
        .map((f) => join(defsDir!, f));

      const archiveDir = join(defsDir, "archive");
      const archiveFiles = existsSync(archiveDir)
        ? readdirSync(archiveDir)
            .filter((f) => f.endsWith(".md"))
            .map((f) => join(archiveDir, f))
        : [];

      // Pass 1: Collect all bean IDs
      for (const f of [...activeFiles, ...archiveFiles]) {
        try {
          const content = readFileSync(f, "utf-8");
          const parsed = parseBeanReference(content, f);
          allBeanIds.add(parsed.id);
        } catch {
          // ignore unreadable file in ID collection
        }
      }

      // Pass 2: Build candidate beans list
      for (const f of activeFiles) {
        try {
          const content = readFileSync(f, "utf-8");
          beansList.push(parseBeanReference(content, f));
        } catch {
          findings.push({
            where: relative(repoRoot, f),
            detail: `bean definition "${relative(repoRoot, f)}" could not be read or parsed.`,
          });
        }
      }
    }
  }

  // Check bean references
  for (const b of beansList) {
    if (b.parent && b.parent.trim().length > 0) {
      beansExamined++;
      const p = b.parent.trim();
      if (!allBeanIds.has(p)) {
        findings.push({
          where: b.id,
          detail: `bean "${b.id}" references parent "${p}" which does not exist in the bean graph.`,
        });
      }
    }

    if (b.blocking && b.blocking.length > 0) {
      for (const target of b.blocking) {
        beansExamined++;
        if (!allBeanIds.has(target)) {
          findings.push({
            where: b.id,
            detail: `bean "${b.id}" references blocking target "${target}" which does not exist in the bean graph.`,
          });
        }
      }
    }

    if (b.declaredBlockedBy && b.declaredBlockedBy.length > 0) {
      for (const blocker of b.declaredBlockedBy) {
        beansExamined++;
        if (!allBeanIds.has(blocker)) {
          findings.push({
            where: b.id,
            detail: `bean "${b.id}" references blocked_by target "${blocker}" which does not exist in the bean graph.`,
          });
        }
      }
    }
  }

  // ── 2. QA Sidecars ──────────────────────────────────────────────
  if (options?.sidecars) {
    for (const s of options.sidecars) {
      sidecarsExamined++;
      if (s.unreadable) {
        findings.push({
          where: s.path,
          detail: `sidecar "${s.path}" could not be parsed as JSON.`,
        });
      } else if (s.subjectPath && s.subjectPath.length > 0) {
        const targetExists =
          existsSync(join(root, s.subjectPath)) ||
          existsSync(join(repoRoot, s.subjectPath)) ||
          existsSync(join(coordinatorRoot, s.subjectPath));
        if (!targetExists) {
          findings.push({
            where: s.path,
            detail: `sidecar "${s.path}" audits subject "${s.subjectPath}" which does not exist on disk.`,
          });
        }
      }
    }
  } else {
    let sidecarTree: string | null = options?.sidecarDir ?? null;
    if (!sidecarTree) {
      const candidates = [
        join(root, "test", "results", "kg-qa"),
        join(repoRoot, "test", "results", "kg-qa"),
        join(coordinatorRoot, "test", "results", "kg-qa"),
      ];
      for (const cand of candidates) {
        if (existsSync(cand)) {
          sidecarTree = cand;
          break;
        }
      }
    }

    if (sidecarTree && existsSync(sidecarTree)) {
      const sidecarFiles = walkFiles(sidecarTree).filter((f) => f.endsWith(".kg-qa.json"));
      for (const sf of sidecarFiles) {
        sidecarsExamined++;
        const rel = relative(repoRoot, sf) || relative(root, sf);
        try {
          const doc = JSON.parse(readFileSync(sf, "utf-8")) as {
            subject?: { path?: unknown };
          };
          const sp = doc?.subject?.path;
          if (typeof sp === "string" && sp.length > 0) {
            const targetExists =
              existsSync(join(root, sp)) ||
              existsSync(join(repoRoot, sp)) ||
              existsSync(join(coordinatorRoot, sp));
            if (!targetExists) {
              findings.push({
                where: rel,
                detail: `sidecar "${rel}" audits subject "${sp}" which does not exist on disk.`,
              });
            }
          }
        } catch {
          findings.push({
            where: rel,
            detail: `sidecar "${rel}" could not be parsed as JSON.`,
          });
        }
      }
    }
  }

  // ── 3. Attestations ─────────────────────────────────────────────
  if (options?.attestations) {
    for (const a of options.attestations) {
      attestationsExamined++;
      if (a.unreadable) {
        findings.push({
          where: a.path,
          detail: `attestation "${a.path}" could not be parsed as JSON.`,
        });
      } else if (a.subjectPath && a.subjectPath.length > 0) {
        const targetExists =
          existsSync(join(root, a.subjectPath)) ||
          existsSync(join(repoRoot, a.subjectPath)) ||
          existsSync(join(coordinatorRoot, a.subjectPath));
        if (!targetExists) {
          findings.push({
            where: a.path,
            detail: `attestation "${a.path}" attests to subject "${a.subjectPath}" which does not exist on disk.`,
          });
        }
      }
    }
  } else {
    let attTree: string | null = options?.attestationsDir ?? null;
    if (!attTree) {
      const candidates = [
        join(root, "test", "attestations"),
        join(repoRoot, "test", "attestations"),
        join(coordinatorRoot, "test", "attestations"),
      ];
      for (const cand of candidates) {
        if (existsSync(cand)) {
          attTree = cand;
          break;
        }
      }
    }

    if (attTree && existsSync(attTree)) {
      const attFiles = walkFiles(attTree).filter((f) => f.endsWith(".attestations.json"));
      for (const af of attFiles) {
        const rel = relative(repoRoot, af) || relative(root, af);
        try {
          const doc = JSON.parse(readFileSync(af, "utf-8")) as {
            subject?: { path?: unknown };
          };
          const sp = doc?.subject?.path;
          if (typeof sp === "string" && sp.length > 0) {
            attestationsExamined++;
            const targetExists =
              existsSync(join(root, sp)) ||
              existsSync(join(repoRoot, sp)) ||
              existsSync(join(coordinatorRoot, sp));
            if (!targetExists) {
              findings.push({
                where: rel,
                detail: `attestation "${rel}" attests to subject "${sp}" which does not exist on disk.`,
              });
            }
          }
        } catch {
          attestationsExamined++;
          findings.push({
            where: rel,
            detail: `attestation "${rel}" could not be parsed as JSON.`,
          });
        }
      }
    }
  }

  const candidatesExamined = beansExamined + sidecarsExamined + attestationsExamined;

  // ── Vacuity Guard ───────────────────────────────────────────────
  if (candidatesExamined === 0) {
    return {
      entry: {
        result: "unknown",
        findings: [
          {
            where: "—",
            detail:
              "no candidate artefacts found across declared graph kinds to check for orphan subjects, so vacuity guard returns unknown.",
          },
        ],
      },
      candidatesExamined: 0,
      findings: [],
      stats: { beansExamined, sidecarsExamined, attestationsExamined },
    };
  }

  if (findings.length > 0) {
    return {
      entry: {
        result: "fail",
        findings,
      },
      candidatesExamined,
      findings,
      stats: { beansExamined, sidecarsExamined, attestationsExamined },
    };
  }

  return {
    entry: {
      result: "pass",
      findings: [],
    },
    candidatesExamined,
    findings: [],
    stats: { beansExamined, sidecarsExamined, attestationsExamined },
  };
}

/**
 * Criterion runner for `orphan-subject-resolves`.
 */
export function orphanSubjectResolves(root?: string, options?: OrphanDetectorOptions): KgCriterionEntry {
  return detectOrphansAcrossGraphs({ ...options, root }).entry;
}
