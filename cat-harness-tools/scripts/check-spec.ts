#!/usr/bin/env bun
/**
 * Spec validation checker.
 *
 * Verifies that a specification adheres to the declared template
 * (`cat-harness/sdlc/skills/spec-kit/spec-template.md`):
 * - Contains all mandatory sections:
 *   - "User Scenarios & Testing"
 *   - "Requirements"
 *   - "Success Criteria"
 * - Does not reach adjudicated status with unresolved `[NEEDS CLARIFICATION]` markers.
 * - Reads specs from issue comments, not from a directory.
 *
 * Exit 0 pass, 1 finding, 2 could not determine.
 *
 * ```sh
 * bun run cat-harness-tools/scripts/check-spec.ts --issue 730
 * bun run cat-harness-tools/scripts/check-spec.ts --file path/to/spec.md
 * ```
 *
 * @covers schemas
 * @graphNode tool
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { harnessRel } from "./lib/harness-layout.ts";
import {
  MANDATORY_SPEC_SECTIONS,
  loadDeclaredSpecTemplate,
  validateSpec,
  type SpecValidationResult,
} from "../schemas/sdlc/spec-template.ts";

/** Default path to the declared spec template relative to repo root. */
// declared-path-literal: the spec template is one fixed FILE inside cat-harness's own spec-kit skill, not a directory any layer declares; the two spellings are the composed and standalone layouts. Written in the sub-graph layout and answered in whichever the harness has (transitional, scripts/lib/harness-layout.ts, cat-harness#991 step 23).
export const DEFAULT_TEMPLATE_PATH = existsSync(join("cat-harness", harnessRel("sdlc/skills/spec-kit/spec-template.md")))
  ? join("cat-harness", harnessRel("sdlc/skills/spec-kit/spec-template.md"))
  : harnessRel("sdlc/skills/spec-kit/spec-template.md");

export interface FetchResult {
  state: "ok" | "unknown";
  content?: string;
  reason?: string;
}

/**
 * Fetch comments for an issue using GitHub CLI (`gh`).
 * Returns state "unknown" if the tool fails or network is unreachable.
 */
export function fetchIssueComments(
  issueNumber: number,
  repo = "litlfred/folio-assistant"
): FetchResult {
  try {
    const res = spawnSync("gh", ["api", `repos/${repo}/issues/${issueNumber}/comments`], {
      encoding: "utf-8",
    });
    if (res.status !== 0) {
      return {
        state: "unknown",
        reason: `gh api exited with code ${res.status}: ${res.stderr || "unknown error"}`,
      };
    }
    const comments = JSON.parse(res.stdout);
    if (!Array.isArray(comments)) {
      return {
        state: "unknown",
        reason: "GitHub API response was not an array of comments",
      };
    }
    // Find comments that look like a spec
    const specComments = comments.filter((c: { body?: string }) => {
      const b = c.body || "";
      return (
        b.includes("Feature Specification") ||
        b.includes("User Scenarios & Testing") ||
        (b.includes("## Requirements") && b.includes("## Success Criteria"))
      );
    });

    if (specComments.length === 0) {
      return {
        state: "ok",
        content: undefined,
      };
    }

    // Return the latest spec comment
    const latest = specComments[specComments.length - 1];
    return {
      state: "ok",
      content: latest.body,
    };
  } catch (err: unknown) {
    return {
      state: "unknown",
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Run validation on a spec text against the declared template.
 */
export function checkSpecText(
  specText: string,
  templatePath: string = DEFAULT_TEMPLATE_PATH
): SpecValidationResult {
  let mandatory = MANDATORY_SPEC_SECTIONS;
  if (existsSync(templatePath)) {
    try {
      const declared = loadDeclaredSpecTemplate(templatePath);
      mandatory = declared.mandatorySections as unknown as typeof MANDATORY_SPEC_SECTIONS;
    } catch {
      // Fallback to constants if template parsing encounters error
    }
  }

  return validateSpec(specText, { mandatorySections: mandatory });
}

export interface BeanInfo {
  id?: string;
  type?: string;
  title?: string;
  status?: string;
  issueNumber?: number;
  repo?: string;
  rawContent: string;
}

/**
 * Parse a bean definition to extract its metadata and referenced issue.
 */
export function parseBeanDefinition(content: string, filePath?: string): BeanInfo {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/);
  const frontMatter = match ? match[1] : "";
  const body = match && match[2] ? match[2] : content;

  // Extract ID
  const idMatch =
    frontMatter.match(/^#\s*(\S+)/m) ||
    frontMatter.match(/^id:\s*["']?([^"'\r\n]+)["']?/im);
  let id = idMatch ? idMatch[1].trim() : undefined;
  if (!id && filePath) {
    id = filePath.split("/").pop()?.split("--")[0];
  }

  // Extract type
  const typeMatch = frontMatter.match(/^type:\s*["']?([^"'\r\n]+)["']?/im);
  const type = typeMatch ? typeMatch[1].trim().toLowerCase() : undefined;

  // Extract title
  const titleMatch = frontMatter.match(/^title:\s*["']?([^"'\r\n]+)["']?/im);
  const title = titleMatch ? titleMatch[1].trim() : undefined;

  // Extract status
  const statusMatch = frontMatter.match(/^status:\s*["']?([^"'\r\n]+)["']?/im);
  const status = statusMatch ? statusMatch[1].trim() : undefined;

  // Extract issue reference
  let issueNumber: number | undefined;
  let repo: string | undefined;

  const fmIssueMatch = frontMatter.match(/^issue:\s*["']?([^"'\r\n]+)["']?/im);
  if (fmIssueMatch) {
    const val = fmIssueMatch[1].trim();
    const urlMatch = val.match(/github\.com\/([^/\s]+\/[^/\s]+)\/issues\/(\d+)/i);
    if (urlMatch) {
      repo = urlMatch[1];
      issueNumber = parseInt(urlMatch[2], 10);
    } else {
      const numMatch = val.match(/^#?(\d+)$/);
      if (numMatch) {
        issueNumber = parseInt(numMatch[1], 10);
      }
    }
  }

  if (!issueNumber) {
    const bodyUrlMatch = body.match(/https:\/\/github\.com\/([^/\s]+\/[^/\s]+)\/issues\/(\d+)/i);
    if (bodyUrlMatch) {
      repo = bodyUrlMatch[1];
      issueNumber = parseInt(bodyUrlMatch[2], 10);
    } else {
      const bodyIssueMatch = body.match(/^[Ii]ssue:\s*#?(\d+)/m);
      if (bodyIssueMatch) {
        issueNumber = parseInt(bodyIssueMatch[1], 10);
      }
    }
  }

  return {
    id,
    type,
    title,
    status,
    issueNumber,
    repo,
    rawContent: content,
  };
}

export interface SpecBeforeCodeOptions {
  /** Path to a bean markdown file, or raw bean markdown content. */
  beanPath?: string;
  /** Explicit issue number. */
  issueNumber?: number;
  /** GitHub repository (default: litlfred/folio-assistant). */
  repo?: string;
  /** Custom fetch function for fetching issue comments (useful for testing and dependency injection). */
  fetchComments?: (issueNumber: number, repo?: string) => FetchResult;
  /** Direct spec markdown content (override for testing or when spec is already loaded). */
  specContent?: string;
  /** Whether the spec must be in adjudicated status. */
  requireAdjudicated?: boolean;
}

export interface SpecBeforeCodeResult {
  /** "pass" (exit 0), "finding" (exit 1), or "unknown" (exit 2). */
  state: "pass" | "finding" | "unknown";
  /** Descriptive findings for rule breaches. */
  findings: string[];
  /** Reason for could-not-determine (unknown) state or non-applicability note. */
  reason?: string;
  /** Issue number that was checked. */
  issueNumber?: number;
  /** Detailed spec validation result if a spec was checked. */
  specResult?: SpecValidationResult;
  /** Extracted bean info if a bean was checked. */
  beanInfo?: BeanInfo;
}

/**
 * Spec-before-code gate check (Child 3 / issue #753).
 *
 * Verifies that feature work (e.g. a feature bean with type: feature or PR)
 * is backed by an issue carrying a valid specification comment conforming
 * to the declared spec template.
 *
 * - If a spec comment is missing or invalid on the referenced issue, reports a finding (exit 1), not silence.
 * - If the issue or bean cannot be reached or fetched, reports could-not-determine (exit 2).
 * - If the spec comment exists, contains all mandatory sections, and is valid, reports pass (exit 0).
 */
export function checkSpecBeforeCode(
  target?: string | number | SpecBeforeCodeOptions,
  options: SpecBeforeCodeOptions = {}
): SpecBeforeCodeResult {
  let opts: SpecBeforeCodeOptions;
  if (typeof target === "number") {
    opts = { ...options, issueNumber: target };
  } else if (typeof target === "string") {
    if (/^\d+$/.test(target.trim())) {
      opts = { ...options, issueNumber: parseInt(target.trim(), 10) };
    } else {
      opts = { ...options, beanPath: target.trim() };
    }
  } else if (target && typeof target === "object") {
    opts = { ...target, ...options };
  } else {
    opts = { ...options };
  }

  let beanInfo: BeanInfo | undefined;

  if (opts.beanPath) {
    let content: string;
    if (opts.beanPath.startsWith("---")) {
      content = opts.beanPath;
    } else {
      const resolvedPath = resolve(opts.beanPath);
      if (!existsSync(resolvedPath)) {
        return {
          state: "unknown",
          findings: [],
          reason: `bean file not found at ${resolvedPath}`,
        };
      }
      try {
        content = readFileSync(resolvedPath, "utf-8");
      } catch (err: unknown) {
        return {
          state: "unknown",
          findings: [],
          reason: `could not read bean file: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    beanInfo = parseBeanDefinition(content, opts.beanPath);

    // If bean is not a feature (e.g., task, bug, chore), spec-before-code gate does not mandate a spec
    if (beanInfo.type && beanInfo.type !== "feature") {
      return {
        state: "pass",
        findings: [],
        reason: `bean '${beanInfo.id || opts.beanPath}' has type '${beanInfo.type}' (spec-before-code gate applies to feature work)`,
        beanInfo,
      };
    }

    // It is feature work! Check if it has a referenced issue.
    if (!opts.issueNumber) {
      if (beanInfo.issueNumber) {
        opts.issueNumber = beanInfo.issueNumber;
        if (!opts.repo && beanInfo.repo) {
          opts.repo = beanInfo.repo;
        }
      } else {
        return {
          state: "finding",
          findings: [
            `feature bean '${beanInfo.id || opts.beanPath}' carries no reference to a governing issue (spec-before-code requires an issue carrying an accepted spec comment)`,
          ],
          beanInfo,
        };
      }
    }
  }

  const issueNumber = opts.issueNumber;
  if (!issueNumber) {
    return {
      state: "unknown",
      findings: [],
      reason: "no issue number or feature bean provided to checkSpecBeforeCode",
    };
  }

  const repo = opts.repo || "litlfred/folio-assistant";

  // If specContent was directly passed (e.g. in test or pre-fetched), validate it
  let specMarkdown = opts.specContent;

  if (!specMarkdown) {
    const fetchFn = opts.fetchComments || fetchIssueComments;
    const fetched = fetchFn(issueNumber, repo);
    if (fetched.state === "unknown") {
      return {
        state: "unknown",
        issueNumber,
        findings: [],
        reason: `could not determine: failed to fetch comments for issue #${issueNumber}: ${fetched.reason || "unknown error"}`,
        beanInfo,
      };
    }
    if (!fetched.content) {
      return {
        state: "finding",
        issueNumber,
        findings: [
          `issue #${issueNumber} carries no reachable spec comment adhering to spec-template (FR-003, FR-004)`,
        ],
        beanInfo,
      };
    }
    specMarkdown = fetched.content;
  }

  // Validate the spec text
  const validation = validateSpec(specMarkdown, {
    requireAdjudicated: opts.requireAdjudicated,
  });

  if (validation.state === "fail") {
    return {
      state: "finding",
      issueNumber,
      findings: validation.findings.map(
        (f) => `spec on issue #${issueNumber} failed validation: ${f}`
      ),
      specResult: validation,
      beanInfo,
    };
  }

  return {
    state: "pass",
    issueNumber,
    findings: [],
    specResult: validation,
    beanInfo,
  };
}

// ── CLI execution ────────────────────────────────────────────────

if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.length === 0) {
    console.log(`usage: bun run cat-harness-tools/scripts/check-spec.ts [--issue <number>] [--file <path>] [--spec-before-code] [--bean <path>] [--require-adjudicated]

Validates that a spec adheres to the declared spec-kit template:
- All mandatory sections present ("User Scenarios & Testing", "Requirements", "Success Criteria")
- Unresolved [NEEDS CLARIFICATION] markers block Adjudicated status (SC-004)
- Three-state reporting: 0 = pass, 1 = finding, 2 = could not determine (FR-005)

Options:
  --spec-before-code        Enforce spec-before-code gate: checks whether feature work
                            (feature bean or issue) is backed by an issue carrying a valid spec comment.
                            Breach is a finding (exit 1), unreachable is exit 2.
  --issue <number>          GitHub issue number to inspect.
  --bean <path>             Path to a bean definition file.
  --file <path>             Local markdown file to validate as a spec.
  --require-adjudicated     Require spec to be in adjudicated status without unresolved markers.`);
    process.exit(0);
  }

  const isSpecBeforeCode = args.includes("--spec-before-code");
  const issueIdx = args.indexOf("--issue");
  const fileIdx = args.indexOf("--file");
  const beanIdx = args.indexOf("--bean");
  const requireAdjudicated = args.includes("--require-adjudicated");

  if (isSpecBeforeCode) {
    let issueNum: number | undefined;
    let beanPath: string | undefined;

    if (issueIdx !== -1 && args[issueIdx + 1]) {
      issueNum = parseInt(args[issueIdx + 1], 10);
    }
    if (beanIdx !== -1 && args[beanIdx + 1]) {
      beanPath = args[beanIdx + 1];
    }

    // Check positional argument right after --spec-before-code
    const sbcIdx = args.indexOf("--spec-before-code");
    if (sbcIdx !== -1 && args[sbcIdx + 1] && !args[sbcIdx + 1].startsWith("--")) {
      const nextArg = args[sbcIdx + 1];
      if (/^\d+$/.test(nextArg)) {
        issueNum = parseInt(nextArg, 10);
      } else {
        beanPath = nextArg;
      }
    }

    if (!issueNum && !beanPath && fileIdx !== -1 && args[fileIdx + 1]) {
      beanPath = args[fileIdx + 1];
    }

    if (!issueNum && !beanPath) {
      console.error("could not determine: please specify --issue <number> or --bean <path> with --spec-before-code");
      process.exit(2);
    }

    const result = checkSpecBeforeCode({
      issueNumber: issueNum,
      beanPath,
      requireAdjudicated,
    });

    if (result.state === "pass") {
      if (result.reason) {
        console.log(`✓ ${result.reason}`);
      } else {
        console.log(
          `✓ Spec-before-code gate PASSED: issue #${result.issueNumber} carries a valid specification (${result.specResult?.status || "valid"}).`
        );
      }
      process.exit(0);
    } else if (result.state === "finding") {
      console.error(`✗ Spec-before-code gate FINDING (${result.findings.length} finding(s)):`);
      for (const f of result.findings) {
        console.error(`  - ${f}`);
      }
      process.exit(1);
    } else {
      console.error(`? could not determine: ${result.reason}`);
      process.exit(2);
    }
  }

  // Standard spec checking for --issue or --file
  let specContent: string | undefined;

  if (issueIdx !== -1 && args[issueIdx + 1]) {
    const issueNum = parseInt(args[issueIdx + 1], 10);
    if (isNaN(issueNum)) {
      console.error(`Invalid issue number: ${args[issueIdx + 1]}`);
      process.exit(2);
    }

    console.log(`Reading spec from issue #${issueNum}...`);
    const fetched = fetchIssueComments(issueNum);
    if (fetched.state === "unknown") {
      console.error(`could not determine: ${fetched.reason}`);
      process.exit(2);
    }
    if (!fetched.content) {
      console.error(`finding: issue #${issueNum} carries no reachable spec comment (FR-003, FR-004)`);
      process.exit(1);
    }
    specContent = fetched.content;
  } else if (fileIdx !== -1 && args[fileIdx + 1]) {
    const filePath = resolve(args[fileIdx + 1]);
    if (!existsSync(filePath)) {
      console.error(`could not determine: file not found at ${filePath}`);
      process.exit(2);
    }
    specContent = readFileSync(filePath, "utf-8");
  } else {
    console.error("Please specify either --issue <number> or --file <path>");
    process.exit(2);
  }

  const result = validateSpec(specContent, { requireAdjudicated });

  if (result.state === "pass") {
    console.log(
      `✓ Spec is valid (${result.status || "no status specified"}, ${
        result.missingSections.length
      } missing sections, ${result.unresolvedClarifications.length} unresolved clarifications)`
    );
    process.exit(0);
  } else {
    console.error(`✗ Spec validation failed with ${result.findings.length} finding(s):`);
    for (const f of result.findings) {
      console.error(`  - ${f}`);
    }
    process.exit(1);
  }
}
