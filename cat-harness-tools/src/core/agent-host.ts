/**
 * Folio Assistant — which agent host runs this session, and what it says
 * about the person typing. Bean `folio-assistant-f1e1`, gap "other agent
 * hosts".
 *
 * Each host marks the commands it runs with an environment variable. The
 * markers below are the ones two independent detectors agree on (Laravel's
 * `agent-detector` and .NET Aspire's `CodingAgentDetector`, read 2026-10-24).
 * A host is a fact about the session, not about the person. Of these hosts
 * only Claude Code passes the person's account to a command
 * (`CLAUDE_CODE_USER_EMAIL`, in its cloud sessions), and `resolveIdentities`
 * already reads it. GitHub's Copilot coding agent runs in GitHub Actions,
 * where the GitHub resolver reads `GITHUB_ACTOR` as it does for any run; that
 * names whoever triggered the run, which this module does not claim is the
 * person typing.
 *
 * Gemini CLI, Codex, Cursor, Antigravity and the Copilot CLI give a command
 * no account at all. On those hosts the person is found from a forge token, the git author,
 * `CAT_HARNESS_PERSON` or the user-level store, and the resolver says so in a
 * note rather than leaving the reader to guess why nobody vouched.
 *
 * Adding a host is one row in {@link AGENT_HOSTS}.
 *
 * @module folio-assistant/core/agent-host
 */

type Env = Readonly<Record<string, string | undefined>>;

export interface AgentHostDef {
  id: string;
  name: string;
  /** Any one of these, set and non-empty, marks the host. */
  markers: readonly string[];
  /** The variable that carries the person's account, if the host sets one. */
  identityVar?: string;
  /** Extra condition, for markers that are only meaningful together with another. */
  when?: (env: Env) => boolean;
}

export const AGENT_HOSTS: readonly AgentHostDef[] = [
  { id: "claude-code", name: "Claude Code", markers: ["CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT"], identityVar: "CLAUDE_CODE_USER_EMAIL" },
  { id: "gemini-cli", name: "Gemini CLI", markers: ["GEMINI_CLI"] },
  { id: "codex", name: "Codex", markers: ["CODEX_SANDBOX", "CODEX_CI", "CODEX_THREAD_ID"] },
  { id: "cursor", name: "Cursor", markers: ["CURSOR_AGENT"] },
  { id: "antigravity", name: "Antigravity", markers: ["ANTIGRAVITY_AGENT"] },
  { id: "copilot-cli", name: "GitHub Copilot CLI", markers: ["COPILOT_CLI"] },
  {
    id: "copilot-agent",
    name: "GitHub Copilot coding agent",
    markers: ["COPILOT_AGENT_SESSION_ID"],
    when: (env) => env.GITHUB_ACTIONS === "true",
  },
];

export interface AgentHost {
  id: string;
  name: string;
  /** The marker that matched. */
  marker: string;
  /** Whether the host passes the person's account to a command at all. */
  exposesIdentity: boolean;
}

/**
 * Every host whose marker is set, in table order. Usually one; more when one
 * host runs inside another (an IDE agent in a Claude Code terminal). A host
 * not in the table but setting the generic `AI_AGENT` is reported by that
 * value, exposing nothing.
 */
export function detectAgentHosts(env: Env): AgentHost[] {
  const out: AgentHost[] = [];
  for (const h of AGENT_HOSTS) {
    const marker = h.markers.find((m) => env[m]);
    if (!marker || (h.when && !h.when(env))) continue;
    out.push({ id: h.id, name: h.name, marker, exposesIdentity: !!h.identityVar });
  }
  if (!out.length && env.AI_AGENT) {
    out.push({ id: env.AI_AGENT, name: env.AI_AGENT, marker: "AI_AGENT", exposesIdentity: false });
  }
  return out;
}
