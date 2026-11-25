/**
 * The MCP projection, and the injection defence it rests on.
 *
 * The claim being tested is not "we escape arguments" — it is that a dangerous
 * VALUE cannot be constructed, because every command-line input references a
 * type that refuses it. Escaping is a property of the caller and a caller is one
 * refactor away from a template literal; a constrained type survives that.
 */
import { describe, expect, test } from "bun:test";

import { project, buildArgv, unmetRequirement, recordInvocation } from "../../../src/mcp/project.js";
import { defineTool, type ToolDefinition } from "../../../schemas/tools/tool.js";
import { toolTypeIri, isInjectionSafe, TOOL_TYPES } from "../../../schemas/tools/tool-types.js";
import { ToolInvocationSchema } from "../../../schemas/tools/tool-invocation.js";
import { tools } from "../../../tools/discover.js";

const B = "https://example.invalid/fa";
const t = (n: Parameters<typeof toolTypeIri>[1]): string => toolTypeIri(B, n);

const beanTool = (): ToolDefinition =>
  defineTool({
    id: "bean-demo",
    title: "demo",
    description: "demo",
    install: { none: true },
    invoke: { shell: "beans" },
    io: {
      inputs: [
        { name: "id", schema: t("BeanId"), required: true, arg: { positional: 0 } },
        { name: "status", schema: t("BeanStatus"), required: false, arg: { flag: "--status" } },
      ],
      outputs: [],
    },
    satisfies: ["todo-manager"],
  });

describe("mcp projection", () => {
  test("argv is an array, and the command is its head", () => {
    const { argv } = buildArgv(beanTool(), { id: "fa-1dfh", status: "in-progress" });
    expect(argv).toEqual(["beans", "fa-1dfh", "--status", "in-progress"]);
  });

  test("a payload cannot be constructed — the type refuses it", () => {
    // Each of these is a real shell payload. None is a member of `BeanId`, so
    // the parse throws before anything is assembled. This is the FIRST line of
    // defence; the argv array is the second.
    for (const payload of ["; rm -rf /", "$(whoami)", "`id`", "a && b", "x | y", "../../etc/passwd"]) {
      expect(() => buildArgv(beanTool(), { id: payload })).toThrow();
    }
  });

  test("an enum input refuses anything outside the enum", () => {
    expect(() => buildArgv(beanTool(), { id: "fa-1dfh", status: "completed; rm -rf /" })).toThrow();
  });

  test("a missing required input throws rather than producing a short argv", () => {
    // A tool invoked with a hole in its arguments is a different command.
    expect(() => buildArgv(beanTool(), {})).toThrow(/required input/);
  });

  test("positionals keep their declared order regardless of declaration order", () => {
    const tool = defineTool({
      id: "ordered", title: "x", description: "y",
      install: { none: true }, invoke: { shell: "cmd" },
      io: {
        inputs: [
          { name: "second", schema: t("Branch"), required: true, arg: { positional: 1 } },
          { name: "first", schema: t("Branch"), required: true, arg: { positional: 0 } },
        ],
        outputs: [],
      },
      satisfies: ["todo-manager"],
    });
    expect(buildArgv(tool, { first: "a", second: "b" }).argv).toEqual(["cmd", "a", "b"]);
  });

  test("free prose goes on stdin, never into argv", () => {
    const tool = defineTool({
      id: "prose", title: "x", description: "y",
      install: { none: true }, invoke: { shell: "cmd" },
      io: { inputs: [{ name: "body", schema: t("Markdown"), required: true, arg: { stdin: true } }], outputs: [] },
      satisfies: ["todo-manager"],
    });
    const r = buildArgv(tool, { body: "anything; `goes` $(here)" });
    expect(r.argv).toEqual(["cmd"]);
    expect(r.stdin).toBe("anything; `goes` $(here)");
  });

  test("Markdown is not injection-safe, and that is deliberate", () => {
    // No pattern admits real prose and excludes a payload. Saying so beats a
    // type that claims safety it does not provide.
    expect(isInjectionSafe("Markdown")).toBe(false);
    for (const n of ["BeanId", "BeanStatus", "RepoPath", "Url", "Branch", "ChangeProposalNumber"]) {
      expect(isInjectionSafe(n)).toBe(true);
    }
  });

  test("every injection-safe type actually refuses metacharacters", () => {
    // The set is an assertion; this checks it. A type listed as safe that
    // accepts `; rm -rf /` would be worse than not listing it at all.
    for (const name of Object.keys(TOOL_TYPES)) {
      if (!isInjectionSafe(name)) continue;
      const schema = TOOL_TYPES[name as keyof typeof TOOL_TYPES];
      for (const payload of ["; rm -rf /", "$(whoami)", "`id`", "a b"]) {
        expect(schema.safeParse(payload).success).toBe(false);
      }
    }
  });

  test("a Tool with both shell and MCP arms projects on its shell arm, and nothing is omitted", () => {
    // Declared here: the corpus's only shell+mcp Tool, the umbrella `github`
    // node, was retired by cat-harness#390 (4dbr).
    const both = defineTool({
      id: "shell-and-mcp", title: "x", description: "y",
      install: { none: true }, invoke: { shell: "cmd", mcp: { tool: "some_mcp_tool" } },
      io: { inputs: [], outputs: [] }, satisfies: ["todo-manager"],
    });
    const { declarations, omissions } = project([both]);
    // A Tool with BOTH shell and mcp projects on its shell arm.
    expect(declarations.map((d) => d.name)).toContain("shell_and_mcp");
    expect(omissions).toEqual([]);
  });

  test("an unmet requirement means NOT LISTED, and the omission is reported", () => {
    const netTool = defineTool({
      id: "needs-net", title: "x", description: "y",
      install: { none: true }, invoke: { shell: "cmd" },
      io: { inputs: [], outputs: [] }, satisfies: ["todo-manager"],
      requires: { network: true },
    });
    const { declarations, omissions } = project([netTool], { network: false });
    // tools/list is what a model plans against: advertising an unrunnable tool
    // makes every plan containing it wrong.
    expect(declarations).toEqual([]);
    expect(omissions[0].reason).toContain("requires network");
    expect(unmetRequirement(netTool, { network: false })).toBeDefined();
  });

  test("a manual-only Tool is omitted, and says why", () => {
    const manualOnly = defineTool({
      id: "by-hand", title: "x", description: "y",
      install: { none: true }, invoke: { manual: true },
      io: { inputs: [], outputs: [] }, satisfies: ["todo-manager"],
    });
    const { declarations, omissions } = project([manualOnly]);
    expect(declarations).toEqual([]);
    expect(omissions).toHaveLength(1);
    expect(omissions[0]!.tool).toBe("by-hand");
    expect(omissions[0]!.reason).toContain("manual-only");
    // beans-manual declares BOTH shell and manual, so it does project.
    const beans = project(tools(B).filter((x) => x.id === "beans-manual"));
    expect(beans.declarations).toHaveLength(1);
    expect(beans.omissions).toEqual([]);
  });

  test("the real Tool set projects, and every declaration has a schema", () => {
    const { declarations } = project(tools(B), { network: true, runtimes: ["go"] });
    expect(declarations.length).toBeGreaterThan(0);
    for (const d of declarations) {
      expect(d.name).toMatch(/^[a-z][a-z0-9_]*$/); // MCP names use underscores.
      expect(d.description.length).toBeGreaterThan(0);
      expect(d.inputSchema).toBeDefined();
    }
  });

  test("a repeated flag is emitted once per element, never comma-joined", () => {
    // Joining would invent a separator the tool never agreed to, and make an
    // element containing that separator ambiguous.
    const tool = tools(B).find((x) => x.id === "readme-sync")!;
    const { argv } = buildArgv(tool, { only: ["folio:toc", "folio:simulators"], check: true });
    expect(argv).toEqual([
      "bun run cat readme:sync",
      "--check",
      "--only",
      "folio:toc",
      "--only",
      "folio:simulators",
    ]);
  });

  test("a repeated positional becomes trailing words", () => {
    const tool = tools(B).find((x) => x.id === "stakeholder-map")!;
    expect(buildArgv(tool, { paths: ["src/a.ts", "skills/folio-core/x.md"] }).argv).toEqual([
      "bun run cat stakeholder-map",
      "src/a.ts",
      "skills/folio-core/x.md",
    ]);
  });

  test("each element of a repeated input is parsed by the element type", () => {
    // The injection guarantee carries through cardinality unchanged: a list of
    // an injection-safe type cannot hold an element that is a payload.
    const tool = tools(B).find((x) => x.id === "stakeholder-map")!;
    expect(() => buildArgv(tool, { paths: ["src/a.ts", "../../etc/passwd"] })).toThrow();
    expect(() => buildArgv(tool, { paths: ["src/a.ts; rm -rf /"] })).toThrow();
  });

  test("a repeated input given a scalar is an error, not something to coerce", () => {
    // Coercing would let the caller decide the arity of the command.
    const tool = tools(B).find((x) => x.id === "stakeholder-map")!;
    expect(() => buildArgv(tool, { paths: "src/a.ts" })).toThrow(/needs an array/);
  });

  test("a boolean projects to the presence of its flag, and false to nothing", () => {
    // `--force true` is a command nobody writes; `--force false` would enable
    // the very thing it reads as disabling.
    const tool = tools(B).find((x) => x.id === "readme-audit")!;
    expect(buildArgv(tool, { file: "README.md", fetch: true }).argv).toEqual([
      "bun run cat readme:audit",
      "README.md",
      "--fetch",
    ]);
    expect(buildArgv(tool, { file: "README.md", fetch: false }).argv).toEqual([
      "bun run cat readme:audit",
      "README.md",
    ]);
  });

  test("an in-process Tool says so rather than reading as a broken record", () => {
    const tool = tools(B).find((x) => x.id === "skill-fetch")!;
    expect(() => buildArgv(tool, { skill: "todo-manager" })).toThrow(/in-process/);
  });

  test("the migrated MCP surface matches what the server actually serves", async () => {
    // The whole point of the migration: a Tool node whose `io` disagrees with
    // the registrar is worse than no node, because the next check trusts it.
    // `mcp:capture` mounts the real registrars, so this compares against the
    // Zod shapes rather than against the source text.
    const { captureTools } = await import("../../capture-mcp-tools.js");
    const { tools: served, problems } = await captureTools();
    expect(problems).toEqual([]);

    const nodes = new Map(
      tools(B)
        .filter((x) => x.invoke.mcp !== undefined && x.invoke.inProcess !== undefined)
        .map((x) => [x.invoke.mcp!.tool, x]),
    );

    for (const s of served) {
      const node = nodes.get(s.name);
      expect(node, `no Tool node for served tool ${s.name}`).toBeDefined();
      expect(node!.invoke.inProcess!.module).toBe(s.module);

      const declared = new Set(node!.io.inputs.map((i) => i.name));
      for (const k of [...s.required, ...s.optional]) {
        expect(declared.has(k), `${s.name}: served input \`${k}\` is not in the Tool node`).toBe(true);
      }
      for (const i of node!.io.inputs) {
        expect(
          s.required.includes(i.name) || s.optional.includes(i.name),
          `${s.name}: Tool node declares \`${i.name}\`, which is not served`,
        ).toBe(true);
        expect(i.required, `${s.name}.${i.name}: required flag disagrees`).toBe(s.required.includes(i.name));
      }
    }
  });

  test("an invocation records who, in which role, at which task", () => {
    const inv = recordInvocation({
      id: "inv-1", tool: beanTool(), skill: "todo-manager",
      by: { actor: "authoring-agent", role: "content-author" },
      context: { process: "Process_ContentChangeReview", task: "Task_ReviewStaging" },
      inputs: { id: "fa-1dfh" }, argv: ["beans", "fa-1dfh"],
      outcome: "ran", exitCode: 0, started_at: new Date().toISOString(),
    });
    expect(ToolInvocationSchema.safeParse(inv).success).toBe(true);
    expect(inv.by.actor).toBe("authoring-agent");
    expect(inv.by.role).toBe("content-author");
    expect(inv.context?.task).toBe("Task_ReviewStaging");
  });

  test("recording a skill the Tool does not satisfy is refused", () => {
    // Otherwise the audit trail would assert an edge the Tool itself denies.
    expect(() =>
      recordInvocation({
        id: "x", tool: beanTool(), skill: "not-a-skill-it-satisfies",
        by: { actor: "a", role: "r" }, inputs: {}, argv: [],
        outcome: "ran", started_at: new Date().toISOString(),
      }),
    ).toThrow(/does not satisfy/);
  });

  test("a refusal without a reason is not a valid record", () => {
    // A mechanism that records only successes cannot answer "why was this
    // blocked", which is most of what an audit is for.
    const base = {
      id: "x", tool: "bean-demo", skill: "todo-manager",
      by: { actor: "a", role: "r" }, inputs: {}, argv: [],
      started_at: new Date().toISOString(),
    };
    expect(ToolInvocationSchema.safeParse({ ...base, outcome: "refused-permission" }).success).toBe(false);
    expect(
      ToolInvocationSchema.safeParse({ ...base, outcome: "refused-permission", reason: "lacks admin-settings" })
        .success,
    ).toBe(true);
  });
});
