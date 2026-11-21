#!/usr/bin/env bun
/**
 * Every `degradation: "fallback"` has something real to fall back TO.
 *
 * A fallback may be a different tool or a different kind of participant
 * (e.g. an air-gapped actor whose API cannot be reached, where a person
 * signs instead). A `fallback` must resolve to a declared capability OR to a
 * derivable human lane.
 *
 * ## The human lane is derived, not declared
 *
 * The diagram already carries the fact executably: e.g. `Task_HumanSign` is
 * a `userTask` in `Lane_Human`, which binds `publication-manager`.
 * `fulfilmentKindsForBpmnType` maps `bpmn:UserTask` to `person` alone, so
 * the fallback role and the rule that stops the air-gapped route becoming
 * another machine route are the same fact and cannot disagree.
 *
 * ## The vacuity guard
 *
 * The run states what it examined, and refuses when the corpus is empty
 * rather than reporting a clean sweep.
 *
 * Usage:
 *   bun run cat check:fallback-roles
 *   bun run cat check:fallback-roles -- --explain   # print each derivation
 *
 * @module scripts/check-fallback-roles
 * @covers scenarios
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

import { workflowFiles, corpusScopeFor, roleGraphFor } from "./known-skills.js";
import { fulfilmentKindsForBpmnType } from "../schemas/process/role-graph.js";
import { isActivity, loadProcessModel, processDiagrams } from "../src/workflow/process-model.js";
import { CAPABILITIES_DIRNAME, capabilitiesDir } from "../schemas/process/role-graph.ts";
import { instanceDirectoriesForGraph, layerRootsIn } from "../schemas/kg/cat-harness.js";
import { skillDefinitionDirs } from "../schemas/kg/skill-definitions-dir.js";
import { HARNESS_ROOT } from "./lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);

/** One `degradation: "fallback"` occurrence, with enough to find it again. */
export interface FallbackUse {
  file: string;
  /** The skill id: the module basename, or a JSON definition's `id`. */
  skill: string;
  capabilityId: string;
}

/**
 * Every declared role id, across every declared knowledge-graph root.
 *
 * Through `kgRoots` and `readRoleGraph` rather than a literal path: the
 * `kg` directory is declared in `harness.json` and a layer may put it
 * anywhere, so a hardcoded `scenarios/roles.json` is one relocation away
 * from checking nothing. `check:declared-paths` caught exactly that in the
 * first draft of this file.
 */
export function declaredRoles(root: string): Set<string> {
  const out = new Set<string>();
  // The CHECKOUT's role graph when this is the platform's own run: its roles
  // plus any a dependent adds or extends by id (placement PR0b).
  for (const r of roleGraphFor(root, corpusScopeFor(root))?.roles ?? []) out.add(r.id);
  return out;
}

/** A declared capability, as much of it as this check needs. */
export interface CapabilityFacts {
  id: string;
  requires: string[];
  fallbackTo?: string;
}

/** Every declared capability, by id. */
export function declaredCapabilityFacts(root: string): Map<string, CapabilityFacts> {
  const out = new Map<string, CapabilityFacts>();
  // The declared home inside `scenarios` (bean rqao) — the same place
  // `src/tools/capabilities.ts` reads. Both bases are still tried, because a
  // caller may hand this a layer root or the repository root.
  for (const base of new Set([root, resolve(root, "..")])) readCapabilityDir(capabilitiesDir(base) ?? "", out);
  return out;
}

/**
 * Every capability the CHECKOUT declares: each layer's own `capabilities`
 * registry inside its declared `scenarios` graph.
 *
 * {@link declaredCapabilityFacts} reads the platform's registry only, and a
 * capability is declared by the layer its subject belongs to: the Lean pair
 * moved up to the layer that writes papers, and the platform's registry has no
 * `fallbackTo` left. The layers are DISCOVERED (`layerRootsIn`), never
 * named, because this layer may not name the layers above it.
 */
export function checkoutCapabilityFacts(repoRoot: string): Map<string, CapabilityFacts> {
  const out = new Map<string, CapabilityFacts>();
  for (const root of layerRootsIn(repoRoot)) {
    // Its OWN `scenarios` directories: a layer may declare more than one,
    // and a dependency's, which it can see, is read where that one is visited.
    for (const scenarios of instanceDirectoriesForGraph(root, "scenarios")) {
      readCapabilityDir(join(scenarios, CAPABILITIES_DIRNAME), out);
    }
  }
  return out;
}

/** Read one `capabilities` directory into `out`; an absent one adds nothing. */
function readCapabilityDir(dir: string, out: Map<string, CapabilityFacts>): void {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const f of names.filter((n) => n.endsWith(".json"))) {
    try {
      const j = JSON.parse(readFileSync(join(dir, f), "utf-8")) as Record<string, unknown>;
      const id = typeof j.id === "string" ? j.id : basename(f, ".json");
      out.set(id, {
        id,
        requires: Array.isArray(j.requires) ? j.requires.map(String) : [],
        ...(typeof j.fallbackTo === "string" ? { fallbackTo: j.fallbackTo } : {}),
      });
    } catch {
      // A capability file that will not parse is not a declared
      // capability. It is also not this check's business to report —
      // `kg:validate` owns that — so it is skipped rather than swallowed
      // into a pass.
    }
  }
}

/**
 * Blank out comments, keeping line numbers and code intact.
 *
 * Not cosmetic. This file's own header discusses `degradation: "fallback"`
 * in prose, and the first run of the rewritten check reported
 * `schemas/conduct/assistant-types.ts` as a skill with an unresolvable fallback —
 * it had matched a JSDoc table. A scanner that reads its own documentation
 * as corpus is the "measured the wrong thing" failure in miniature.
 *
 * It also fixes the reverse: a commented-out capability ref no longer
 * counts as a declaration.
 */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .split("\n")
    .map((l) => (/^\s*\/\//.test(l) ? "" : l))
    .join("\n");
}

/** Ids only, for callers that just need membership. */
export function declaredCapabilities(root: string): Set<string> {
  return new Set(declaredCapabilityFacts(root).keys());
}

/**
 * Does `target` need `missing`, directly or through its own `requires`?
 *
 * The question that decides whether a fallback can ever fire.
 * `probeAll` computes `present = requiresMet && probe(…)`, so a substitute
 * that transitively requires the absent capability is absent in exactly the
 * case it exists for.
 *
 * Cycle-safe by the same reading `probeAll` takes: a capability already on
 * the stack is unmet rather than infinitely recursed.
 */
export function transitivelyRequires(
  caps: Map<string, CapabilityFacts>,
  target: string,
  missing: string,
  seen: Set<string> = new Set(),
): boolean {
  if (seen.has(target)) return false;
  seen.add(target);
  const c = caps.get(target);
  if (!c) return false;
  for (const r of c.requires) {
    if (r === missing) return true;
    if (transitivelyRequires(caps, r, missing, seen)) return true;
  }
  return false;
}

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    // Every segment, not just the first — the dot-prefix guard this repo
    // already applies in `directory-conventions`.
    if (e.startsWith(".") || e === "node_modules") continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith(".ts") && !e.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

/**
 * Find every `degradation: "fallback"` entry in the scanned trees.
 *
 * A regex rather than the type checker, deliberately: the value must be a
 * literal for this to be checkable at all, and a computed one should be
 * visible as a miss rather than silently resolved.
 */
export function fallbackUses(root: string, dirs: string[]): FallbackUse[] {
  const out: FallbackUse[] = [];
  for (const d of dirs) {
    for (const f of walk(join(root, d))) {
      const text = stripComments(readFileSync(f, "utf-8"));
      // One capability ref per line is how every module in the corpus
      // writes them, and a ref split over lines would be a miss rather
      // than a false pass — visible in the count this prints.
      for (const line of text.split("\n")) {
        if (!/degradation:\s*["'`]fallback["'`]/.test(line)) continue;
        const cap = /capabilityId:\s*["'`]([^"'`]+)["'`]/.exec(line);
        out.push({
          file: relative(root, f),
          skill: basename(f, ".ts"),
          capabilityId: cap?.[1] ?? "(unparsed)",
        });
      }
    }
  }
  // The JSON skill definitions (y9r6 step 4a turned cat-harness's TypeScript
  // ones, `qa-report-signing` among them, into `skills/skill-definitions/*.json`).
  // Read as data: a `requiredCapabilities` entry whose `degradation` is
  // `fallback`, the same fact the line scan above reads from a module.
  for (const dir of skillDefinitionDirs(root)) {
    for (const e of readdirSync(dir).sort()) {
      if (!e.endsWith(".json")) continue;
      const f = join(dir, e);
      let def: { id?: unknown; requiredCapabilities?: unknown };
      try {
        def = JSON.parse(readFileSync(f, "utf-8")) as typeof def;
      } catch {
        continue; // a malformed definition is `skills:validate`'s finding
      }
      if (!Array.isArray(def.requiredCapabilities)) continue;
      for (const c of def.requiredCapabilities as { capabilityId?: unknown; degradation?: unknown }[]) {
        if (c?.degradation !== "fallback") continue;
        out.push({
          file: relative(root, f),
          skill: typeof def.id === "string" ? def.id : basename(e, ".json"),
          capabilityId: typeof c.capabilityId === "string" ? c.capabilityId : "(unparsed)",
        });
      }
    }
  }
  return out;
}

/**
 * The role a skill falls back to when no capability can do the work:
 * the role of a lane holding a task ONLY A PERSON can fill.
 *
 * Replaces the `fallbackRole` declaration. Returns every such role rather
 * than one, because "exactly one" is a property of today's corpus (3 of 3)
 * and not something this function may assume — a caller that needs one
 * should say what it does when there are two.
 */
export async function fallbackRoleFor(root: string, skill: string): Promise<string[]> {
  return (await fallbackRolesBySkill(root)).get(skill) ?? [];
}

/**
 * The same derivation for EVERY skill at once, in one pass over the corpus.
 *
 * Bean `sff8`. `fallbackRoleFor` reads every `.bpmn` in the repository and only then
 * filters by `skill`, so the expensive half is identical on every call. `src/index.ts`
 * called it once per skill — its own comment there notices that *"the derivation reads
 * every BPMN in the corpus"* and hoists the call out of a predicate, without removing
 * the repetition.
 *
 * Measured 2026-09-27 on this corpus of 74 diagrams and 23 skills carrying a
 * degradation declaration:
 *
 *     one `fallbackRoleFor` call        1745.8 ms
 *     the loop over all 23 skills      26016.8 ms
 *
 * One pass costs what a single call costs, so this is ~15x off a user-facing
 * operation rather than a micro-optimisation.
 *
 * **It is a single pass, NOT a cache**, and that is the whole reason it is shaped this
 * way. A cache over parsed models would have to answer when it goes stale — the
 * question `gitFileCommitSha` needed a HEAD key for — and worse, `loadProcessModel`
 * threads `seen` through its recursive descent to refuse a call-activity cycle
 * (`path.includes(node.calledElement)`), so a model cached under one call path and
 * returned under another could skip a refusal that is the point of the parameter.
 * 160 call sites, and `normaliseOwnExtensions` mutates the parse tree in place. One
 * pass per operation has none of that: nothing outlives the call.
 *
 * Equivalent to calling `fallbackRoleFor` per skill, not merely similar: the three
 * conditions (the node's skills, its fulfilment kinds, its `roleRef`) are independent
 * per node, so testing kinds and `roleRef` once and then attributing to each of the
 * node's skills selects the same pairs as testing the skill first.
 */
export async function fallbackRolesBySkill(root: string): Promise<Map<string, string[]>> {
  const bySkill = new Map<string, Set<string>>();
  for (const f of processDiagrams(workflowFiles(root, corpusScopeFor(root)))) {
    const model = await loadProcessModel(f);
    for (const n of [...model.nodes.values()].filter(isActivity)) {
      const kinds = fulfilmentKindsForBpmnType(n.type);
      // `undefined` means the BPMN type carries no fulfilment rule — not
      // that anyone may fill it. Treating that as human-fillable would
      // invent a fallback out of a gap in the mapping.
      if (!kinds || kinds.length === 0 || !kinds.every((k) => k === "person")) continue;
      if (!n.roleRef) continue;
      for (const skill of n.skills ?? []) {
        const roles = bySkill.get(skill) ?? new Set<string>();
        roles.add(n.roleRef);
        bySkill.set(skill, roles);
      }
    }
  }
  return new Map([...bySkill].map(([skill, roles]) => [skill, [...roles].sort()]));
}

/** The trees a skill's capability refs can live in. */
export const SCANNED = ["skills", "src", "schemas", "content", "adapters"];

if (import.meta.main) {
  const explain = process.argv.includes("--explain");
  const roles = declaredRoles(ROOT);
  const facts = declaredCapabilityFacts(ROOT);
  const uses = fallbackUses(ROOT, SCANNED);
  const diagrams = workflowFiles(ROOT, corpusScopeFor(ROOT)).filter((f) => f.endsWith(".bpmn"));

  console.log(
    `fallback: ${uses.length} use(s) across ${SCANNED.length} tree(s); ` +
      `${roles.size} declared role(s), ${facts.size} declared capability(ies), ` +
      `${diagrams.length} diagram(s)`,
  );

  // Vacuity: with no diagrams the role derivation cannot run, so a
  // "fallback with nothing behind it" is indistinguishable from one whose
  // diagram this sweep never opened.
  if (diagrams.length === 0) {
    console.error(
      "\n✗ EXAMINED NO DIAGRAMS — the role derivation had nothing to read.\n" +
        "  This is NOT a pass: a fallback with no route looks identical to one\n" +
        "  whose diagram was never opened.",
    );
    process.exit(1);
  }

  const bad: string[] = [];
  /**
   * Reported, not gated — see the header.
   *
   * Keyed by the CAPABILITY PAIR, not by the skill that hit it. Five Lean
   * skills share one broken fallback; printing it five times would report a
   * count of 5 for a defect of 1, which is the "a count is a claim, not
   * evidence" failure this repository keeps naming. The skills are listed
   * as the blast radius instead.
   */
  const circular = new Map<string, Set<string>>();
  for (const u of uses) {
    const via = facts.get(u.capabilityId)?.fallbackTo;
    if (via !== undefined) {
      if (!facts.has(via)) {
        bad.push(`${u.file}  →  ${u.capabilityId}.fallbackTo "${via}" is not a declared capability`);
        continue;
      }
      if (transitivelyRequires(facts, via, u.capabilityId)) {
        const key = `${u.capabilityId} → ${via}`;
        (circular.get(key) ?? circular.set(key, new Set()).get(key)!).add(u.skill);
      }
      if (explain) console.log(`  · ${u.skill.padEnd(24)} ${u.capabilityId} → capability ${via}`);
      continue;
    }
    const derived = await fallbackRoleFor(ROOT, u.skill);
    const unknown = derived.filter((r) => !roles.has(r));
    if (unknown.length > 0) {
      bad.push(`${u.file}  →  derived lane role(s) ${unknown.join(", ")} not in the role registry`);
      continue;
    }
    if (derived.length === 0) {
      bad.push(
        `${u.file}  →  ${u.capabilityId} declares no \`fallbackTo\` and no diagram gives ` +
          `"${u.skill}" a human-only lane, so the fallback resolves to nothing`,
      );
      continue;
    }
    if (explain) console.log(`  · ${u.skill.padEnd(24)} ${u.capabilityId} → role ${derived.join(", ")} (derived)`);
  }

  if (circular.size > 0) {
    // GATED as of 2026-09-20, once the one layer was resolved.
    //
    // It shipped reporting-only for a few hours, on `check:agents-xref`'s
    // precedent — "had a backlog and rightly reported before it gated" —
    // because the finding was sound while the correct SIDE was not yet
    // decided. The owner decided it: `lean-mcp` does not require a local
    // toolchain (its Lean runs server-side; detection is an `mcp-probe`),
    // so that requirement came off and the backlog is empty.
    //
    // An empty backlog is the whole reason this can gate now. A check that
    // fails on the day it lands teaches people to ignore it.
    const skills = new Set([...circular.values()].flatMap((v) => [...v]));
    console.log(
      `\n⚠ ${circular.size} fallback(s) can never fire — the substitute needs the missing ` +
        `thing (${skills.size} skill(s) affected):`,
    );
    for (const [pair, hit] of circular) {
      const [cap, via] = pair.split(" → ");
      console.log(`  · ${pair}, but ${via} requires ${cap}`);
      console.log(`      reached by: ${[...hit].sort().join(", ")}`);
    }
    console.log(
      `  \`probeAll\` computes present = requiresMet && probe(…), so a substitute that\n` +
        `  transitively requires the absent capability is absent in exactly the case it\n` +
        `  exists for — the fallback can never fire.\n\n` +
        `  Fix ONE of the two: drop the requirement if the substitute does not really\n` +
        `  need the missing thing, or stop calling it a fallback if it does.`,
    );
    process.exit(1);
  }

  if (bad.length === 0) {
    console.log(`\n✓ every \`fallback\` resolves — to a declared capability, or to a derived human lane`);
    process.exit(0);
  }

  console.log(`\n✗ ${bad.length} fallback(s) resolve to nothing:`);
  for (const b of bad) console.log(`  · ${b}`);
  console.log(
    `\nEither give the capability a \`fallbackTo\` that exists, or give the skill a\n` +
      `\`userTask\` in a lane that binds a declared role. A fallback with nothing\n` +
      `behind it is the defect this check exists to prevent.`,
  );
  process.exit(1);
}
