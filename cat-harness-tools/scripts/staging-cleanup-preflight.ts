#!/usr/bin/env bun
/**
 * Is it safe to remove one `branches/<slug>/` review preview, RIGHT NOW?
 *
 * ```sh
 * bun run cat-harness-tools/scripts/staging-cleanup-preflight.ts --slug claude-health-checks
 * ```
 *
 * A preview is removed by `feature-staging.yml`'s `cleanup` job, on a closed
 * pull request or a `workflow_dispatch`. A dispatch input is a deletion
 * trigger, and this is the guard about the artefact rather than the caller.
 *
 * ## Liveness is judged again, at removal time
 *
 * The preview slug comes from the branch name, and a session can reuse one
 * branch across successive pull requests: PR N's close would delete the
 * preview PR N+1 just published, and a dispatch acting on a day-old sweep
 * verdict would do the same. So before any removal, liveness is evaluated
 * again through the SAME {@link previewLiveness} the health sweep uses (and
 * `probeOpenPrHeads`), verifying no other open PR or branch claims the slug.
 * Not a second implementation: two implementations of one judgement are free
 * to diverge.
 *
 * ## Three states, and the third one refuses
 *
 * - **exit 0** — every signal was evaluated and every one said no. Removal may
 *   proceed.
 * - **exit 1** — at least one signal says the preview is in use. Refuse.
 * - **exit 2** — a signal could not be evaluated. **Refuse.**
 *
 * In the health check "could not determine" means *do not accuse*; here it
 * means *do not delete*. Both err away from removal, the only recoverable
 * direction: `skills/conduct/conduct-core/deletion-requires-confirmation.md`.
 *
 * @module scripts/staging-cleanup-preflight
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { previewLiveness, type BranchEvidenceSet, type Probe } from "../test/health/checks.ts";
import { originSlug, probeBranches, probeOpenPrHeads } from "../test/health/probes.ts";
import { RETIRED_DIR, SLUG_PATTERN } from "./restore-staging.ts";
import { pathToFileURL } from "node:url";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { PREVIEW_PREFIX } from "./lib/preview-prefix.ts";

/**
 * What a slug may contain — defined in `restore-staging.ts` beside the other
 * staging names, and re-exported here for existing importers. It moved so that
 * `staging-rotate.ts` can read it without importing this module, which imports
 * `test/health/checks.ts`, which imports `MAX_PREVIEW_BYTES` from
 * `staging-rotate.ts`: a cycle in which `checks.ts` read the cap before it was
 * initialised whenever `staging-rotate.ts` was the entry point.
 */
export { SLUG_PATTERN };

export function slugProblem(slug: string): string | undefined {
  if (slug === "") return "the slug is empty.";
  if (!SLUG_PATTERN.test(slug)) {
    return `\`${slug}\` is not a staging slug: the workflow's own sed pipeline can only produce [A-Za-z0-9._-].`;
  }
  if (slug === "." || slug === "..") return `\`${slug}\` is a path, not a preview.`;
  if (slug === RETIRED_DIR) return `\`${slug}\` is the retired-record store (bean 6pfo), not a preview.`;
  return undefined;
}

export type PreflightVerdict =
  | { decision: "remove" }
  | { decision: "refuse-live"; why: string }
  | { decision: "refuse-unknown"; why: string };

function findGitRoot(start: string): string {
  let cur = resolve(start);
  while (true) {
    if (existsSync(join(cur, ".git"))) return cur;
    const parent = resolve(cur, "..");
    if (parent === cur) break;
    cur = parent;
  }
  return start;
}

export interface PreflightOptions {
  repoRoot?: string;
  repo?: string;
  remote?: string;
  now?: Date;
}

/**
 * Perform a full liveness evaluation for a preview slug against remote branches
 * and open pull requests. Refuses removal if any open PR or branch claims or reuses the slug.
 */
export async function runPreflight(
  slug: string,
  options: PreflightOptions = {},
): Promise<PreflightVerdict> {
  const bad = slugProblem(slug);
  if (bad !== undefined) return { decision: "refuse-unknown", why: bad };

  const root = options.repoRoot ?? findGitRoot(pathToFileURL(HARNESS_ROOT + "/").pathname);
  const repo = options.repo ?? process.env.GITHUB_REPOSITORY ?? originSlug(root);
  const openPrHeads = await probeOpenPrHeads(repo);
  const branches = probeBranches({ repoRoot: root, remote: options.remote ?? "origin", previewSlugs: [slug] });
  return preflight(slug, openPrHeads, branches, options.now ?? new Date());
}

/** The decision, pure, so it can be tested without a network. */
export function preflight(
  slug: string,
  openPrHeads: Probe<string[]>,
  branches: Probe<BranchEvidenceSet>,
  now: Date,
): PreflightVerdict {
  const bad = slugProblem(slug);
  if (bad !== undefined) return { decision: "refuse-unknown", why: bad };
  if (openPrHeads.state === "unknown") {
    return {
      decision: "refuse-unknown",
      why: `the open pull requests could not be listed: ${openPrHeads.reason}`,
    };
  }
  if (branches.state === "unknown") {
    return { decision: "refuse-unknown", why: `the remote branches could not be read: ${branches.reason}` };
  }
  const l = previewLiveness(slug, openPrHeads.value, branches.value, now);
  if (l.undetermined !== undefined) {
    return { decision: "refuse-unknown", why: `a liveness signal could not be evaluated — ${l.undetermined}` };
  }
  if (l.live.length > 0) {
    return { decision: "refuse-live", why: `${l.live.join(" + ")} — ${l.evidence}` };
  }
  return { decision: "remove" };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const idx = argv.findIndex((a) => a === "--slug" || a.startsWith("--slug="));
  const slug = idx === -1 ? "" : argv[idx].startsWith("--slug=") ? argv[idx].slice("--slug=".length) : (argv[idx + 1] ?? "");
  if (slug === "") {
    console.error("usage: bun run cat-harness-tools/scripts/staging-cleanup-preflight.ts --slug <staging-slug>");
    process.exit(2);
  }
  const repoIdx = argv.findIndex((a) => a === "--repo" || a.startsWith("--repo="));
  const repo = repoIdx === -1 ? undefined : argv[repoIdx].startsWith("--repo=") ? argv[repoIdx].slice("--repo=".length) : argv[repoIdx + 1];

  const verdict = await runPreflight(slug, { repo });

  if (verdict.decision === "remove") {
    console.log(`${PREVIEW_PREFIX}/${slug}: no liveness signal fired — no open pull request, no branch carrying unmerged work, no recent commit.`);
    console.log("Removal may proceed. It still needs the person who dispatched it to have said so, which is the confirmation input.");
    process.exit(0);
  }
  if (verdict.decision === "refuse-live") {
    console.error(`REFUSING to remove ${PREVIEW_PREFIX}/${slug}: it is still in use.`);
    console.error(`  ${verdict.why}`);
    console.error(
      "This is bean `w2g5` and `oz5w`: a preview whose pull request is closed is not an abandoned one, and a session that " +
        "reuses a branch across successive pull requests spends much of its life in that gap.",
    );
    process.exit(1);
  }
  console.error(`REFUSING to remove ${PREVIEW_PREFIX}/${slug}: liveness could not be established.`);
  console.error(`  ${verdict.why}`);
  console.error("Could-not-determine refuses here, the same way it declines to accuse in the health sweep.");
  process.exit(2);
}
