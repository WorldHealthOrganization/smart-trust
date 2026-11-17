/**
 * Audit actor facts (capabilities and permissions) for consuming processes,
 * gateways, tasks, or rules in the knowledge graph.
 *
 * Every capability or permission declared on an actor must be read by at
 * least one process, gateway, task, or rule; one read nowhere is a finding.
 * Findings are report-only (`minor`, non-blocking). An empty actor set
 * returns `unknown` rather than passing.
 *
 * @module scripts/actor-facts
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { LoadedActor } from "../schemas/process/role-graph.js";
import type { ProcessModel } from "../src/workflow/process-model.js";
import { readPolicies, type OdrlPolicy } from "../schemas/content/odrl.js";
import type { KgFinding, KgCriterionEntry } from "../schemas/sdlc/kg-qa.js";

export interface ProcessInput {
  file: string;
  model?: ProcessModel;
  error?: string;
}

export interface ActorFactAuditOptions {
  actors: readonly LoadedActor[];
  processes?: readonly ProcessInput[];
  workflowFiles?: readonly string[];
  policiesDir?: string;
  policies?: ReadonlyMap<string, OdrlPolicy>;
  skillsDir?: string;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function matchesToken(id: string, text: string): boolean {
  const re = new RegExp(`(?:^|[^a-zA-Z0-9_-])${escapeRegex(id)}(?:[^a-zA-Z0-9_-]|$)`, "m");
  return re.test(text);
}

/**
 * Evaluate whether declared actor facts have at least one consuming process,
 * gateway, task, or rule in the KG.
 */
export function evaluateActorFactConsumers(options: ActorFactAuditOptions): KgCriterionEntry {
  const { actors } = options;

  // Vacuity guard: an empty actor set returns undetermined rather than passing.
  if (actors.length === 0) {
    return {
      result: "unknown",
      findings: [{ where: "—", detail: "no actors declared to evaluate actor facts against." }],
    };
  }

  const declaredCaps = new Map<string, string[]>();
  const declaredPerms = new Map<string, string[]>();

  for (const a of actors) {
    for (const c of a.capabilities ?? []) {
      const list = declaredCaps.get(c) ?? [];
      list.push(a.id);
      declaredCaps.set(c, list);
    }
    for (const p of a.permissions ?? []) {
      const list = declaredPerms.get(p) ?? [];
      list.push(a.id);
      declaredPerms.set(p, list);
    }
  }

  // Vacuity guard: if no actor declares any facts, undetermined rather than passing.
  if (declaredCaps.size === 0 && declaredPerms.size === 0) {
    return {
      result: "unknown",
      findings: [{ where: "—", detail: "no actor facts (capabilities or permissions) declared on any actor." }],
    };
  }

  // Collect text and models from workflow files (BPMN processes, tasks, gateways, and DMN decision tables).
  const workflowTexts: string[] = [];
  const filesToRead = new Set<string>();

  if (options.workflowFiles) {
    for (const f of options.workflowFiles) filesToRead.add(f);
  }
  if (options.processes) {
    for (const p of options.processes) filesToRead.add(p.file);
  }

  for (const f of filesToRead) {
    if (existsSync(f)) {
      try {
        workflowTexts.push(readFileSync(f, "utf-8"));
      } catch {
        // Unreadable file will be caught by other audits
      }
    }
  }

  // Check constrained ODRL rules (rules with process, task, or role constraints).
  const constrainedPolicyRules: { action: string; constraints: unknown[] }[] = [];
  let policies = options.policies;
  if (!policies && options.policiesDir && existsSync(options.policiesDir)) {
    try {
      policies = readPolicies(options.policiesDir);
    } catch {
      // Ignored here
    }
  }
  if (policies) {
    for (const policy of policies.values()) {
      for (const rule of [...policy.permission, ...policy.prohibition]) {
        if (rule.constraint && rule.constraint.length > 0) {
          constrainedPolicyRules.push({ action: rule.action, constraints: rule.constraint });
        }
      }
    }
  }

  // Check skill requiredCapabilities
  const skillRequiredCaps = new Set<string>();
  if (options.skillsDir && existsSync(options.skillsDir)) {
    try {
      const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const p = join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(p);
          } else if (entry.isFile() && (p.endsWith(".ts") || p.endsWith(".json"))) {
            const content = readFileSync(p, "utf-8");
            for (const c of declaredCaps.keys()) {
              if (content.includes("requiredCapabilities") && matchesToken(c, content)) {
                skillRequiredCaps.add(c);
              }
            }
          }
        }
      };
      walk(options.skillsDir);
    } catch {
      // Ignored here
    }
  }

  const consumedCaps = new Set<string>();
  const consumedPerms = new Set<string>();

  for (const c of declaredCaps.keys()) {
    if (skillRequiredCaps.has(c)) {
      consumedCaps.add(c);
      continue;
    }
    for (const text of workflowTexts) {
      if (matchesToken(c, text)) {
        consumedCaps.add(c);
        break;
      }
    }
  }

  for (const p of declaredPerms.keys()) {
    // Check constrained policy rules
    if (constrainedPolicyRules.some((r) => r.action === p || matchesToken(p, JSON.stringify(r.constraints)))) {
      consumedPerms.add(p);
      continue;
    }
    for (const text of workflowTexts) {
      if (matchesToken(p, text)) {
        consumedPerms.add(p);
        break;
      }
    }
  }

  const findings: KgFinding[] = [];

  for (const [c, actorIds] of [...declaredCaps.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (!consumedCaps.has(c)) {
      findings.push({
        where: c,
        detail: `declared capability "${c}" (claimed by ${actorIds.join(", ")}) has no consuming process, gateway, task, or rule in the KG.`,
      });
    }
  }

  for (const [p, actorIds] of [...declaredPerms.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (!consumedPerms.has(p)) {
      findings.push({
        where: p,
        detail: `declared permission "${p}" (claimed by ${actorIds.join(", ")}) has no consuming process, gateway, task, or rule in the KG.`,
      });
    }
  }

  findings.sort((a, b) => a.where.localeCompare(b.where));

  if (findings.length === 0) {
    return { result: "pass", findings: [] };
  }

  return { result: "fail", findings };
}
