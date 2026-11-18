#!/usr/bin/env bun
/**
 * Measure MCP-vs-CLI tool and capability parity for Developer Mode.
 *
 * Developer mode assumes a local workstation with CLI tools and a single
 * model, so a capability that exists only as an MCP tool blocks it.
 *
 * This script measures:
 * 1. How many declared Tool nodes have MCP invocations (`invoke.mcp`), CLI
 *    invocations (`invoke.shell` or matching `package.json` scripts), or both.
 * 2. Which skills/capabilities are covered by MCP, CLI, or both.
 * 3. The exact set of MCP-only capabilities that a CLI-only developer mode
 *    cannot exercise without an MCP client.
 *
 * @module scripts/check-tool-parity
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { tools } from "../schemas/tools/harness-tools.js";
import type { ToolDefinition } from "../schemas/tools/tool.js";
import { HARNESS_ROOT } from "./lib/roots.ts";


export interface ToolParityEntry {
  id: string;
  title: string;
  mcpName?: string;
  shellCommand?: string;
  skills: string[];
  surface: "both" | "mcp-only" | "cli-only" | "neither";
}

export interface SkillParityEntry {
  skill: string;
  mcpTools: string[];
  cliTools: string[];
  status: "both" | "mcp-only" | "cli-only" | "neither";
}

export interface ToolParityReport {
  date: string;
  totalTools: number;
  counts: {
    both: number;
    mcpOnly: number;
    cliOnly: number;
    neither: number;
    totalMcp: number;
    totalCli: number;
  };
  tools: {
    both: ToolParityEntry[];
    mcpOnly: ToolParityEntry[];
    cliOnly: ToolParityEntry[];
    neither: ToolParityEntry[];
  };
  skills: {
    totalSkillsCovered: number;
    both: string[];
    mcpOnly: string[];
    cliOnly: string[];
    neither: string[];
    details: SkillParityEntry[];
  };
  gapSummary: {
    mcpOnlyToolCount: number;
    mcpOnlySkillCount: number;
    mcpOnlySkills: string[];
    recommendation: string;
  };
}

export function measureToolParity(
  toolList: ToolDefinition[] = tools(),
  packageJsonPath: string = join(HARNESS_ROOT, "package.json"),
): ToolParityReport {
  const pkgScripts = new Set<string>();
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
        scripts?: Record<string, string>;
        checkoutScripts?: Record<string, string>;
      };
      for (const k of Object.keys(pkg.scripts ?? {})) pkgScripts.add(k);
      for (const k of Object.keys(pkg.checkoutScripts ?? {})) pkgScripts.add(k);
    } catch {
      // Proceed with tool.invoke.shell alone if package.json fails to read
    }
  }

  const both: ToolParityEntry[] = [];
  const mcpOnly: ToolParityEntry[] = [];
  const cliOnly: ToolParityEntry[] = [];
  const neither: ToolParityEntry[] = [];

  const skillMap = new Map<string, { mcpTools: string[]; cliTools: string[] }>();

  for (const t of toolList) {
    const hasMcp = Boolean(t.invoke?.mcp?.tool);
    const hasShell = Boolean(t.invoke?.shell);
    const mcpName = t.invoke?.mcp?.tool;
    const shellCmd = t.invoke?.shell;
    const skills = t.satisfies ?? [];

    let surface: "both" | "mcp-only" | "cli-only" | "neither";
    if (hasMcp && hasShell) {
      surface = "both";
      both.push({ id: t.id, title: t.title, mcpName, shellCommand: shellCmd, skills, surface });
    } else if (hasMcp) {
      surface = "mcp-only";
      mcpOnly.push({ id: t.id, title: t.title, mcpName, shellCommand: shellCmd, skills, surface });
    } else if (hasShell) {
      surface = "cli-only";
      cliOnly.push({ id: t.id, title: t.title, mcpName, shellCommand: shellCmd, skills, surface });
    } else {
      surface = "neither";
      neither.push({ id: t.id, title: t.title, mcpName, shellCommand: shellCmd, skills, surface });
    }

    for (const s of skills) {
      let entry = skillMap.get(s);
      if (!entry) {
        entry = { mcpTools: [], cliTools: [] };
        skillMap.set(s, entry);
      }
      if (hasMcp) entry.mcpTools.push(t.id);
      if (hasShell) entry.cliTools.push(t.id);
    }
  }

  const skillBoth: string[] = [];
  const skillMcpOnly: string[] = [];
  const skillCliOnly: string[] = [];
  const skillNeither: string[] = [];
  const skillDetails: SkillParityEntry[] = [];

  for (const [skill, entry] of skillMap.entries()) {
    const inMcp = entry.mcpTools.length > 0;
    const inCli = entry.cliTools.length > 0;
    let status: "both" | "mcp-only" | "cli-only" | "neither";
    if (inMcp && inCli) {
      status = "both";
      skillBoth.push(skill);
    } else if (inMcp) {
      status = "mcp-only";
      skillMcpOnly.push(skill);
    } else if (inCli) {
      status = "cli-only";
      skillCliOnly.push(skill);
    } else {
      status = "neither";
      skillNeither.push(skill);
    }
    skillDetails.push({
      skill,
      mcpTools: entry.mcpTools,
      cliTools: entry.cliTools,
      status,
    });
  }

  skillBoth.sort();
  skillMcpOnly.sort();
  skillCliOnly.sort();
  skillNeither.sort();
  skillDetails.sort((a, b) => a.skill.localeCompare(b.skill));

  const totalMcp = both.length + mcpOnly.length;
  const totalCli = both.length + cliOnly.length;

  return {
    date: new Date().toISOString().split("T")[0],
    totalTools: toolList.length,
    counts: {
      both: both.length,
      mcpOnly: mcpOnly.length,
      cliOnly: cliOnly.length,
      neither: neither.length,
      totalMcp,
      totalCli,
    },
    tools: {
      both,
      mcpOnly,
      cliOnly,
      neither,
    },
    skills: {
      totalSkillsCovered: skillMap.size,
      both: skillBoth,
      mcpOnly: skillMcpOnly,
      cliOnly: skillCliOnly,
      neither: skillNeither,
      details: skillDetails,
    },
    gapSummary: {
      mcpOnlyToolCount: mcpOnly.length,
      mcpOnlySkillCount: skillMcpOnly.length,
      mcpOnlySkills: skillMcpOnly,
      recommendation:
        skillMcpOnly.length > 0
          ? `Developer mode configured with toolSurface: "cli" cannot exercise ${skillMcpOnly.length} skills (including ${skillMcpOnly.slice(0, 4).join(", ")}). Configure toolSurface: "both" or provide CLI wrappers.`
          : "Full parity achieved between MCP and CLI tool surfaces.",
    },
  };
}

export function formatParityReport(report: ToolParityReport): string {
  const lines: string[] = [
    `# MCP-vs-CLI Tool Parity Report`,
    ``,
    `- **Measurement Date**: ${report.date}`,
    `- **Measurement Command**: \`bun run cat check:tool-parity\` (or \`bun run cat-harness-tools/scripts/check-tool-parity.ts\`)`,
    `- **Total Declared Tools**: ${report.totalTools}`,
    ``,
    `## Tool Surface Distribution`,
    ``,
    `| Surface | Tool Count | Percentage |`,
    `|---|---|---|`,
    `| **Both** (MCP + CLI) | ${report.counts.both} | ${((report.counts.both / report.totalTools) * 100).toFixed(1)}% |`,
    `| **MCP Only** | ${report.counts.mcpOnly} | ${((report.counts.mcpOnly / report.totalTools) * 100).toFixed(1)}% |`,
    `| **CLI Only** | ${report.counts.cliOnly} | ${((report.counts.cliOnly / report.totalTools) * 100).toFixed(1)}% |`,
    `| **Neither** (spec/placeholder) | ${report.counts.neither} | ${((report.counts.neither / report.totalTools) * 100).toFixed(1)}% |`,
    `| **Total MCP Capable** | ${report.counts.totalMcp} | ${((report.counts.totalMcp / report.totalTools) * 100).toFixed(1)}% |`,
    `| **Total CLI Capable** | ${report.counts.totalCli} | ${((report.counts.totalCli / report.totalTools) * 100).toFixed(1)}% |`,
    ``,
    `## Skill / Capability Coverage`,
    ``,
    `- **Total Skills Satisfied**: ${report.skills.totalSkillsCovered}`,
    `- **Satisfied on Both Surfaces**: ${report.skills.both.length}`,
    `- **Satisfied on CLI Only**: ${report.skills.cliOnly.length}`,
    `- **Satisfied on MCP Only (The Gap)**: ${report.skills.mcpOnly.length}`,
    ``,
  ];

  if (report.skills.mcpOnly.length > 0) {
    lines.push(`### MCP-Only Skills (Missing CLI surface)`);
    lines.push(``);
    lines.push(`| Skill | Implementing MCP Tools |`);
    lines.push(`|---|---|`);
    for (const s of report.skills.mcpOnly) {
      const detail = report.skills.details.find((d) => d.skill === s);
      lines.push(`| \`${s}\` | ${detail?.mcpTools.map((t) => `\`${t}\``).join(", ") ?? "none"} |`);
    }
    lines.push(``);
  }

  lines.push(`### MCP-Only Tools (${report.tools.mcpOnly.length} tools)`);
  lines.push(``);
  lines.push(`| Tool ID | MCP Served Name | Satisfies Skills |`);
  lines.push(`|---|---|---|`);
  for (const t of report.tools.mcpOnly) {
    lines.push(`| \`${t.id}\` | \`${t.mcpName}\` | ${t.skills.map((s) => `\`${s}\``).join(", ") || "—"} |`);
  }
  lines.push(``);

  lines.push(`## Developer Mode Impact`);
  lines.push(``);
  lines.push(report.gapSummary.recommendation);
  lines.push(``);

  return lines.join("\n");
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const report = measureToolParity();

  if (args.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatParityReport(report));
  }
}
