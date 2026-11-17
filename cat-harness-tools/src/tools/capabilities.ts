/**
 * Run the declared capability probes.
 *
 * `.claude/skills/capabilities/*.json` has always described how to detect each
 * external tool — a command, an env var, a file — and `requires` edges between
 * them. Nothing executed them: `--check-deps` carried its own hardcoded list,
 * and so did the `check_dependencies` MCP tool (once `src/tools/check-deps.ts`
 * here; bean `bbza` moved it up to the content layer that owns the paper
 * adapter, and this layer does not name it). So the probes
 * were documentation, and a skill declaring `requiredCapabilities` had
 * nothing to check against.
 *
 * That matters beyond tidiness. The integration contract in
 * `docs/proposals/rag-document-ingestion.md` §5 rests on **absent tool ⇒
 * `n/a`, never a false pass** — a document nobody parsed must not read as a
 * document with nothing in it. An unexecuted probe cannot deliver that: a
 * skill whose tool is missing looks identical to one whose tool found nothing.
 *
 * This module executes them. It does not replace the two hardcoded lists —
 * unifying those is a separate change with its own blast radius — so
 * `--check-deps` now reports both, and says which is which.
 *
 * @module src/tools/capabilities
 */

import { execSync } from "child_process";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { capabilitiesDir } from "../../schemas/process/role-graph.js";
import { checkoutCapabilities } from "../../schemas/process/scenario-overlay.js";

export interface CapabilityDetection {
  method: "command" | "env-var" | "file-exists" | "mcp-probe" | "always";
  command?: string;
  variable?: string;
  path?: string;
  endpoint?: string;
  expectExitCode?: number;
}

export interface Capability {
  id: string;
  name: string;
  description: string;
  detection: CapabilityDetection;
  requires?: string[];
  /**
   * The capability that stands in for this one — `CapabilityDefinition.fallbackTo`.
   *
   * Read here so `src/tools/degradation.ts` can resolve a skill's
   * `degradation: "fallback"` without a second loader. Bean
   * `folio-assistant-sym3` moved it off five skill modules onto the one
   * capability it describes.
   */
  fallbackTo?: string;
}

export interface CapabilityStatus {
  id: string;
  name: string;
  present: boolean;
  /** Why it is unavailable — a missing prerequisite reads differently from a failed probe. */
  reason?: string;
  /** Prerequisites that are themselves absent. */
  missingRequires: string[];
}

/**
 * Load every declared capability: the platform's, then those the checkout's
 * higher layers add in their own `scenarios/capabilities/`
 * (`checkoutCapabilities`, the scenario overlay). A probe whose subject is a
 * higher layer's toolchain is declared by that layer, never down here, and is
 * still run. Returns `[]` when the platform declares no capability directory.
 */
export function loadCapabilities(repoRoot: string): Capability[] {
  // The declared home inside `scenarios` (bean rqao). A layer with no
  // platform `scenarios` graph declares no capabilities: `[]`, as before.
  const dir = capabilitiesDir(repoRoot);
  if (dir === undefined || !existsSync(dir)) return [];
  // `<platform>/<scenarios>/capabilities` → the platform layer's root.
  const platformRoot = resolve(dir, "..", "..");
  let records: Record<string, unknown>[];
  try {
    records = checkoutCapabilities(platformRoot, dir);
  } catch (e) {
    // The overlay refuses a malformed file or a redeclared id loudly; a
    // dependency check must still report, so it falls back to the platform's
    // own probes and SAYS that it did.
    console.error(`capabilities: the checkout overlay could not be read (${e instanceof Error ? e.message : String(e)}); reporting the platform's own probes only`);
    records = [];
    for (const f of readdirSync(dir).sort()) {
      if (!f.endsWith(".json")) continue;
      try {
        records.push(JSON.parse(readFileSync(join(dir, f), "utf-8")) as Record<string, unknown>);
      } catch {
        // A malformed probe is not a present capability. Skipping it here is
        // safe because `probe` reports it absent, which is the honest default.
      }
    }
  }
  const out: Capability[] = [];
  for (const r of records) {
    const c = r as unknown as Capability & { path?: string };
    if (!c?.id || !c?.detection?.method) continue;
    const { path: _path, ...cap } = c;
    out.push(cap as Capability);
  }
  return out;
}

/**
 * Execute one probe.
 *
 * `mcp-probe` is deliberately not attempted: it would mean a network call from
 * a dependency check, and a check that hangs is worse than one that abstains.
 * It reports absent with a reason rather than pretending either way.
 */
export function probe(c: Capability, env: NodeJS.ProcessEnv = process.env): boolean {
  const d = c.detection;
  switch (d.method) {
    case "always":
      return true;
    case "env-var":
      return !!(d.variable && env[d.variable]);
    case "file-exists":
      return !!(d.path && existsSync(d.path));
    case "command": {
      if (!d.command) return false;
      try {
        execSync(d.command, { stdio: "pipe", env });
        return true;
      } catch (e) {
        const code = (e as { status?: number }).status;
        return d.expectExitCode !== undefined && code === d.expectExitCode;
      }
    }
    case "mcp-probe":
      return false;
    default:
      return false;
  }
}

/**
 * Probe everything, resolving `requires` first.
 *
 * A capability whose prerequisite is missing is reported absent **with that
 * prerequisite named**, and its own probe is not run — running it would either
 * fail confusingly or, worse, succeed and hide the broken dependency. Cycles
 * are treated as unmet rather than followed.
 */
export function probeAll(
  caps: Capability[],
  env: NodeJS.ProcessEnv = process.env,
): CapabilityStatus[] {
  const byId = new Map(caps.map((c) => [c.id, c]));
  const resolved = new Map<string, boolean>();
  const inFlight = new Set<string>();

  function resolve(id: string): boolean {
    if (resolved.has(id)) return resolved.get(id)!;
    const c = byId.get(id);
    if (!c) return false;
    if (inFlight.has(id)) return false; // cycle — unmet rather than infinite
    inFlight.add(id);
    const requiresMet = (c.requires ?? []).every((r) => resolve(r));
    const ok = requiresMet && probe(c, env);
    inFlight.delete(id);
    resolved.set(id, ok);
    return ok;
  }

  return caps.map((c) => {
    const present = resolve(c.id);
    const missingRequires = (c.requires ?? []).filter((r) => !resolved.get(r));
    return {
      id: c.id,
      name: c.name,
      present,
      missingRequires,
      reason: present
        ? undefined
        : missingRequires.length
          ? `requires ${missingRequires.join(", ")}`
          : c.detection.method === "mcp-probe"
            ? "mcp-probe not attempted from a dependency check"
            : "probe failed",
    };
  });
}

/** Human-readable report, in `--check-deps`'s existing idiom. */
export function formatCapabilityReport(statuses: CapabilityStatus[]): string {
  if (statuses.length === 0) return "  (no capability probes declared)";
  const lines: string[] = [];
  for (const s of statuses) {
    lines.push(`  ${s.present ? "✓" : "○"} ${s.id.padEnd(20)} ${s.present ? "" : `— ${s.reason}`}`);
  }
  return lines.join("\n");
}
