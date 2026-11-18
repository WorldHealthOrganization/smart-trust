/**
 * Tests for the mechanical QA/publication MCP tools and their pipeline helper.
 *
 * These are hermetic: they exercise the wrapper's structural behaviour
 * (script-path resolution, JSON extraction, graceful errors) and verify the
 * tools register with the expected names/handlers — without spawning the real
 * pipeline (which needs a folio/<paper> fixture).
 */
import { test, expect, describe } from "bun:test";
import {
  pipelineScriptPath,
  resolvePipelineScript,
  tryParseJson,
  runPipeline,
  asToolText,
} from "../../adapters/document/tools/_pipeline.ts";
import { registerQaTools, registerPaperQaTools } from "../../adapters/document/tools/qa.ts";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * A stand-in for `McpServer` that records what a `register*Tools` call
 * registers. Only `tool` is exercised, so the cast to `McpServer` at each use
 * is narrowed through `unknown` rather than `any` — the recorder itself stays
 * typed, and a change to the `tool` signature still breaks here.
 */
interface ToolRecorder {
  tool(name: string, desc: string, schema: unknown, handler: ToolHandler): void;
}

/** An MCP tool handler, as the registration stubs below see it. */
type ToolHandler = (
  ...args: unknown[]
) => Promise<{ content: Array<{ type: string; text: string }> }>;


describe("_pipeline helper", () => {
  test("pipelineScriptPathAppendsTs", () => {
    const p = pipelineScriptPath("qa-sweep");
    expect(p.endsWith("/content/pipeline/qa-sweep.ts")).toBe(true);
    expect(pipelineScriptPath("x.ts").endsWith("/content/pipeline/x.ts")).toBe(true);
  });

  // THE DEPRECATION CONTRACT — this is what keeps the test above meaningful.
  //
  // `pipelineScriptPath` is @deprecated and has zero production callers; every
  // live caller uses `resolvePipelineScript`. Asserting the old function's
  // behaviour on its own therefore pinned a dead subject, and worse, pinned the
  // FOLIO-ONLY resolution that the new function exists to replace: resolving
  // against the folio alone is the defect that made every pipeline-backed tool
  // fail on a scaffolded folio (see `resolvePipelineScript`'s docstring).
  //
  // So assert the DIFFERENCE instead. The discriminator is a name that exists
  // nowhere, which needs no fixture and holds under both folio layouts:
  //
  //   pipelineScriptPath   answers "where WOULD this live in this folio"
  //                        -> a path, always, without touching the filesystem
  //   resolvePipelineScript answers "where IS it, here or in the platform"
  //                        -> undefined when the answer is nowhere
  //
  // This fails if anyone "fixes" pipelineScriptPath to do an existence check
  // (making it silently a second resolver), or if resolvePipelineScript
  // regresses to returning a path blindly. Bean folio-assistant-a39g.
  test("deprecationContract", () => {
    const nowhere = "definitely-not-a-real-pipeline-script-a39g";

    // The deprecated one never consults the filesystem: it answers for a
    // script that does not exist, in this folio or anywhere else.
    const named = pipelineScriptPath(nowhere);
    expect(named.endsWith(`/content/pipeline/${nowhere}.ts`)).toBe(true);

    // The live one does consult it, and says so honestly.
    expect(resolvePipelineScript(nowhere)).toBeUndefined();

    // Which is exactly why runPipeline must route through the second, not the
    // first: a caller that trusted `named` above would spawn a missing file.
    const res = runPipeline(nowhere);
    expect(res.ok).toBe(false);
    expect(res.error).toContain("pipeline script not found");
  });

  test("tryParseJsonAfterBanner", () => {
    expect(tryParseJson('banner\n{"a":1}')).toEqual({ a: 1 });
    expect(tryParseJson("[1,2,3]")).toEqual([1, 2, 3]);
    expect(tryParseJson("no json here")).toBeUndefined();
    expect(tryParseJson("")).toBeUndefined();
  });

  test("runPipelineStructuredError", () => {
    const r = runPipeline("definitely-not-a-real-script-xyz", ["--json"]);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("not found");
    expect(r.json).toBeUndefined();
  });

  test("asToolTextRenders", () => {
    const errRes = asToolText("t", {
      ok: false, script: "s", exitCode: null, stdout: "", stderr: "", error: "boom",
    });
    expect(errRes.content[0].type).toBe("text");
    expect(errRes.content[0].text).toContain("boom");

    const jsonRes = asToolText("t", {
      ok: true, script: "s", exitCode: 0, stdout: "", stderr: "", json: { findings: [] },
    });
    expect(jsonRes.content[0].text).toContain("```json");
    expect(jsonRes.content[0].text).toContain("findings");
  });
});

/** Register one half and report what it produced. */
function record(register: (s: McpServer) => void): Record<string, { desc: string; schema: unknown; handler: ToolHandler }> {
  const registered: Record<string, { desc: string; schema: unknown; handler: ToolHandler }> = {};
  const stub: ToolRecorder = {
    tool(name, desc, schema, handler) { registered[name] = { desc, schema, handler }; },
  };
  register(stub as unknown as McpServer);
  return registered;
}

describe("registerQaTools", () => {
  test("registersMechanicalTools", () => {
    // Both halves together must still cover the module's whole table — that is
    // a property of the table, not of either adapter, and splitting the
    // registration must not let an entry fall out of coverage.
    const registered = { ...record(registerQaTools), ...record(registerPaperQaTools) };

    for (const name of [
      "qa_sweep",
      "proof_status",
      "latex_preflight",
      "bib_qa",
      "glossary_check",
      "content_export",
    ]) {
      expect(registered[name]).toBeDefined();
      expect(typeof registered[name].handler).toBe("function");
      expect(registered[name].desc.length).toBeGreaterThan(10);
    }
  });

  test("paperOnlyNotInDocument", () => {
    // `proof_status` counts sorries in Lean files and `latex_preflight` parses
    // .tex source. On a document folio both would report clean forever, and a
    // check that never looked is indistinguishable from one that passed.
    const doc = record(registerQaTools);
    expect(doc["proof_status"]).toBeUndefined();
    expect(doc["latex_preflight"]).toBeUndefined();
    // …and the document half keeps everything a prose folio can actually use.
    for (const name of ["qa_sweep", "bib_qa", "glossary_check", "content_export"]) {
      expect(doc[name]).toBeDefined();
    }
  });

  test("glossaryCheckGraceful", async () => {
    const registered: Record<string, ToolHandler> = {};
    const stub = { tool(name: string, _d: string, _s: unknown, h: ToolHandler) { registered[name] = h; } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerQaTools(stub as any);
    // In this repo there is no folio/<paper>, so auto-detect yields nothing.
    const res = await registered["glossary_check"]({});
    expect(res.content[0].type).toBe("text");
    expect(res.content[0].text.toLowerCase()).toContain("paper");
  });
});
