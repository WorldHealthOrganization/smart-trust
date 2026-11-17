/**
 * `skill_update`: a skill edit goes through a governed Tool, not a raw file write.
 *
 * @module src/tools/skill-update
 *
 * litlfred/folio-assistant#875. Until this module the only governed skill Tools
 * were reads (`skill_fetch`, `skill_list`), so an agent that read a skill
 * through the knowledge graph wrote it back with a raw `Edit`. A skill tells
 * every later agent what to do, which makes it the highest-stakes write in the
 * harness, and it was the one with the least ceremony.
 *
 * The spec is the spec-kit comment on #875, Adjudicated by the owner on
 * 2026-10-29 with four answers this module follows:
 *
 * 1. **A write edits the working tree.** The agent commits it through its
 *    normal flow, so review stays where it already is.
 * 2. **Only Roles the owner grants may write.** The permission is
 *    `skill-update`. No default policy grants it, so `unknown` refuses.
 * 3. **A gate that cannot decide refuses.** This is stricter than
 *    `workflow/preflight.ts`, where `could-not-determine` starts the instance:
 *    a skill instructs every later agent, so "could not check" does not pass.
 * 4. **A skill from another layer is refused**, and the result names where it
 *    lives. A mounted copy is untracked here and the next re-pin overwrites it.
 *
 * ## The gates, and why every one runs
 *
 * Every gate is evaluated and reported, even after one refuses. A caller
 * fixing a refusal should see all of them at once, not one per round trip.
 * The file is written only when every gate is `satisfied`.
 *
 * ## What it does not do
 *
 * - It does not create, rename or delete a skill (spec, Assumption 1).
 * - It does not write any other knowledge-graph node (#875, "Not proposed").
 * - It does not persist a PROV-O activity itself. It RETURNS the activity for
 *   an accepted write when the call names its process, task and role, because
 *   `ProvActivitySchema` requires a plan and a role and an invented one is
 *   fabrication (`workflow/prov-record.ts`). The agent hands it to
 *   `workflow_complete` (`activities`) for that step, and the engine keeps it
 *   on the step's history entry (FR-005; owner 2026-10-30, option A). A
 *   refused write gets no activity, as in the engine: it did not happen.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

import { decide } from "../../schemas/content/odrl.js";
import { ProvActivitySchema, type ProvActivity } from "../../schemas/content/prov.js";
import { accessContext, principalFromEnv, type AccessContext } from "../core/access.js";
import { auditLinks, classify, parseLinks } from "../core/markdown-links.js";
import { planStem } from "../workflow/prov-record.js";
import { LOCAL_PACKAGES, REFERENCE_PACKAGES, locateLocalSkill } from "./skill-fetch.js";

/** The folio-profile action a skill write asks for (`skills/permissions/permissions.json`). */
export const SKILL_UPDATE = "skill-update" as const;

export type GateVerdict = "satisfied" | "unsatisfied" | "could-not-determine";

export interface GateResult {
  gate: GateName;
  verdict: GateVerdict;
  reason: string;
}

export const GATES = ["resolve", "layer", "generated", "permission", "base-hash", "front-matter", "references"] as const;
export type GateName = (typeof GATES)[number];

export interface SkillUpdateRequest {
  skill: string;
  packageName: string;
  /** The whole new file: front matter and body. */
  newContent: string;
  /** SHA-256 (hex) of the file as the caller read it. A mismatch refuses: no merge is attempted. */
  baseSha256: string;
  /** Why the skill changes. Kept in the result, and in the activity when one is built. */
  reason: string;
  /** The declared actor making the write. */
  actor?: string;
  /** The BPMN step the write is part of, for the PROV-O activity. All three, or none. */
  process?: string;
  task?: string;
  role?: string;
}

export interface SkillUpdateResult {
  written: boolean;
  /** Repo-relative path of the skill file, when it resolved. */
  file?: string;
  gates: GateResult[];
  /** SHA-256 of the file now on disk: the new content when written, the untouched file when not. */
  sha256?: string;
  /** Lines added and removed, counted as a multiset of lines. A summary, not a patch. */
  diff?: { added: number; removed: number };
  /** Things the caller should know that did not refuse the write. */
  findings: string[];
  activity?: ProvActivity;
}

export interface SkillUpdateDeps {
  packages?: Record<string, string>;
  referencePackages?: Record<string, unknown>;
  access?: AccessContext;
  env?: Readonly<Record<string, string | undefined>>;
  /** The repository the caller works in. A skill outside it is another layer's. */
  workRoot?: string;
  now?: () => Date;
}

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function git(cwd: string, args: string[]): string | undefined {
  try {
    return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return undefined;
  }
}

/** The repository's `origin` URL, for naming where another layer's skill lives. */
function originOf(dir: string): string | undefined {
  return git(dir, ["config", "--get", "remote.origin.url"]) || undefined;
}

/** Is `file` tracked in the same repository as `workRoot`? Three answers, never two. */
export function layerVerdict(file: string, workRoot: string): GateResult {
  const fileTop = git(dirname(file), ["rev-parse", "--show-toplevel"]);
  const workTop = git(workRoot, ["rev-parse", "--show-toplevel"]);
  if (fileTop === undefined || workTop === undefined) {
    return { gate: "layer", verdict: "could-not-determine", reason: "git could not say which repository holds the skill" };
  }
  if (fileTop !== workTop) {
    const origin = originOf(fileTop);
    return {
      gate: "layer",
      verdict: "unsatisfied",
      reason: `the skill belongs to another repository (${origin ?? fileTop}); edit it there`,
    };
  }
  if (git(fileTop, ["ls-files", "--error-unmatch", "--", relative(fileTop, file)]) === undefined) {
    return {
      gate: "layer",
      verdict: "unsatisfied",
      reason: "the skill file is not tracked here, so it is a mounted or generated copy; edit it in the repository that owns it",
    };
  }
  return { gate: "layer", verdict: "satisfied", reason: "tracked in the working repository" };
}

/** Split off a front-matter block. `undefined` block means the file has none. */
function frontBlock(text: string): { block?: string; unterminated: boolean } {
  if (!text.startsWith("---")) return { unterminated: false };
  const end = text.indexOf("\n---", 3);
  if (end === -1) return { unterminated: true };
  return { block: text.slice(3, end), unterminated: false };
}

function readFront(text: string): { data?: Record<string, unknown>; error?: string } {
  const { block, unterminated } = frontBlock(text);
  if (unterminated) return { error: "the front matter opens with --- and never closes" };
  if (block === undefined) return {};
  try {
    const data = parseYaml(block) as unknown;
    if (data !== null && data !== undefined && (typeof data !== "object" || Array.isArray(data))) {
      return { error: "the front matter is not a mapping" };
    }
    return { data: (data ?? {}) as Record<string, unknown> };
  } catch (e) {
    return { error: `the front matter does not parse: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}` };
  }
}

export function frontMatterVerdict(current: string, next: string): GateResult {
  const now = readFront(next);
  if (now.error) return { gate: "front-matter", verdict: "unsatisfied", reason: now.error };
  const before = readFront(current);
  const was = typeof before.data?.name === "string" ? (before.data.name as string) : undefined;
  const is = typeof now.data?.name === "string" ? (now.data.name as string) : undefined;
  if (was !== undefined && is !== was) {
    return {
      gate: "front-matter",
      verdict: "unsatisfied",
      reason: `the skill's name is its identity and does not change in an update (was "${was}", now ${is === undefined ? "absent" : `"${is}"`})`,
    };
  }
  return { gate: "front-matter", verdict: "satisfied", reason: now.data ? "parses, name unchanged" : "no front matter, as before" };
}

/**
 * The references the NEW content adds must resolve.
 *
 * Only the links this edit introduces are judged. A link already in the file
 * is reported as a finding when dead, not refused: refusing it would block
 * every unrelated edit of a skill until somebody fixed an old link. A new link
 * that cannot be checked (an external URL is never fetched) is
 * `could-not-determine`, which refuses, by the owner's answer 3.
 */
export function referencesVerdict(
  file: string,
  repoRoot: string,
  current: string,
  next: string,
): { gate: GateResult; findings: string[] } {
  const before = new Set(parseLinks(current).map((l) => l.target));
  const added = parseLinks(next).filter((l) => !before.has(l.target));
  const findings: string[] = [];
  const opts = { publishRef: "HEAD", base: dirname(file) };
  const old = auditLinks(repoRoot, current, opts);
  for (const d of old.dead) findings.push(`an existing link is dead (left as it was): line ${d.line} ${d.target}: ${d.reason}`);
  if (added.length === 0) return { gate: { gate: "references", verdict: "satisfied", reason: "the edit adds no link" }, findings };

  const audit = auditLinks(repoRoot, next, opts);
  const addedTargets = new Set(added.map((l) => l.target));
  const dead = audit.dead.filter((d) => addedTargets.has(d.target));
  if (dead.length > 0) {
    return {
      gate: {
        gate: "references",
        verdict: "unsatisfied",
        reason: `${dead.length} added link(s) do not resolve: ${dead.map((d) => `${d.target} (${d.reason})`).join("; ")}`,
      },
      findings,
    };
  }
  // An external URL is never fetched, so a new one was not looked at.
  // Anchors and mailto-style links name nothing to resolve.
  const unchecked = added.filter((l) => {
    const c = classify(l.target, opts);
    return c.kind === "unchecked" && /^https?:/i.test(l.target);
  });
  if (unchecked.length > 0) {
    return {
      gate: {
        gate: "references",
        verdict: "could-not-determine",
        reason: `${unchecked.length} added external link(s) could not be checked from here: ${unchecked.map((l) => l.target).join(", ")}`,
      },
      findings,
    };
  }
  return { gate: { gate: "references", verdict: "satisfied", reason: `${added.length} added link(s) resolve` }, findings };
}

function lineDiff(a: string, b: string): { added: number; removed: number } {
  const count = (s: string) => {
    const m = new Map<string, number>();
    for (const l of s.split("\n")) m.set(l, (m.get(l) ?? 0) + 1);
    return m;
  };
  const ma = count(a);
  const mb = count(b);
  let added = 0;
  let removed = 0;
  for (const [l, n] of mb) added += Math.max(0, n - (ma.get(l) ?? 0));
  for (const [l, n] of ma) removed += Math.max(0, n - (mb.get(l) ?? 0));
  return { added, removed };
}

/** Run every gate, and write only when all are satisfied. */
export function skillUpdate(req: SkillUpdateRequest, deps: SkillUpdateDeps = {}): SkillUpdateResult {
  const packages = deps.packages ?? LOCAL_PACKAGES;
  const references = deps.referencePackages ?? REFERENCE_PACKAGES;
  const workRoot = deps.workRoot ?? process.cwd();
  const gates: GateResult[] = [];
  const findings: string[] = [];

  // resolve: the same resolver skill_fetch uses, so both name one file.
  if (references[req.packageName] && !packages[req.packageName]) {
    gates.push({ gate: "resolve", verdict: "unsatisfied", reason: `'${req.packageName}' is a pinned external reference package; it is not edited here` });
    return { written: false, gates, findings };
  }
  const found = locateLocalSkill(req.skill, req.packageName, packages);
  if ("error" in found) {
    gates.push({ gate: "resolve", verdict: "unsatisfied", reason: found.error });
    return { written: false, gates, findings };
  }
  const file = join(found.dir, `${req.skill}.md`);
  if (!existsSync(file)) {
    gates.push({ gate: "resolve", verdict: "unsatisfied", reason: `no file at ${file}; creating a skill is out of scope` });
    return { written: false, gates, findings };
  }
  if (found.package !== req.packageName) findings.push(`'${req.packageName}' does not hold it; resolved in '${found.package}'`);
  gates.push({ gate: "resolve", verdict: "satisfied", reason: `${found.package}/${req.skill}` });

  const repoRoot = git(dirname(file), ["rev-parse", "--show-toplevel"]) ?? workRoot;
  const rel = relative(repoRoot, file).split(sep).join("/");
  const current = readFileSync(file, "utf8");
  const currentSha = sha256(current);

  gates.push(layerVerdict(file, workRoot));

  const fm = readFront(current).data;
  gates.push(
    fm && "generated" in fm
      ? { gate: "generated", verdict: "unsatisfied", reason: `the file is generated (${String(fm.generated)}); change its generator instead` }
      : { gate: "generated", verdict: "satisfied", reason: "not marked generated" },
  );

  // permission: strict. Only `permit` writes; `unknown` is nobody having granted it.
  const ctx = deps.access ?? accessContext();
  const principal = principalFromEnv(req.actor, deps.env ?? process.env);
  if (!principal.actor) {
    gates.push({ gate: "permission", verdict: "unsatisfied", reason: "no actor named; a skill write needs an accountable, granted actor" });
  } else if (!ctx.actors.has(principal.actor)) {
    gates.push({ gate: "permission", verdict: "unsatisfied", reason: `"${principal.actor}" is not a declared actor` });
  } else {
    const scope = {
      target: rel,
      ...(req.process ? { "cat-harness:process": req.process } : {}),
      ...(req.task ? { "cat-harness:task": req.task } : {}),
      ...(req.role ? { "cat-harness:role": req.role } : {}),
    };
    const d = decide({ actor: principal.actor, action: SKILL_UPDATE, scope }, ctx.policies, ctx.graph);
    gates.push(
      d === "permit"
        ? { gate: "permission", verdict: "satisfied", reason: `a policy grants ${SKILL_UPDATE} to ${principal.actor}` }
        : d === "deny"
          ? { gate: "permission", verdict: "unsatisfied", reason: `a policy prohibits ${SKILL_UPDATE} for ${principal.actor} here` }
          : { gate: "permission", verdict: "unsatisfied", reason: `no policy grants ${SKILL_UPDATE} to ${principal.actor}; only Roles the owner grants may write skills` },
    );
    if (principal.authenticatedBy === "asserted") findings.push(`actor "${principal.actor}" is asserted, not authenticated`);
  }

  gates.push(
    req.baseSha256.toLowerCase() === currentSha
      ? { gate: "base-hash", verdict: "satisfied", reason: "the file is as the caller read it" }
      : { gate: "base-hash", verdict: "unsatisfied", reason: `the file changed since it was read (now ${currentSha}); read it again` },
  );

  gates.push(frontMatterVerdict(current, req.newContent));

  const refs = referencesVerdict(file, repoRoot, current, req.newContent);
  gates.push(refs.gate);
  findings.push(...refs.findings);

  const ok = gates.every((g) => g.verdict === "satisfied");
  if (!ok) return { written: false, file: rel, gates, sha256: currentSha, findings };

  writeFileSync(file, req.newContent);
  const newSha = sha256(req.newContent);
  const out: SkillUpdateResult = { written: true, file: rel, gates, sha256: newSha, diff: lineDiff(current, req.newContent), findings };

  if (req.process && req.task && req.role && principal.actor && ctx.policies.size > 0) {
    const at = (deps.now ?? (() => new Date()))().toISOString();
    const parsed = ProvActivitySchema.safeParse({
      "@type": "prov:Activity",
      "@id": `skill-update:${rel}@${newSha.slice(0, 12)}`,
      "prov:startedAtTime": at,
      "prov:qualifiedAssociation": {
        "prov:agent": principal.actor,
        "prov:hadRole": req.role,
        "prov:hadPlan": `${planStem(req.process)}#${req.task}`,
      },
      "prov:used": [`${rel}@sha256:${currentSha}`],
      "prov:generated": [`${rel}@sha256:${newSha}`],
      "cat-harness:underPolicy": [...ctx.policies.keys()].sort(),
    });
    if (parsed.success) out.activity = parsed.data;
    else findings.push(`no PROV-O activity: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
  } else {
    findings.push("no PROV-O activity: the call named no process, task and role, and none is invented");
  }
  return out;
}

/** The result as text: the verdicts first, because they are what a caller acts on. */
export function describeSkillUpdate(r: SkillUpdateResult, reason: string): string {
  const lines = [
    r.written ? `Written: ${r.file} (+${r.diff?.added ?? 0} −${r.diff?.removed ?? 0} lines). Commit it through your normal flow.` : `Not written${r.file ? `: ${r.file}` : ""}.`,
    `Reason given: ${reason}`,
    "",
    "Gates:",
    ...r.gates.map((g) => `- ${g.verdict === "satisfied" ? "✓" : g.verdict === "unsatisfied" ? "✗" : "?"} ${g.gate}: ${g.verdict} — ${g.reason}`),
  ];
  if (r.sha256) lines.push("", `sha256 on disk: ${r.sha256}`);
  if (r.findings.length > 0) lines.push("", "Findings:", ...r.findings.map((f) => `- ${f}`));
  if (r.activity) lines.push("", "PROV-O activity:", "```json", JSON.stringify(r.activity, null, 2), "```");
  return lines.join("\n");
}

export function registerSkillUpdateTools(server: McpServer, repoRoot: string = process.cwd()): void {
  server.tool(
    "skill_update",
    "Edit an existing local skill through a governed gate instead of a raw file write (folio-assistant#875). " +
      "Every gate must pass: the skill resolves as skill_fetch serves it, it is tracked in this repository (not another " +
      "layer's or a mounted copy), it is not generated, a policy grants `skill-update` to the actor, the file is unchanged " +
      "since it was read (base_sha256), the front matter parses and keeps its name, and every link the edit adds resolves. " +
      "A gate that cannot decide refuses. Writes the working tree only; commit it yourself.",
    {
      skill: z.string().describe("Skill id, as skill_fetch takes it."),
      package_name: z.string().default("folio-core").describe("Package, as skill_fetch takes it."),
      new_content: z.string().min(1).describe("The whole new file: front matter and body."),
      base_sha256: z.string().regex(/^[0-9a-fA-F]{64}$/).describe("SHA-256 hex of the file as you read it."),
      reason: z.string().min(1).max(400).describe("Why the skill changes, in one line."),
      actor: z.string().optional().describe("The declared actor making the write."),
      process: z.string().optional().describe("The BPMN process this write is a step of, for the PROV-O activity."),
      task: z.string().optional().describe("The task id in that process."),
      role: z.string().optional().describe("The role the lane binds."),
    },
    async (a) => {
      const r = skillUpdate(
        {
          skill: a.skill,
          packageName: a.package_name,
          newContent: a.new_content,
          baseSha256: a.base_sha256,
          reason: a.reason,
          actor: a.actor,
          process: a.process,
          task: a.task,
          role: a.role,
        },
        { workRoot: repoRoot },
      );
      return { content: [{ type: "text" as const, text: describeSkillUpdate(r, a.reason) }] };
    },
  );
}
