/**
 * Work-plan priming MCP tool — exposes the beans work-plan to any MCP-connected
 * agent, regardless of CLI (Claude Code, Gemini CLI, Antigravity, …).
 *
 * This is the agent-generic, platform layer of the session-start design
 * (docs/folio-assistant-migration.md §8, layer 3): a CLI that has no usable
 * session-start shell hook can still pull live priming by calling this tool.
 *
 * Tools:
 *   work_plan_prime — emit `beans prime` + `beans list`, or a beans/ fallback.
 *
 * @module folio-assistant/tools/beans-prime
 */

import { execSync } from "child_process";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { beanDefsDir } from "../../scripts/beans.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listInstances } from "../workflow/store.js";
import { positionOf } from "../workflow/instance.js";
import type { InstanceState } from "../workflow/instance.js";

/** Run a command in the repo, returning trimmed stdout or "" on failure. */
function run(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function hasBeans(cwd: string): boolean {
  return run("command -v beans", cwd) !== "";
}

/** CLI-independent fallback: read beans/*.md and list titles + status. */
export function primeFromDir(beansDir: string): string {
  if (!existsSync(beansDir)) {
    return "_(no beans/ store and no beans CLI — nothing to prime; see AGENTS.md)_";
  }
  const files = readdirSync(beansDir).filter((f) => f.endsWith(".md"));
  if (files.length === 0) return "_(no beans found in beans/)_";

  const lines: string[] = [
    "_(beans CLI not on PATH — reading beans/ directly; run `scripts/install-beans.sh` for full priming)_",
  ];
  for (const f of files.sort()) {
    let title = f.replace(/\.md$/, "");
    let status = "";
    try {
      const body = readFileSync(join(beansDir, f), "utf8");
      const titleMatch = body.match(/^#\s+(.+)$/m);
      if (titleMatch) title = titleMatch[1].trim();
      const statusMatch = body.match(/^(?:status|state):\s*(.+)$/im);
      if (statusMatch) status = statusMatch[1].trim();
    } catch {
      /* keep filename-derived title */
    }
    lines.push(`- ${title}${status ? ` [${status}]` : ""}`);
  }
  return lines.join("\n");
}

/**
 * Where the beans are in their processes.
 *
 * A bean says what is being worked on; a workflow instance says where it got
 * to. Reported apart, a reader gets two answers to one question — so priming
 * joins them here rather than leaving the reader to. Read-only: this reports
 * position, it does not advance anything.
 */
function workflowPositions(repoRoot: string): string {
  let instances: InstanceState[];
  try {
    instances = listInstances(repoRoot);
  } catch {
    return "";
  }
  if (instances.length === 0) return "";

  const lines = ["", "## Workflow position", ""];
  for (const i of instances) {
    const where =
      i.status === "completed"
        ? "completed"
        : i.tokens.length
          ? `at ${positionOf(i).join(", ")}`
          : "running, nothing enabled (stuck)";
    lines.push(
      `- \`${i.id}\` — ${i.subject} · ${where}` + (i.bean ? `  ← bean \`${i.bean}\`` : "  (no bean)"),
    );
  }
  const tracked = new Set(instances.map((i) => i.bean).filter(Boolean));
  lines.push(
    "",
    tracked.size > 0
      ? `_Beans above without an instance are not being tracked through a process; ` +
          `\`workflow_next\` reports what is enabled for those that are._`
      : `_No instance names a bean. \`workflow_start\` takes one — without it the ` +
          `work plan and the process stay two separate records._`,
  );
  return lines.join("\n");
}

import { registerBeanQueryTool } from "./bean-query.ts";

export function registerBeansTools(server: McpServer, repoRoot: string): void {
  registerBeanQueryTool(server, repoRoot);
  server.tool(
    "work_plan_prime",
    "Prime yourself with the current beans work-plan (session + cross-session/" +
      "cross-agent todos). Runs `beans prime` + `beans list`; if the beans CLI is " +
      "not installed, falls back to reading the committed beans/ store directly. " +
      "Use at the start of a task to see open items and claim before working.",
    {},
    async () => {
      let text: string;
      if (hasBeans(repoRoot)) {
        const prime = run("beans prime", repoRoot);
        const list = run("beans list", repoRoot);
        text = [prime, list].filter(Boolean).join("\n\n") || "_(beans returned nothing)_";
      } else {
        // The DECLARED bean-defs node (bean `gz47`). This read `beans/*.md`,
        // where the only Markdown is the directory README, so with no CLI the
        // fallback primed one "bean": the README.
        // declared-path-literal: the convention fallback for a layer that declares no bean-defs directory (AGENTS.md: an unmigrated instance falls back to today's conventions)
        text = primeFromDir(beanDefsDir(repoRoot) ?? join(repoRoot, "beans", "defs"));
      }
      return {
        content: [
          {
            type: "text" as const,
            text: `# Work-plan (beans)\n\n${text}\n${workflowPositions(repoRoot)}`,
          },
        ],
      };
    },
  );
}
