#!/usr/bin/env bun
/**
 * A short slash command for every skill a person may invoke.
 *
 * Usage: `bun run cat skill:commands` (write) · `bun run cat skill:commands:check`
 *
 * The MCP prompts (`src/tools/skill-prompts.ts`) reach every MCP host but are
 * namespaced — `/mcp__folio-assistant__coordinate`. This writes the short form,
 * `/coordinate`, as `.claude/commands/<name>.md`, for Claude Code. Both read the
 * same list, {@link userInvocableSkills}, so neither can offer a skill the
 * other does not.
 *
 * A generated command is a POINTER: it says which skill to run and where its
 * body is, and never inlines the body.
 *
 * ## Findings, in both directions
 *
 * - **missing** — a `user_invocable` skill with no command. Written.
 * - **stale** — a generated command whose text no longer matches. Rewritten.
 * - **orphaned** — a GENERATED command whose skill no longer declares itself
 *   invocable. Removed.
 * - **undeclared** — a HAND-WRITTEN command with no `user_invocable` skill of
 *   its name. Reported and never touched; its author decides.
 *
 * A command in a MOUNTED layer whose skill lies in a directory that mount
 * left out (a switched-off opt-in sub-graph in a whole mount's `except`, or a
 * directory a partial mount did not choose) is neither: the skill exists
 * upstream and is simply not on disk here. It is listed under `notMounted`,
 * never reported as a finding and never removed.
 *
 * A hand-written command (no `generated:` key) for a declared skill is left
 * alone — `watch`, `goal-review` and `staging-review` carry argument handling
 * a pointer cannot.
 *
 * `--check` exits 1 on any finding, 0 when every declared skill has a command
 * and every command has a declared skill.
 *
 * @covers skills
 * @module cat-harness/scripts/gen-skill-commands
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

import { checkoutRootFor, findDeclarationFile, layerRootsIn, readDeclaration } from "../schemas/kg/cat-harness.js";
import { lockedMountPaths } from "../schemas/kg/index-config.js";
import { mountChoiceOf, mountScopeFor } from "../schemas/kg/remote-mount.js";
import { userInvocableSkills, type InvocableSkill } from "./invocable-skills.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { discoverLocalPackages } from "./skill-packages.ts";

export const REPO_ROOT = checkoutRootFor(resolve(HARNESS_ROOT));

export const GENERATED_BY = "cat-harness-tools/scripts/gen-skill-commands.ts";
/**
 * Where this generator lived before bean `70lx` moved it out of cat-harness.
 * Commands written then carry this marker; reading them as hand-written left
 * all of them unrefreshed, with links to skills that had since moved.
 */
export const LEGACY_GENERATED_BY = ["cat-harness/scripts/gen-skill-commands.ts"];
export const COMMANDS_DIR = join(".claude", "commands");

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** True when a command file was written by this generator, at its current path or a former one. */
export function isGenerated(text: string): boolean {
  if (!text.startsWith("---")) return false;
  const end = text.indexOf("\n---", 3);
  const markers = [GENERATED_BY, ...LEGACY_GENERATED_BY].map(escape).join("|");
  return end !== -1 && new RegExp(`^generated:\\s*(?:${markers})\\s*$`, "m").test(text.slice(3, end));
}

/** One line, YAML-safe: the description a host shows in its command menu. */
function menuLine(summary: string | undefined, name: string): string {
  const s = (summary ?? `Run the ${name} skill.`).replace(/\s+/g, " ").trim();
  const first = s.length > 200 ? `${s.slice(0, 197).trimEnd()}...` : s;
  return JSON.stringify(first);
}

/** The text of the command for one skill. */
export function commandText(skill: InvocableSkill, repo: string): string {
  const rel = relative(repo, skill.path);
  return [
    "---",
    `description: ${menuLine(skill.summary, skill.name)}`,
    `argument-hint: "[what to run it on]"`,
    `generated: ${GENERATED_BY}`,
    "---",
    "",
    `# /${skill.name}`,
    "",
    `Run the \`${skill.name}\` skill. Read [\`${rel}\`](../../${rel}) and follow it.`,
    "",
    `This command is a pointer, generated from that skill's \`user_invocable: true\`; the`,
    `instructions live in the skill and nowhere else. The same skill is also served as the`,
    `MCP prompt \`${skill.name}\` by the folio-assistant server.`,
    "",
    "Arguments, if any: $ARGUMENTS",
    "",
  ].join("\n");
}

export type Finding =
  | { kind: "missing" | "stale"; name: string; file: string }
  | { kind: "orphaned"; name: string; file: string }
  | { kind: "undeclared"; name: string; file: string };

export interface CommandReport {
  declared: number;
  findings: Finding[];
  duplicates: { name: string; paths: string[] }[];
  /** Commands whose skill lies in a directory the layer's mount left out: not findings (see the module comment). */
  notMounted: { name: string; file: string; skill: string }[];
}

/** The layer-relative skill path a command points at (`[…](../../<path>)`), or `undefined`. */
export function pointerTarget(text: string): string | undefined {
  const m = /\]\(\.\.\/\.\.\/([^)\s]+)\)/.exec(text);
  return m?.[1];
}

/**
 * The skill path a command points at, when `repo` is a mounted layer and
 * that path lies in a directory its mount did not bring (an opt-in sub-graph
 * in `except`, or an unchosen directory); else `undefined`. The lock decides:
 * no lock, or a skill that is on disk, is no answer, and the command is
 * judged as usual.
 */
export function skillLeftOutByMount(repo: string, text: string): string | undefined {
  const target = pointerTarget(text);
  if (target === undefined) return undefined;
  const abs = resolve(repo, target);
  if (existsSync(abs) || !abs.startsWith(`${resolve(repo)}/`)) return undefined;
  return mountChoiceOf(repo, abs)?.chosen === false ? target : undefined;
}

/**
 * True when `targetRoot` is a mounted layer placed by a mount lock (bean `bx4c`).
 * A mounted layer is a read-only copy of a pinned commit; index surface
 * regeneration must never write inside it.
 */
export function isMountedInstance(targetRoot: string, baseRoot?: string): boolean {
  const abs = resolve(targetRoot);
  if (baseRoot !== undefined && abs === resolve(baseRoot)) return false;
  const scope = mountScopeFor(abs);
  if (scope !== undefined && scope !== abs) return true;
  const base = baseRoot ? resolve(baseRoot) : checkoutRootFor(abs);
  if (abs === base) return false;
  return lockedMountPaths(base).some((p) => resolve(base, p) === abs);
}

/**
 * Skill packages for `repo`: a layer root gets only the skills it owns
 * (`"instance"`, bean `t5zb`), while an index root gets the checkout overlay.
 */
export function packagesFor(repo: string = REPO_ROOT): Record<string, string> {
  const abs = resolve(repo);
  if (findDeclarationFile(abs) !== undefined) {
    return discoverLocalPackages(abs, "instance");
  }
  return abs === resolve(REPO_ROOT)
    ? discoverLocalPackages(resolve(HARNESS_ROOT))
    : discoverLocalPackages(abs, "checkout");
}

export function reconcile(repo: string = REPO_ROOT, packages: Record<string, string> = packagesFor(repo)): CommandReport {
  const { skills, duplicates } = userInvocableSkills(packages);
  const dir = join(repo, COMMANDS_DIR);
  const present = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".md")) : [];
  const declared = new Map(skills.map((s) => [s.name, s]));
  const findings: Finding[] = [];
  const notMounted: CommandReport["notMounted"] = [];
  for (const s of skills) {
    const file = join(COMMANDS_DIR, `${s.name}.md`);
    const abs = join(repo, file);
    if (!existsSync(abs)) findings.push({ kind: "missing", name: s.name, file });
    else {
      const text = readFileSync(abs, "utf8");
      if (isGenerated(text) && text !== commandText(s, repo)) findings.push({ kind: "stale", name: s.name, file });
    }
  }
  for (const f of present) {
    const name = f.slice(0, -3);
    if (declared.has(name)) continue;
    const file = join(COMMANDS_DIR, f);
    const text = readFileSync(join(repo, file), "utf8");
    const leftOut = skillLeftOutByMount(repo, text);
    if (leftOut !== undefined) {
      notMounted.push({ name, file, skill: leftOut });
      continue;
    }
    findings.push({ kind: isGenerated(text) ? "orphaned" : "undeclared", name, file });
  }
  return { declared: skills.length, findings, duplicates, notMounted };
}

/** Write what is missing or stale and remove this generator's orphans. Returns the files changed. Never writes inside a mounted layer (bean `bx4c`). */
export function write(repo: string = REPO_ROOT, packages: Record<string, string> = packagesFor(repo)): string[] {
  if (isMountedInstance(repo)) return [];
  const { skills } = userInvocableSkills(packages);
  const byName = new Map(skills.map((s) => [s.name, s]));
  const changed: string[] = [];
  for (const f of reconcile(repo, packages).findings) {
    const abs = join(repo, f.file);
    if (f.kind === "missing" || f.kind === "stale") {
      mkdirSync(join(repo, COMMANDS_DIR), { recursive: true });
      writeFileSync(abs, commandText(byName.get(f.name)!, repo));
      changed.push(f.file);
    } else if (f.kind === "orphaned") {
      rmSync(abs);
      changed.push(f.file);
    }
  }
  return changed;
}

export interface SkillCommandsRunResult {
  ok: boolean;
  totalBad: number;
  mountedBad: number;
  lines: string[];
  mountedFindings: string[];
}

export function runSkillCommands(
  opts: { baseRoot?: string; explicitDir?: string; check?: boolean } = {},
): SkillCommandsRunResult {
  const check = opts.check ?? false;
  const explicitDir = opts.explicitDir ? resolve(opts.explicitDir) : undefined;
  const cwd = process.cwd();
  const cwdRoot = existsSync(join(cwd, "index.config.json")) ? resolve(cwd) : checkoutRootFor(cwd);
  const baseRoot = opts.baseRoot
    ? resolve(opts.baseRoot)
    : findDeclarationFile(cwdRoot) !== undefined || existsSync(join(cwdRoot, "index.config.json"))
      ? cwdRoot
      : REPO_ROOT;
  const targets =
    explicitDir !== undefined
      ? [explicitDir]
      : [
          baseRoot,
          ...layerRootsIn(baseRoot).filter(
            (r) => resolve(r) !== resolve(baseRoot) && existsSync(join(r, COMMANDS_DIR)),
          ),
        ];
  let totalBad = 0;
  let mountedBad = 0;
  const lines: string[] = [];
  const mountedFindings: string[] = [];
  for (const repo of targets) {
    const mounted = isMountedInstance(repo, baseRoot);
    const layerName = readDeclaration(repo)?.name ?? (relative(baseRoot, repo) || basename(repo));
    const prefix = mounted
      ? `${layerName}: `
      : targets.length > 1
        ? `${relative(baseRoot, repo) || "."}: `
        : "";
    if (!check && !mounted) {
      const changed = write(repo);
      lines.push(
        changed.length ? changed.map((f) => `  wrote ${prefix}${f}`).join("\n") : `  ${prefix}nothing to write`,
      );
    }
    const r = reconcile(repo);
    for (const d of r.duplicates) {
      const msg = mounted
        ? `✗ ${prefix}${d.name} is declared by ${d.paths.length} files in mounted layer ${layerName} (committed surface not rewritten): ${d.paths.map((p) => relative(repo, p)).join(", ")}`
        : `✗ ${prefix}${d.name} is declared by ${d.paths.length} files: ${d.paths.map((p) => relative(repo, p)).join(", ")}`;
      lines.push(msg);
      if (mounted) mountedFindings.push(msg);
    }
    for (const f of r.findings) {
      const why = mounted
        ? {
            missing: `declares user_invocable and has no committed command in mounted layer ${layerName} (not rewritten — regenerate in ${layerName})`,
            stale: `committed command is stale in mounted layer ${layerName} (not rewritten — regenerate in ${layerName})`,
            orphaned: `committed command whose skill no longer declares user_invocable in mounted layer ${layerName} (not rewritten — regenerate in ${layerName})`,
            undeclared: `hand-written command with no user_invocable skill of that name in mounted layer ${layerName} (not rewritten)`,
          }[f.kind]
        : {
            missing: "declares user_invocable and has no command — run `bun run cat skill:commands`",
            stale: "generated command is stale — run `bun run cat skill:commands`",
            orphaned: "generated command whose skill no longer declares user_invocable — run `bun run cat skill:commands`",
            undeclared: "hand-written command with no user_invocable skill of that name — give the skill `name:` and `user_invocable: true`, or remove the command (a person's call)",
          }[f.kind];
      const msg = `✗ ${prefix}${f.file}: ${why}`;
      lines.push(msg);
      if (mounted) mountedFindings.push(msg);
    }
    if (r.notMounted.length > 0) {
      lines.push(
        `· ${prefix}${r.notMounted.length} command(s) point at skills in directories this mount leaves out (${[...new Set(r.notMounted.map((n) => n.skill.split("/")[0]))].join(", ")}) — not checked, not removed`,
      );
    }
    const bad = r.findings.length + r.duplicates.length;
    totalBad += bad;
    if (mounted) mountedBad += bad;
    if (bad === 0) {
      lines.push(`✓ ${prefix}${r.declared} user_invocable skill(s), each with a command; every command has a declared skill`);
    }
  }
  const ok = check ? totalBad === 0 : mountedBad === 0;
  return { ok, totalBad, mountedBad, lines, mountedFindings };
}

if (import.meta.main) {
  const dirIdx = process.argv.indexOf("--dir");
  const explicitDir = dirIdx >= 0 && process.argv[dirIdx + 1] ? resolve(process.argv[dirIdx + 1]!) : undefined;
  const check = process.argv.includes("--check");
  const r = runSkillCommands({ explicitDir, check });
  for (const line of r.lines) console.log(line);
  if (r.mountedFindings.length > 0) {
    for (const f of r.mountedFindings) console.error(f);
  }
  process.exit(r.ok ? 0 : 1);
}
