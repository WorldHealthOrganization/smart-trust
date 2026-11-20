import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { nodeSummary } from "../../scripts/front-matter.js";

// Session-level cache (lives for the lifetime of the MCP server process)
const skillCache = new Map<string, { content: string; fetchedAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Registry of known external skill packages (reference-only, not synced)
export const REFERENCE_PACKAGES: Record<string, { repo: string; ref: string; skills: Record<string, string> }> = {
  "academic-research-skills": {
    repo: "Imbad0202/academic-research-skills",
    ref: "5a1a5a687602c79c31b1ab8603ebcf8de65a9579",
    skills: {
      "academic-paper-reviewer": "academic-paper-reviewer/SKILL.md",
      "academic-paper-reviewer/quality-rubrics": "academic-paper-reviewer/references/quality_rubrics.md",
      "academic-paper-reviewer/review-criteria": "academic-paper-reviewer/references/review_criteria_framework.md",
      "academic-paper-reviewer/editorial-standards": "academic-paper-reviewer/references/editorial_decision_standards.md",
      "academic-paper-reviewer/devils-advocate": "academic-paper-reviewer/agents/devils_advocate_reviewer_agent.md",
      "academic-paper-reviewer/methodology-reviewer": "academic-paper-reviewer/agents/methodology_reviewer_agent.md",
      "academic-paper-reviewer/domain-reviewer": "academic-paper-reviewer/agents/domain_reviewer_agent.md",
      "academic-paper-reviewer/eic": "academic-paper-reviewer/agents/eic_agent.md",
      "academic-paper-reviewer/editorial-synthesizer": "academic-paper-reviewer/agents/editorial_synthesizer_agent.md",
      "deep-research": "deep-research/SKILL.md",
      "deep-research/source-verification": "deep-research/agents/source_verification_agent.md",
      "deep-research/devils-advocate": "deep-research/agents/devils_advocate_agent.md",
      "deep-research/evidence-hierarchy": "deep-research/references/source_quality_hierarchy.md",
      "deep-research/logical-fallacies": "deep-research/references/logical_fallacies.md",
      "academic-pipeline": "academic-pipeline/SKILL.md",
      "academic-pipeline/integrity-verification": "academic-pipeline/agents/integrity_verification_agent.md",
      "academic-pipeline/claim-verification": "academic-pipeline/references/claim_verification_protocol.md",
    },
  },
};

// Locally-served skill packages (no network fetch). Each maps a package name to
// the directory holding its `<skill>.md` instruction bodies. The skill lists are
// read from disk so they stay in sync with the files — no hardcoded names.
//   - folio-core             : the core agent skills, including `corpus-grep`,
//                              which sits beside the `.ts` implementing it
//   - content-lifecycle      : plan → author → validate → review → test →
//                              publish → feedback, the skills every BPMN
//                              content process names
//   - authoring-who-smart-guidelines : WHO SMART Guidelines L2/L3 — DAK
//                              components, FSH/SUSHI, validation, IG publication
//   - authoring-math         : the formal-math entry points (Lean, LaTeX) that
//                              route into folio-paper-adapter's depth
//   - folio-core             : content-agnostic platform bundle (skills/folio-core)
//   - folio-document-adapter : prose-folio bundle, no Lean and no required TeX
//   - folio-paper-adapter    : formal-math paper-adapter bundle (the sci layer's skills/content/folio-paper-adapter)
//
// `folio-document-adapter` and `folio-paper-adapter` are the two halves of one
// content model, not alternatives to pick between: a paper folio wants both,
// because a paper is a document whose blocks may additionally carry Lean. A
// document folio wants the first only — the paper bundle's skills assume a
// toolchain it does not have.
//
// `content-lifecycle` was MISSING from this table until 2026-09-18, and the
// consequence was not subtle: its eight skills — `content-author`,
// `content-validate`, `content-review`, `content-publish`, `content-plan`,
// `content-test`, `content-feedback`, `content-retire` — are named by **52**
// `<bootstrap.processes:skill ref>` activities across the twenty diagrams in
// `processes/`. So `workflow_next` handed an agent `content-validate`,
// the agent called `skill_fetch`, and got "package not found". Every step of
// every content-lifecycle process. `kg:audit`'s `skill-servable` criterion
// exists to keep that closed.
//
// EXPORTED because reachability is not a property of a manifest: a skill is
// reachable when something can SERVE it. `scripts/kg-audit.ts` reads this table
// rather than keeping its own copy, so a package added here cannot be reported
// as unreachable, and one removed here cannot pass.
export { discoverLocalPackages, LOCAL_PACKAGES } from "../../scripts/skill-packages.js";
import { LOCAL_PACKAGES } from "../../scripts/skill-packages.js";
import { inputSiteReached } from "../../schemas/sdlc/input-trace.ts";


/** A servable skill: its id, and what it says it is — when it says anything. */
export interface LocalSkill {
  id: string;
  /** `undefined` when the file declares no `description:` and has no heading. */
  summary?: string;
}

/**
 * List the skills available in a local package dir, each with its summary.
 *
 * **The summary is the whole point, and it was missing.** `AGENTS.md` tells a
 * cold agent to reach for `skill_list` because it gives "what skills exist
 * here, **with their one-line summaries**" — and until 2026-09-19 it gave 150
 * bare names and the `skill_fetch` call to retrieve each. An agent handed 150
 * undifferentiated identifiers cannot pick; it can only fetch at random or
 * fall back to opening files, which is the behaviour the tool exists to
 * replace. Bean `1hsf`.
 *
 * A missing summary stays `undefined` rather than becoming `""`. See
 * `nodeSummary` — a node that never declared itself must not read as one that
 * declared itself as nothing.
 */
function listLocalSkills(dir: string): LocalSkill[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const id = f.slice(0, -3);
      // A skill whose body cannot be read is listed WITHOUT a summary rather
      // than dropped: it is servable, `skill_fetch` will report the real error,
      // and silently shortening the list would hide a skill from the only
      // inventory an agent has.
      let summary: string | undefined;
      try {
        summary = nodeSummary(readFileSync(join(dir, f), "utf8"));
      } catch {
        summary = undefined;
      }
      return { id, summary };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}
/**
 * Where a local skill is, when the caller may have named the wrong package.
 *
 * Skills move between packages — bean `9umr` moves the knowledge-graph and
 * library skills out of `folio-core`, and `package_name` DEFAULTS to
 * `folio-core` — so an exact-package lookup would turn every such move into
 * "Unknown skill" for every caller written before it, downstream folios
 * included. So: the named package first; failing that, the ONE local package
 * that holds a skill of that id. Two or more is an error naming them all,
 * never a pick, because choosing one would serve a different skill with the
 * same name and say nothing.
 */
export function locateLocalSkill(
  skill: string,
  packageName: string,
  packages: Record<string, string> = LOCAL_PACKAGES,
): { package: string; dir: string } | { error: string } {
  const named = packages[packageName];
  if (named && listLocalSkills(named).some((s) => s.id === skill)) return { package: packageName, dir: named };
  const holders = Object.entries(packages).filter(
    ([name, dir]) => name !== packageName && listLocalSkills(dir).some((s) => s.id === skill),
  );
  if (holders.length === 1) return { package: holders[0][0], dir: holders[0][1] };
  if (holders.length > 1) {
    return {
      error: `Skill '${skill}' is not in '${packageName}' and is held by ${holders.length} packages: ` +
        `${holders.map(([n]) => n).join(", ")}. Pass one as package_name.`,
    };
  }
  const available = named ? listLocalSkills(named).map((s) => s.id) : [];
  return { error: `Unknown skill '${skill}' in package '${packageName}'. Available: ${available.join(", ")}` };
}

export function registerSkillFetchTools(server: McpServer): void {
  server.tool(
    "skill_fetch",
    "Fetch a skill's instruction body for the agent to follow. Serves the local " +
    "platform bundles (package_name 'folio-assistant' = agent skills, 'content-lifecycle' = " +
    "the plan/author/validate/review/test/publish/feedback skills every BPMN content " +
    "process names, 'folio-core' = " +
    "content-agnostic platform skills, 'folio-document-adapter' = prose-folio skills " +
    "(no Lean, no required TeX), 'folio-paper-adapter' = formal-math paper skills) " +
    "and external reference packages (Tier 2 escalation: academic-paper-reviewer, " +
    "deep-research, academic-pipeline).",
    {
      skill: z.string().describe(
        "Skill identifier. Examples: 'lean-generation' (package_name 'folio-paper-adapter'), " +
        "'bean-coordination' (package_name 'sdlc-core'), 'corpus-grep' (package_name 'kg-core'), " +
        "'content-validate' (package_name 'content-lifecycle'), " +
        "'l3-fhir-authoring' (package_name 'authoring-who-smart-guidelines'), " +
        "'academic-paper-reviewer' (package_name 'academic-research-skills')"
      ),
      // Listed from discovery rather than by hand: the hand-written list named
      // seven packages and missed every one a topic holds (bean 9umr), so an
      // agent reading the schema could not learn that `sdlc-core` exists.
      package_name: z.string().default("folio-core").describe(
        `Package name. Local: ${Object.keys(LOCAL_PACKAGES).sort().map((p) => `'${p}'`).join(" | ")}. ` +
        `Reference: ${Object.keys(REFERENCE_PACKAGES).sort().map((p) => `'${p}'`).join(" | ")}.`
      ),
    },
    async ({ skill, package_name }) => {
      if (LOCAL_PACKAGES[package_name] || !REFERENCE_PACKAGES[package_name]) {
        const found = locateLocalSkill(skill, package_name);
        // An unknown package whose skill is found nowhere falls through to the
        // "Unknown package" error below, which lists the packages there are.
        if ("error" in found) {
          if (LOCAL_PACKAGES[package_name]) {
            return { content: [{ type: "text" as const, text: `Error: ${found.error}` }] };
          }
        } else {
          const skillPath = join(found.dir, `${skill}.md`);
          if (!existsSync(skillPath)) {
            return {
              content: [{
                type: "text" as const,
                text: `Error: Skill file not found at ${skillPath}`,
              }],
            };
          }
          const content = readFileSync(skillPath, "utf-8");
          const moved = found.package === package_name
            ? ""
            : ` — asked for in '${package_name}', which does not hold it; pass package_name '${found.package}'`;
          return {
            content: [{
              type: "text" as const,
              text: `# ${skill} (served locally from ${found.package}${moved})\n\n${content}`,
            }],
          };
        }
      }

      const pkg = REFERENCE_PACKAGES[package_name];
      if (!pkg) {
        return {
          content: [{
            type: "text" as const,
            text: `Error: Unknown package '${package_name}'. Available: ${[...Object.keys(LOCAL_PACKAGES), ...Object.keys(REFERENCE_PACKAGES)].join(", ")}`,
          }],
        };
      }

      const skillPath = pkg.skills[skill];
      if (!skillPath) {
        return {
          content: [{
            type: "text" as const,
            text: `Error: Unknown skill '${skill}' in package '${package_name}'. Available skills:\n${Object.keys(pkg.skills).map(s => `  - ${s}`).join("\n")}`,
          }],
        };
      }

      // Check cache
      const cacheKey = `${package_name}/${skill}`;
      const cached = skillCache.get(cacheKey);
      // input-site: inert #7ee99e9b — an in-process cache's age: an entry exists only after a fetch this process made, which is traced
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return {
          content: [{
            type: "text" as const,
            text: `# ${skill} (cached)\n\n${cached.content}`,
          }],
        };
      }

      // Fetch from GitHub raw
      const url = `https://raw.githubusercontent.com/${pkg.repo}/${pkg.ref}/${skillPath}`;
      try {
        // input-site: traced #fddbba7a — a skill fetched from GitHub over the network: no fingerprint names it, so a run that reaches it records no hash
        inputSiteReached("skill-fetch: GitHub raw");
        const resp = await fetch(url);
        if (!resp.ok) {
          return {
            content: [{
              type: "text" as const,
              text: `Error: Failed to fetch ${url} — HTTP ${resp.status} ${resp.statusText}`,
            }],
          };
        }
        const content = await resp.text();
        // input-site: inert #8a8df08a — stamps a cache entry; a write, never a check's input
        skillCache.set(cacheKey, { content, fetchedAt: Date.now() });
        return {
          content: [{
            type: "text" as const,
            text: `# ${skill} (fetched from ${pkg.repo})\n\n${content}`,
          }],
        };
      } catch (err) {
        return {
          content: [{
            type: "text" as const,
            text: `Error: Network failure fetching ${url} — ${err instanceof Error ? err.message : String(err)}`,
          }],
        };
      }
    },
  );

  server.tool(
    "skill_list",
    "List available skills WITH their one-line summaries — the local platform bundles " +
    "(folio-assistant, content-lifecycle, folio-core, folio-document-adapter, " +
    "folio-paper-adapter, authoring-who-smart-guidelines, authoring-math) and external " +
    "reference packages — each fetchable via skill_fetch. Call this before improvising a " +
    "procedure: the summary is what lets you pick the right skill without fetching several.",
    {},
    async () => {
      const lines: string[] = ["# Available Skills\n"];

      for (const [pkgName, dir] of Object.entries(LOCAL_PACKAGES)) {
        const skills = listLocalSkills(dir);
        lines.push(`## ${pkgName} (local, ${skills.length} skills)\n`);
        for (const s of skills) {
          // The summary, not the fetch call. Every row previously ended in
          // `skill_fetch skill="x" package_name="y"` — the same template with
          // two substitutions, repeated 150 times, telling the reader nothing
          // they could not derive from the heading and the id. The invocation
          // is stated once below the list instead, and the row carries the one
          // fact only the file knows.
          lines.push(s.summary ? `- **${s.id}** — ${s.summary}` : `- **${s.id}** — _(no summary declared)_`);
        }
        lines.push("");
        lines.push(`Fetch any of these with \`skill_fetch skill="<id>" package_name="${pkgName}"\`.`);
        lines.push("");
      }

      for (const [pkgName, pkg] of Object.entries(REFERENCE_PACKAGES)) {
        lines.push(`## ${pkgName} (${pkg.repo})\n`);
        for (const [skillId, path] of Object.entries(pkg.skills)) {
          const cached = skillCache.get(`${pkgName}/${skillId}`);
          // input-site: inert #d299c1ba — labels a cached entry; an entry exists only after a fetch this process made, which is traced
          const status = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS ? " (cached)" : "";
          lines.push(`- **${skillId}**${status} — \`${path}\``);
        }
        lines.push("");
      }
      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    },
  );
}
