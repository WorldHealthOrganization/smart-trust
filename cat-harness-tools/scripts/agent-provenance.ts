#!/usr/bin/env bun
/**
 * Agent Provenance Detection
 *
 * Detects whether a PR is agent-authored, which makes the merge gate require
 * an adversarial review.
 *
 * Signals inspected:
 * 1. `Co-Authored-By: Claude...` or other agent trailers, or `Claude-Session:` / `Agent-Session:` trailers on any commit in base..head.
 * 2. Head branch prefix `claude/`, `agent/`, `bot/`, `dependabot/`.
 * 3. Bot author or committer (`github-actions[bot]`, `copilot`, `dependabot[bot]`, etc.).
 * 4. PR body markers (e.g. "Generated with Claude Code").
 *
 * Negative case:
 * A human-only PR (no bot, no Claude/agent trailers, not an agent branch) does NOT require an adversarial review.
 *
 * @module scripts/agent-provenance
 * @graphNode tool
 */

import { spawnSync } from "node:child_process";

export interface AgentProvenanceSignal {
  kind: "trailer" | "branch" | "bot" | "pr_body";
  detail: string;
  commit?: string;
}

export interface CommitInfo {
  sha?: string;
  authorName?: string;
  authorEmail?: string;
  committerName?: string;
  committerEmail?: string;
  message?: string;
  trailers?: Record<string, string | string[]>;
}

export interface ProvenanceInput {
  branch?: string;
  prBody?: string;
  commits?: CommitInfo[];
  baseRef?: string;
  headRef?: string;
  cwd?: string;
}

export interface AgentProvenanceResult {
  hasAgentProvenance: boolean;
  isHumanOnly: boolean;
  signals: AgentProvenanceSignal[];
  authorSessions: string[];
  summary: string;
}

const AGENT_BRANCH_PREFIXES = ["claude/", "agent/", "bot/", "dependabot/"] as const;

const BOT_PATTERNS = [
  /\[bot\]/i,
  /github-actions/i,
  /copilot/i,
  /dependabot/i,
  /merge-main/i,
  /noreply@anthropic\.com/i,
];

const AGENT_TRAILER_PATTERNS = [
  /claude/i,
  /\[bot\]/i,
  /agent/i,
  /copilot/i,
  /gpt/i,
];

/**
 * Parse trailers and session IDs from a commit message.
 */
export function extractTrailersFromMessage(message: string): {
  trailers: Record<string, string[]>;
  sessionIds: string[];
} {
  const trailers: Record<string, string[]> = {};
  const sessionIds: string[] = [];

  const lines = message.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();

    if (!key || !value) continue;

    if (!trailers[key]) {
      trailers[key] = [];
    }
    trailers[key].push(value);

    if (key.toLowerCase() === "claude-session" || key.toLowerCase() === "agent-session") {
      sessionIds.push(value);
    }
  }

  return { trailers, sessionIds };
}

/**
 * Read commits from git log between baseRef and headRef.
 */
export function readCommitsFromGit(
  baseRef?: string,
  headRef = "HEAD",
  cwd?: string,
): CommitInfo[] {
  const args = ["log", "-z", "--format=%H%x1f%an%x1f%ae%x1f%cn%x1f%ce%x1f%B"];

  if (baseRef) {
    args.push(`${baseRef}..${headRef}`);
  } else {
    // If no baseRef, inspect recent commits on headRef (e.g. up to 50)
    args.push("-n", "50", headRef);
  }

  const res = spawnSync("git", args, {
    cwd,
    encoding: "utf-8",
    timeout: 10_000,
  });

  if (res.status !== 0 || !res.stdout) {
    return [];
  }

  const entries = res.stdout.split("\0").filter((entry) => entry.trim().length > 0);
  const commits: CommitInfo[] = [];

  for (const entry of entries) {
    const parts = entry.split("\x1f");
    if (parts.length < 6) continue;
    const [sha, authorName, authorEmail, committerName, committerEmail, message] = parts;
    commits.push({
      sha,
      authorName,
      authorEmail,
      committerName,
      committerEmail,
      message,
    });
  }

  return commits;
}

/**
 * Determine current branch name via git if not supplied.
 */
export function getCurrentGitBranch(cwd?: string): string | undefined {
  const res = spawnSync("git", ["branch", "--show-current"], {
    cwd,
    encoding: "utf-8",
    timeout: 5_000,
  });
  if (res.status === 0 && res.stdout.trim()) {
    return res.stdout.trim();
  }
  return undefined;
}

/**
 * Detect agent provenance across branch name, PR body, and commit history.
 *
 * @param input Provenance options including branch, prBody, commits, or git refs.
 * @returns Comprehensive agent provenance result with signals and author sessions.
 */
export function detectAgentProvenance(input: ProvenanceInput = {}): AgentProvenanceResult {
  const signals: AgentProvenanceSignal[] = [];
  const authorSessionsSet = new Set<string>();

  // 1. Branch name inspection
  const branch = input.branch ?? (input.commits === undefined ? getCurrentGitBranch(input.cwd) : undefined);
  if (branch) {
    const isAgentBranch =
      AGENT_BRANCH_PREFIXES.some((prefix) => branch.startsWith(prefix)) ||
      branch.includes("/claude/");

    if (isAgentBranch) {
      signals.push({
        kind: "branch",
        detail: `Head branch '${branch}' matches agent branch pattern.`,
      });
    }
  }

  // 2. PR body inspection
  if (input.prBody) {
    if (/Generated with Claude Code/i.test(input.prBody)) {
      signals.push({
        kind: "pr_body",
        detail: "PR description contains 'Generated with Claude Code'.",
      });
    }
    const sessionMatch = input.prBody.match(/(?:Claude-Session|Agent-Session):\s*([a-zA-Z0-9_-]+)/i);
    if (sessionMatch) {
      const sess = sessionMatch[1].trim();
      authorSessionsSet.add(sess);
      signals.push({
        kind: "pr_body",
        detail: `PR description declares agent session '${sess}'.`,
      });
    }
  }

  // 3. Commits inspection
  let commits = input.commits;
  if (!commits && (input.baseRef || input.headRef || input.cwd)) {
    commits = readCommitsFromGit(input.baseRef, input.headRef ?? "HEAD", input.cwd);
  }

  if (commits && commits.length > 0) {
    for (const commit of commits) {
      const shaShort = commit.sha ? commit.sha.slice(0, 8) : undefined;

      // Check bot committer / author
      const identityFields = [
        commit.authorName,
        commit.authorEmail,
        commit.committerName,
        commit.committerEmail,
      ].filter((f): f is string => Boolean(f));

      for (const field of identityFields) {
        if (BOT_PATTERNS.some((pat) => pat.test(field))) {
          signals.push({
            kind: "bot",
            detail: `Bot author/committer identity detected: '${field}'.`,
            commit: shaShort,
          });
          break;
        }
      }

      // Check commit message and trailers
      const message = commit.message ?? "";
      const { trailers: parsedTrailers, sessionIds } = extractTrailersFromMessage(message);

      for (const sess of sessionIds) {
        authorSessionsSet.add(sess);
        signals.push({
          kind: "trailer",
          detail: `Commit carries agent session trailer: '${sess}'.`,
          commit: shaShort,
        });
      }

      // Merge explicit trailers if provided
      const allTrailers: Record<string, string[]> = { ...parsedTrailers };
      if (commit.trailers) {
        for (const [k, v] of Object.entries(commit.trailers)) {
          const arr = Array.isArray(v) ? v : [v];
          allTrailers[k] = [...(allTrailers[k] ?? []), ...arr];
        }
      }

      for (const [key, values] of Object.entries(allTrailers)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey === "claude-session" || lowerKey === "agent-session") {
          for (const val of values) {
            authorSessionsSet.add(val);
            if (!sessionIds.includes(val)) {
              signals.push({
                kind: "trailer",
                detail: `Commit carries ${key} trailer: '${val}'.`,
                commit: shaShort,
              });
            }
          }
        }

        if (lowerKey === "co-authored-by") {
          for (const val of values) {
            if (AGENT_TRAILER_PATTERNS.some((pat) => pat.test(val))) {
              signals.push({
                kind: "trailer",
                detail: `Commit carries agent Co-Authored-By trailer: '${val}'.`,
                commit: shaShort,
              });
            }
          }
        }
      }
    }
  }

  const hasAgentProvenance = signals.length > 0;
  const isHumanOnly = !hasAgentProvenance;
  const authorSessions = Array.from(authorSessionsSet);

  let summary: string;
  if (isHumanOnly) {
    summary = "human-only PR: no adversarial review required";
  } else {
    const summaryDetails = signals.map((s) => s.detail).join("; ");
    summary = `Agent provenance detected (${signals.length} signal${signals.length === 1 ? "" : "s"}): ${summaryDetails}`;
  }

  return {
    hasAgentProvenance,
    isHumanOnly,
    signals,
    authorSessions,
    summary,
  };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  let baseRef: string | undefined;
  let headRef: string | undefined = "HEAD";
  let branch: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--base" && args[i + 1]) {
      baseRef = args[++i];
    } else if (args[i] === "--head" && args[i + 1]) {
      headRef = args[++i];
    } else if (args[i] === "--branch" && args[i + 1]) {
      branch = args[++i];
    }
  }

  const result = detectAgentProvenance({ baseRef, headRef, branch });
  console.log(result.summary);
  if (result.hasAgentProvenance) {
    console.log(`Signals count: ${result.signals.length}`);
    for (const sig of result.signals) {
      console.log(` - [${sig.kind}] ${sig.detail}${sig.commit ? ` (${sig.commit})` : ""}`);
    }
    if (result.authorSessions.length > 0) {
      console.log(`Author sessions: ${result.authorSessions.join(", ")}`);
    }
  }
  process.exit(0);
}
