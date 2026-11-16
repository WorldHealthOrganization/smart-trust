/**
 * `auth_whoami` — the user authentication and authorization Tool (issue #1207).
 *
 * One call answers the three questions an agent, a script or a person has
 * before acting on the knowledge graph:
 *
 * 1. **Who am I?** GitHub is asked (`core/github-auth.ts`): the login, how it
 *    was established, and the role on the repository.
 * 2. **What does GitHub let me do?** That role, on the WHOLE repository, and
 *    the gateway actor it maps to.
 * 3. **What does policy let me do here?** The ODRL answer for an action, or
 *    the full task-authorization verdict for a BPMN step.
 *
 * It also says, every time, what GitHub cannot express: its role covers every
 * sub-graph, node and query path at once. Saying so in the answer, not only in
 * a skill, is the point: a reader who sees "write" should not infer "write, to
 * this chapter only".
 *
 * Agent-generic, like `stakeholder_map`: every folio has a repository and
 * callers, whatever its content type.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { decide, unscopedGrants, type RequestScope } from "../../schemas/content/odrl.js";
import { accessContext, type AccessContext, type Principal } from "../core/access.js";
import { GITHUB_ROLE_ACTOR, githubPrincipalFor, principalFromGithub, type GithubIdentity } from "../core/github-auth.js";
import type { AgentHost } from "../core/agent-host.js";
import { qualified, resolveIdentities, type Identity } from "../core/identity.js";
import { authorizeTask, describeVerdict } from "../workflow/authorize.js";

export interface WhoamiInput {
  /** A BPMN actor the caller says it is acting as. */
  actor?: string;
  /** An ODRL action to ask about, e.g. `content-authoring`. */
  action?: string;
  process?: string;
  task?: string;
  role?: string;
  target?: string;
}

/** What GitHub's grain means, in one paragraph the answer always carries. */
export function grainNote(id: GithubIdentity): string {
  const on = id.repo ? `\`${id.repo}\`` : "the repository";
  const role = id.role ? `\`${id.role}\`` : "its role";
  return (
    `GitHub grants ${role} on ${on} as a whole: every sub-graph, node and query path in it, ` +
    `or none of them. It cannot express "this chapter but not that one". Anything finer is ODRL ` +
    `in \`policies/\`, which the engine applies to callers that go through it. It does not stop ` +
    `someone with read access from cloning the repository.`
  );
}

/** The answer, as markdown. Pure: the GitHub identity and the policies are inputs. */
export function whoami(ctx: AccessContext, id: GithubIdentity, input: WhoamiInput, others: readonly Identity[] = [], hosts: readonly AgentHost[] = []): string {
  const lines: string[] = ["# Who is asking", ""];
  const gh = principalFromGithub(id);

  if (id.status === "authenticated") {
    lines.push(
      `- **GitHub:** authenticated as \`${id.login}\` via ${id.via === "actions" ? "the GitHub Actions runner" : "a token"}.`,
    );
    lines.push(
      id.role
        ? `- **Repository role:** \`${id.role}\` on \`${id.repo}\` → gateway actor \`${gh.actor ?? "(nobody)"}\`.`
        : `- **Repository role:** not known${id.reason ? `: ${id.reason}` : ""}.`,
    );
    if (id.ownerType === "User") {
      lines.push(
        `- **Personal-account repository** (${id.visibility ?? "visibility unknown"}): GitHub's only levels here are ` +
          `owner (\`admin\`), collaborator (\`write\`) and everyone else (\`read\` if public). ` +
          `There is no read-only or triage collaborator, so every collaborator can write the whole graph.`,
      );
    }
  } else {
    lines.push(`- **GitHub:** ${id.status}${id.reason ? `: ${id.reason}` : ""}.`);
  }

  // Bean f1e1 (owner 2026-10-10, provider-neutral): every other identity the
  // session can see, listed so "who is asking" has one answer. None of them
  // reaches the permission answer below — only what GitHub vouched for does.
  const rest = others.filter((o) => !(o.provider === "github" && o.handle === id.login));
  if (rest.length) {
    lines.push(
      `- **Also seen** (for preferences only, never for permissions): ` +
        rest.map((o) => `\`${qualified(o)}\` (${o.vouched ? `vouched, ${o.via}` : `self-asserted, ${o.via}`})`).join("; ") +
        ".",
    );
  }

  if (hosts.length) {
    lines.push(
      `- **Agent host:** ` +
        hosts.map((h) => `${h.name} (\`${h.marker}\`; ${h.exposesIdentity ? "passes the person's account" : "passes no account"})`).join("; ") +
        ".",
    );
  }

  const claimed = input.actor ? ctx.actors.get(input.actor) : undefined;
  if (input.actor) {
    lines.push(
      claimed
        ? `- **Acting as:** \`${input.actor}\` (declared; may take ${claimed.roles?.length ? claimed.roles.map((r) => `\`${r}\``).join(", ") : "any role"}). ` +
            `GitHub vouched for the login, not for this actor. By the owner's ruling, GitHub's own levels are the only mapping, so the claim is not verified.`
        : `- **Acting as:** \`${input.actor}\`, which is **not a declared actor**.`,
    );
  }

  lines.push("", "# What they may do", "");
  // The actor policy is asked about: the one claimed, else the one GitHub's role maps to.
  const principal: Principal = input.actor
    ? { actor: input.actor, authenticatedBy: gh.authenticatedBy === "github" ? "github" : "asserted", account: gh.account }
    : gh;
  const grants = new Set<string>();
  for (const p of ctx.policies.values()) {
    for (const a of unscopedGrants(p, ctx.policies).get(principal.actor ?? "") ?? []) grants.add(a);
  }
  lines.push(
    principal.actor
      ? `- **Unscoped grants for \`${principal.actor}\`:** ${grants.size ? [...grants].sort().map((a) => `\`${a}\``).join(", ") : "none"}, plus the anyone floor (\`visualize\`, \`render\`).`
      : `- **Nobody:** the anyone floor only (\`visualize\`, \`render\`).`,
  );

  if (input.action) {
    const scope: RequestScope = {
      ...(input.process ? { "cat-harness:process": input.process } : {}),
      ...(input.task ? { "cat-harness:task": input.task } : {}),
      ...(input.role ? { "cat-harness:role": input.role } : {}),
      ...(input.target ? { target: input.target } : {}),
    };
    const d = decide({ actor: principal.actor, action: input.action, scope }, ctx.policies, ctx.graph);
    lines.push(`- **\`${input.action}\`${input.target ? ` on \`${input.target}\`` : ""}:** ${d}${d === "unknown" ? " (no rule speaks; never read as permit)" : ""}.`);
  }
  if (input.process && input.task) {
    const v = authorizeTask(ctx, {
      principal,
      process: input.process,
      task: input.task,
      role: input.role,
      target: input.target,
    });
    lines.push(`- **Task \`${input.process}/${input.task}\`:** ${describeVerdict(v)}`);
  }

  lines.push("", "# What GitHub cannot express", "", grainNote(id));
  return lines.join("\n");
}

export function registerAuthTools(server: McpServer, repoRoot: string): void {
  server.tool(
    "auth_whoami",
    "Who is asking, and what may they do? Asks GitHub for the caller's login and repository role, " +
      "maps the role to a gateway actor, and answers from the ODRL policies: unscoped grants, an " +
      "action (optionally scoped by process, task, role and target), or the full task-authorization " +
      "verdict for a BPMN step. Always states that GitHub's role covers the whole repository, never " +
      "a sub-graph, node or query path.",
    {
      actor: z.string().optional().describe("A declared actor you are acting as (cat-harness/scenarios/actors/)"),
      action: z.string().optional().describe("An ODRL action to ask about, e.g. content-authoring"),
      process: z.string().optional().describe("Process id, to scope the question or check a task"),
      task: z.string().optional().describe("Node id; with process, runs the task-authorization check"),
      role: z.string().optional().describe("The role the lane binds"),
      target: z.string().optional().describe("The content acted on: a block id, path or bean id"),
    },
    async (input) => {
      const { identity: id } = await githubPrincipalFor(repoRoot, process.env);
      const all = await resolveIdentities({ env: process.env, repo: id.repo, cwd: repoRoot });
      return { content: [{ type: "text" as const, text: whoami(accessContext(repoRoot), id, input, all.identities, all.hosts) }] };
    },
  );
}

/** Re-exported so a reader of the Tool finds the mapping it applies. */
export { GITHUB_ROLE_ACTOR };
