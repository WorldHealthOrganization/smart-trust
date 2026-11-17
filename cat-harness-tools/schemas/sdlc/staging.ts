/**
 * Staging comparison schema — before/after URL pairs for content review.
 *
 * Every feedback or review interaction involving rendered content should
 * include a `StagingComparison` object listing the before (main) and
 * after (staging) URLs for each changed page. This enables visual
 * comparison of changes in the browser.
 *
 * ## Integration points
 *
 * - **CRDM workflow** — Phase 5 (implementation) includes staging
 *   preview as an acceptance criterion
 * - **Content authoring** — author review sessions list changed pages
 * - **Translation review** — compare source vs translated pages
 * - **Feature branch review** — any PR with docs changes
 *
 * ## URL layout
 *
 * ```
 * Main:    https://<owner>.github.io/<repo>/<path>
 * Staging: https://<owner>.github.io/<repo>/branches/<branch-slug>/<path>
 * ```
 *
 * @module schemas/staging
 * @graphNode schema
 */

import { z } from "zod";

import { previewPath } from "./preview-prefix.ts";

// ── Types ───────────────────────────────────────────────────────

/**
 * A single before/after page comparison.
 */
export interface StagingPageComparison {
  /** Page title or path (e.g. "French landing page"). */
  title: string;
  /** URL on the main (production) site. Absent for new pages. */
  before?: string;
  /** URL on the staging preview site. Absent for deleted pages. */
  after?: string;
  /** What changed on this page (one-liner). */
  summary?: string;
}

/**
 * A complete staging comparison for a feature branch.
 *
 * Agents must include this in every feedback/review response that
 * involves rendered content changes.
 */
export interface StagingComparison {
  /** Feature branch name (e.g. "claude/206-staging-preview"). */
  branch: string;
  /** Branch slug used in the staging URL path. */
  slug: string;
  /** Full URL to the branch on GitHub. */
  branchUrl: string;
  /** PR number if one exists. */
  pr?: number;
  /** Base URL for the main site. */
  mainBaseUrl: string;
  /** Base URL for the staging preview. */
  stagingBaseUrl: string;
  /** Individual page comparisons. */
  pages: StagingPageComparison[];
  /**
   * What could not be linked, said rather than hidden: no preview yet, no
   * page list computed, or a changed page the publish ref does not hold.
   */
  missing?: string[];
}

// ── Zod schemas ─────────────────────────────────────────────────

export const StagingPageComparisonSchema = z.object({
  title: z.string(),
  before: z.string().url().optional(),
  after: z.string().url().optional(),
  summary: z.string().optional(),
});

export const StagingComparisonSchema = z.object({
  branch: z.string(),
  slug: z.string(),
  branchUrl: z.string().url(),
  pr: z.number().int().positive().optional(),
  mainBaseUrl: z.string().url(),
  stagingBaseUrl: z.string().url(),
  pages: z.array(StagingPageComparisonSchema),
  missing: z.array(z.string()).optional(),
});

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Convert a branch name to a staging slug.
 *
 * Mirrors the transform in `.github/workflows/feature-staging.yml`:
 * ```sh
 * echo "$BRANCH" | sed 's|[^a-zA-Z0-9._-]|-|g' | sed 's|--*|-|g' | sed 's|^-||;s|-$||'
 * ```
 */
export function branchToSlug(branch: string): string {
  return branch
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Construct the staging base URL for a branch.
 *
 * @param owner - GitHub user/org (e.g. "litlfred")
 * @param repo - Repository name (e.g. "folio-assistant")
 * @param branch - Branch name (e.g. "claude/206-staging-preview")
 * @returns Base URL for the staging preview
 */
export function stagingBaseUrl(owner: string, repo: string, branch: string): string {
  const slug = branchToSlug(branch);
  return `https://${owner}.github.io/${repo}/${previewPath(slug)}`;
}

/**
 * Construct the main (production) base URL.
 */
export function mainBaseUrl(owner: string, repo: string): string {
  return `https://${owner}.github.io/${repo}`;
}

/**
 * Build a StagingComparison from a list of changed file paths.
 *
 * @param owner - GitHub user/org
 * @param repo - Repository name
 * @param branch - Feature branch name
 * @param pr - PR number (optional)
 * @param changedPages - Array of page paths relative to docs/
 *   (e.g. ["fr/index.md", "guides/agent-onboarding.md"])
 * @param summaries - Optional map of path → change summary
 */
export function buildComparison(
  owner: string,
  repo: string,
  branch: string,
  pr: number | undefined,
  changedPages: string[],
  summaries?: Record<string, string>,
): StagingComparison {
  const slug = branchToSlug(branch);
  const main = mainBaseUrl(owner, repo);
  const staging = stagingBaseUrl(owner, repo, branch);
  const branchUrl = `https://github.com/${owner}/${repo}/tree/${branch}`;

  const pages: StagingPageComparison[] = changedPages.map((pagePath) => {
    // Convert .md path to .html
    const htmlPath = pagePath.replace(/\.md$/, ".html");
    const title = pagePath.replace(/\.md$/, "").replace(/\//g, " / ");

    // Determine if this is a new page (in a locale subdir) or existing
    const isLocaleDir = /^(ar|zh|fr|ru|es)\//.test(pagePath) ||
                        /\/(ar|zh|fr|ru|es)\//.test(pagePath);
    const isNew = isLocaleDir; // Locale pages are typically new

    return {
      title,
      before: isNew ? undefined : `${main}/${htmlPath}`,
      after: `${staging}/${htmlPath}`,
      summary: summaries?.[pagePath],
    };
  });

  return {
    branch,
    slug,
    branchUrl,
    pr,
    mainBaseUrl: main,
    stagingBaseUrl: staging,
    pages,
  };
}

/**
 * Format a StagingComparison as a Markdown comparison table.
 *
 * Used in PR comments, issue comments, and agent feedback responses.
 */
export function formatComparisonTable(comparison: StagingComparison): string {
  const lines: string[] = [];
  lines.push(`### 📋 Staging comparison — [\`${comparison.branch}\`](${comparison.branchUrl})`);
  if (comparison.pr) {
    lines.push(`PR #${comparison.pr}`);
  }
  lines.push("");
  lines.push("| Page | Before (main) | After (staging) | What changed |");
  lines.push("|---|---|---|---|");

  for (const page of comparison.pages) {
    const before = page.before
      ? `[main](${page.before})`
      : "—";
    const after = page.after
      ? `[staging](${page.after})`
      : "—";
    lines.push(`| ${page.title} | ${before} | ${after} | ${page.summary || "—"} |`);
  }

  lines.push("");
  lines.push(`_Staging preview: [${comparison.stagingBaseUrl}](${comparison.stagingBaseUrl})_`);
  lines.push(`_Compare with: [main site](${comparison.mainBaseUrl})_`);

  return lines.join("\n");
}
