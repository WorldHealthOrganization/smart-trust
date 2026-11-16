#!/usr/bin/env bun
/**
 * Install the harness's skills into an agent host, each under its harness's
 * prefix.
 *
 * @module cat-harness-tools/scripts/install-skills
 *
 * ```sh
 * bun run cat-harness-tools/scripts/install-skills.ts [--root <dir>] [--host claude|antigravity|gemini|cursor|copilot] [--into <dir>] [--check]
 * ```
 *
 * ## Prefixes
 *
 * - **At install, not at rest.** Nothing in any repository is renamed: skill
 *   files, manifests, BPMN `folio:skill` refs and cross-references keep the
 *   bare name. Only the installed copy carries the prefix.
 * - **Per harness.** Each layer may declare `skillPrefix` (cat-harness
 *   declares `cat`). A skill takes the prefix of the layer that OWNS it; a
 *   layer that declares none takes the prefix of the layer at `--root`,
 *   the harness it is installed from. With no prefix anywhere, the install is
 *   refused rather than writing bare names into a host's namespace.
 *
 * ## What is installed
 *
 * The union across the dependency tree: every skill directory
 * `resolveSkillDirs(root)` returns (dependencies first, the root last, so the
 * root wins a name collision; the loser is reported). Within them, every `.md`
 * that `isSkillMd` accepts and that has a `description` in its front matter (a
 * host triggers a skill by its description); the rest are listed as skipped.
 *
 * Each skill becomes `<host dir>/<prefix>-<name>/SKILL.md`: the source front
 * matter with `name` replaced by the prefixed name, a provenance line, and the
 * body unchanged. Every host here reads that layout natively, as an Agent
 * Skill with a required `name` and `description`:
 *
 * | host | directory | source |
 * |---|---|---|
 * | Claude Code | `.claude/skills/` | Claude Code docs |
 * | Antigravity | `.agents/skills/` | Antigravity docs |
 * | Gemini CLI | `.gemini/skills/` | https://geminicli.com/docs/cli/skills/ |
 * | Cursor | `.cursor/skills/` | https://cursor.com/docs/skills |
 * | Copilot | `.github/skills/` | https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/create-skills |
 *
 * `.agents/skills/` is also read by Gemini CLI (an alias that takes precedence
 * over `.gemini/skills/`), Cursor and Copilot, so `--host antigravity` alone
 * reaches all four of those; the per-host directories are for a checkout that
 * wants one host's tree only.
 *
 * Cursor requires `name` to be lowercase letters, digits and hyphens, and to
 * match the folder; a name that breaks it is skipped with the reason.
 *
 * ## Process checklists, installed as skills
 *
 * Each diagram's committed checklist (`bpmn-checklist.ts`) is installed as one
 * skill per host. Each `<stem>.checklist.md` found beside a diagram, or in a
 * layer's `assets/workflows/checklists/`, becomes
 * `<prefix>-process-<stem>`: a generated front matter (the description names
 * the process and how to walk it) over the checklist body, unchanged, with the
 * prefix of the layer that holds it. It is read as committed
 * (`bpmn:checklist:check` keeps it current), never regenerated here. An agent
 * with the MCP server uses `bpmn-engine`, which refuses a wrong turn; one
 * without walks the checklist.
 *
 * ## Owned output only
 *
 * Every installed `SKILL.md` carries {@link INSTALLED_MARKER}. A re-run
 * removes installed directories whose skill is gone, and touches nothing
 * without the marker. `--check` writes nothing and exits 1 when the host
 * directory differs from what an install would write, or holds any file
 * without {@link INSTALLED_MARKER} ({@link unmarkedFiles}).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

import { findInstanceRoot, readDeclaration, siteDirFor } from "../schemas/kg/cat-harness.ts";
import { orderedDependencies, resolveSkillDirs } from "../schemas/kg/harness-config.ts";
import { isSkillMd, workflowDirs } from "./known-skills.ts";

/** Where each host loads project skills from, relative to the project root. */
export const HOSTS = {
  claude: ".claude/skills",
  antigravity: ".agents/skills",
  gemini: ".gemini/skills",
  cursor: ".cursor/skills",
  copilot: ".github/skills",
} as const;

/** An Agent Skill name every host accepts: Cursor's rule, the strictest of the five. */
export const SKILL_NAME = /^[a-z0-9-]+$/;
export type Host = keyof typeof HOSTS;

/** The line that marks a `SKILL.md` as this script's output, and so its to replace or remove. */
export const INSTALLED_MARKER = "<!-- installed by cat-harness-tools/scripts/install-skills.ts; edit the source, not this copy -->";

export interface SourceSkill {
  /** The bare name: front-matter `name`, or the file's basename. */
  name: string;
  /** Absolute path of the source `.md`. */
  file: string;
  /** The layer that owns it. */
  instance: string;
  /** That layer's declared prefix, if any. */
  prefix?: string;
  /** Why it cannot be installed, when it cannot. */
  skip?: string;
  /** The source text, when it is not the file as it stands (a checklist gets a generated front matter). */
  text?: string;
}

const FRONT_MATTER = /^---\n([\s\S]*?)\n---\n?/;

/**
 * A layer's declared `skillPrefix`. Read through a narrow view rather
 * than the declaration type, so this compiles against a cat-harness that
 * predates the field (cat-harness#160) and simply finds none there.
 */
export function declaredPrefix(instanceRoot: string): string | undefined {
  return (readDeclaration(instanceRoot) as { skillPrefix?: string } | undefined)?.skillPrefix;
}

function walkMd(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkMd(p, out);
    else if (e.isFile() && e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

/** One `.md` read as a skill: its name, its owner, and whether a host could use it. */
export function readSourceSkill(file: string): SourceSkill | undefined {
  if (!isSkillMd(file)) return undefined;
  const instance = findInstanceRoot(file) ?? "";
  const text = readFileSync(file, "utf-8");
  const fm = FRONT_MATTER.exec(text)?.[1] ?? "";
  const name = /^name:\s*["']?([^"'\n]+?)["']?\s*$/m.exec(fm)?.[1] ?? basename(file, ".md");
  const prefix = instance ? declaredPrefix(instance) : undefined;
  const skip = fm === "" ? "no front matter" : /^description:/m.test(fm) ? undefined : "no description: a host could never trigger it";
  return { name, file, instance, ...(prefix ? { prefix } : {}), ...(skip ? { skip } : {}) };
}

/** The suffix `bpmn-checklist.ts` writes, and the first line it starts with. */
const CHECKLIST_SUFFIX = ".checklist.md";
const GENERATED_FROM = /^<!-- GENERATED from (\S+) by /;

/**
 * A committed checklist read as a skill: `process-<stem>`, with a front matter
 * whose description names the process, its diagram and how to walk it. A file
 * that is not `bpmn-checklist.ts` output is not a checklist, and is ignored.
 */
export function readChecklistSkill(file: string): SourceSkill | undefined {
  if (!file.endsWith(CHECKLIST_SUFFIX)) return undefined;
  const body = readFileSync(file, "utf-8");
  const lines = body.split("\n");
  const source = GENERATED_FROM.exec(lines[0] ?? "")?.[1];
  if (!source) return undefined;
  const title = /^# Checklist — (.+)$/m.exec(body)?.[1]?.trim() ?? basename(file, CHECKLIST_SUFFIX);
  // The diagram's own first sentence, when it has one: the line after the
  // "Generated, and not the authority" note and before the first step.
  const firstStep = lines.findIndex((l) => l.startsWith("## "));
  const purpose = lines.slice(0, firstStep < 0 ? lines.length : firstStep).find((l) => l.trim() !== "" && !/^(<!--|#|>)/.test(l));
  const description =
    `Walk the "${title}" process (${source}) one step at a time: follow each step's next: line, not the page order, ` +
    `and record each step with the workflow call it names.${purpose ? ` ${purpose.trim()}` : ""}`;
  const name = `process-${basename(file, CHECKLIST_SUFFIX)}`;
  const instance = findInstanceRoot(file) ?? "";
  const prefix = instance ? declaredPrefix(instance) : undefined;
  // JSON string syntax is valid YAML double-quoted, so any title or sentence survives.
  const text = `---\nname: ${name}\ndescription: ${JSON.stringify(description)}\n---\n${body}`;
  return { name, file, instance, ...(prefix ? { prefix } : {}), text };
}

/**
 * Every committed checklist in the layers the harness at `root` stands on:
 * beside each diagram in a declared workflow directory, and in each layer's
 * `assets/workflows/checklists/`, where the harness keeps those of the
 * layers below it. Dependencies first, the root last, as for skills.
 */
export function collectChecklists(root: string): SourceSkill[] {
  const instances: string[] = [];
  const add = (r: string | undefined): void => {
    if (r && !instances.includes(resolve(r))) instances.push(resolve(r));
  };
  for (const dep of orderedDependencies(root)) add(dep.rootPath);
  for (const d of resolveSkillDirs(root)) add(findInstanceRoot(d));
  add(root);
  const files = new Set<string>();
  for (const inst of instances) {
    const dirs = [...workflowDirs(inst), join(inst, siteDirFor(inst), "assets", "workflows", "checklists")];
    for (const d of dirs) if (existsSync(d)) for (const f of walkMd(d)) if (f.endsWith(CHECKLIST_SUFFIX)) files.add(f);
  }
  return [...files].map(readChecklistSkill).filter((s): s is SourceSkill => s !== undefined);
}

/** Every skill the harness at `root` would install, in overlay order (root last), then its process checklists. */
export function collectSkills(root: string): SourceSkill[] {
  return [
    ...resolveSkillDirs(root).flatMap((d) => walkMd(d).sort().map(readSourceSkill).filter((s): s is SourceSkill => s !== undefined)),
    ...collectChecklists(root),
  ];
}

/** The installed copy: the prefixed name in the front matter, a provenance line, the body unchanged. */
export function renderInstalled(text: string, installedName: string, provenance: string): string {
  const m = FRONT_MATTER.exec(text);
  if (!m) throw new Error("a skill without front matter cannot be installed");
  const fm = /^name:.*$/m.test(m[1]!) ? m[1]!.replace(/^name:.*$/m, `name: ${installedName}`) : `name: ${installedName}\n${m[1]}`;
  return `---\n${fm}\n---\n${INSTALLED_MARKER}\n<!-- source: ${provenance} -->\n${text.slice(m[0].length)}`;
}

export interface InstallPlan {
  /** Installed directory name → the `SKILL.md` it holds. */
  files: Map<string, string>;
  skipped: { file: string; reason: string }[];
  /** Installed names claimed twice; the later (closer to the root) source won. */
  collisions: { name: string; lost: string; won: string }[];
}

/** What an install from `root` writes: pure apart from reading the sources. */
export function planInstall(root: string, skills: readonly SourceSkill[] = collectSkills(root)): InstallPlan {
  const rootPrefix = declaredPrefix(root);
  const files = new Map<string, string>();
  const from = new Map<string, string>();
  const skipped: InstallPlan["skipped"] = [];
  const collisions: InstallPlan["collisions"] = [];
  for (const s of skills) {
    const rel = relative(root, s.file);
    if (s.skip) {
      skipped.push({ file: rel, reason: s.skip });
      continue;
    }
    const prefix = s.prefix ?? rootPrefix;
    if (!prefix) {
      skipped.push({ file: rel, reason: "neither its instance nor the installing harness declares skillPrefix" });
      continue;
    }
    const installed = `${prefix}-${s.name}`;
    if (!SKILL_NAME.test(installed)) {
      skipped.push({ file: rel, reason: `"${installed}" is not lowercase letters, digits and hyphens, which Cursor requires` });
      continue;
    }
    if (from.has(installed)) collisions.push({ name: installed, lost: from.get(installed)!, won: rel });
    from.set(installed, rel);
    files.set(installed, renderInstalled(s.text ?? readFileSync(s.file, "utf-8"), installed, rel));
  }
  return { files, skipped, collisions };
}

/** Installed directories under `hostDir` that carry the marker: the only ones this script may remove. */
export function ownedInstalls(hostDir: string): string[] {
  if (!existsSync(hostDir)) return [];
  return readdirSync(hostDir).filter((d) => {
    const f = join(hostDir, d, "SKILL.md");
    return existsSync(f) && statSync(f).isFile() && readFileSync(f, "utf-8").includes(INSTALLED_MARKER);
  });
}

/**
 * Every file under `hostDir` (relative to `hostDir`, `/`-separated, sorted)
 * that does not carry {@link INSTALLED_MARKER}.
 *
 * {@link ownedInstalls} skips unmarked files when installing so a re-run
 * never deletes someone else's work on disk; `--check` calls this function
 * so any hand-written file in a host skill directory fails the gate (bean
 * `folio-assistant-dtda`).
 */
export function unmarkedFiles(hostDir: string): string[] {
  if (!existsSync(hostDir)) return [];
  const out: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) walk(p, rel);
      else if (e.isFile() && !readFileSync(p, "utf-8").includes(INSTALLED_MARKER)) out.push(rel);
    }
  };
  walk(hostDir, "");
  return out.sort();
}

export function main(argv: string[]): number {
  const flag = (f: string) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : undefined);
  const root = resolve(flag("--root") ?? process.cwd());
  const host = (flag("--host") ?? "claude") as Host;
  if (!(host in HOSTS)) {
    console.error(`install-skills: unknown host "${host}" (known: ${Object.keys(HOSTS).join(", ")})`);
    return 2;
  }
  const hostDir = join(resolve(flag("--into") ?? root), HOSTS[host]);
  const check = argv.includes("--check");

  if (!declaredPrefix(root) && collectSkills(root).every((s) => !s.prefix)) {
    console.error(`install-skills: no instance under ${root} declares skillPrefix, so there is no namespace to install into`);
    return 2;
  }
  const plan = planInstall(root);
  const stale = ownedInstalls(hostDir).filter((d) => !plan.files.has(d));
  const changed = [...plan.files].filter(([d, text]) => {
    const f = join(hostDir, d, "SKILL.md");
    return !existsSync(f) || readFileSync(f, "utf-8") !== text;
  });

  for (const c of plan.collisions) console.warn(`  ! ${c.name}: ${c.won} replaces ${c.lost}`);
  if (check) {
    const unmarked = unmarkedFiles(hostDir);
    for (const [d] of changed) console.error(`  ✗ ${relative(root, join(hostDir, d))} is stale or missing`);
    for (const d of stale) console.error(`  ✗ ${relative(root, join(hostDir, d))} is no longer a skill`);
    for (const f of unmarked) console.error(`  ✗ ${relative(root, join(hostDir, f))} lacks INSTALLED_MARKER`);
    console.log(
      `install-skills --check: ${plan.files.size} skill(s), ${changed.length + stale.length} out of date, ${unmarked.length} unmarked, ${plan.skipped.length} skipped`,
    );
    return changed.length + stale.length + unmarked.length > 0 ? 1 : 0;
  }
  for (const [d, text] of changed) {
    mkdirSync(join(hostDir, d), { recursive: true });
    writeFileSync(join(hostDir, d, "SKILL.md"), text);
  }
  for (const d of stale) rmSync(join(hostDir, d), { recursive: true });
  for (const s of plan.skipped) console.log(`  · skipped ${s.file}: ${s.reason}`);
  console.log(
    `install-skills: ${plan.files.size} skill(s) in ${relative(process.cwd(), hostDir) || "."} ` +
      `(${changed.length} written, ${stale.length} removed, ${plan.skipped.length} skipped, ${plan.collisions.length} collision(s))`,
  );
  return 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
