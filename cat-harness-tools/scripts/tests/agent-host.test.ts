/** Which agent host runs the session (bean f1e1, gap "other agent hosts"). */
import { describe, expect, test } from "bun:test";

import { detectAgentHosts } from "../../src/core/agent-host.js";

describe("detectAgentHosts", () => {
  test("each host by its own marker", () => {
    const one = (env: Record<string, string>) => detectAgentHosts(env).map((h) => h.id);
    expect(one({ GEMINI_CLI: "1" })).toEqual(["gemini-cli"]);
    expect(one({ CODEX_SANDBOX: "seatbelt" })).toEqual(["codex"]);
    expect(one({ CURSOR_AGENT: "1" })).toEqual(["cursor"]);
    expect(one({ ANTIGRAVITY_AGENT: "1" })).toEqual(["antigravity"]);
    expect(one({ COPILOT_CLI: "1" })).toEqual(["copilot-cli"]);
    expect(one({ CLAUDECODE: "1" })).toEqual(["claude-code"]);
  });

  test("an empty marker is not a marker; none set is no host", () => {
    expect(detectAgentHosts({ GEMINI_CLI: "" })).toEqual([]);
    expect(detectAgentHosts({})).toEqual([]);
  });

  test("the Copilot coding agent only inside GitHub Actions", () => {
    expect(detectAgentHosts({ COPILOT_AGENT_SESSION_ID: "x" })).toEqual([]);
    expect(detectAgentHosts({ COPILOT_AGENT_SESSION_ID: "x", GITHUB_ACTIONS: "true" }).map((h) => h.id)).toEqual(["copilot-agent"]);
  });

  test("an unknown host that sets AI_AGENT is named by it, exposing nothing", () => {
    expect(detectAgentHosts({ AI_AGENT: "v0" })).toEqual([{ id: "v0", name: "v0", marker: "AI_AGENT", exposesIdentity: false }]);
  });

  test("several hosts when one runs inside another", () => {
    expect(detectAgentHosts({ CLAUDECODE: "1", CURSOR_AGENT: "1" }).map((h) => h.id)).toEqual(["claude-code", "cursor"]);
  });
});
