/**
 * Shared helper for the mechanical "QA / publication / transform" MCP tools.
 *
 * These tools expose the deterministic cores that live as scripts under
 * `content/pipeline/*` — the LLM calls them to get structured findings, then
 * applies judgment (the skill bodies) on top. Each tool wraps one pipeline
 * script through {@link runPipeline}, which spawns `bun run` on the script from
 * the repo root and captures structured output, degrading gracefully when the
 * script or a toolchain is missing.
 *
 * @module adapters/paper/tools/_pipeline
 */

import { folioDir } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import { safeSegment } from "@litlfred/cat-harness-tools/src/core/safe-path.js";
import { spawnSync } from "child_process";
import { existsSync, readdirSync } from "fs";
import { join, resolve } from "path";
import { get } from "../paths.js";

export interface PipelineResult {
  ok: boolean;
  /** Script id (without `.ts`). */
  script: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  /** Parsed JSON when `--json` was requested and stdout parsed cleanly. */
  json?: unknown;
  /** Wrapper-level error (missing script / `bun` not found / spawn failure). */
  error?: string;
}

/**
 * The platform's own `pipeline/` (`cat-harness-tools/pipeline/`).
 *
 * `adapters/document/tools/` -> platform root. Computed rather than passed so
 * that a tool never has to know where it is installed.
 */
function platformPipelineDir(): string {
  // MOVED 2026-09-30 (bean `ybp4`): this module left `cat-harness/` for
  // `folio-assistant-core/`, so three hops no longer reach the PLATFORM root —
  // they reach core's. The platform must be named now. An `import.meta.dir` hop
  // is invisible to every import-path scan, so neither typecheck nor a specifier
  // rewrite could see this break; `resolvePipelineScript("qa-sweep")` returning
  // undefined in `pipeline-resolution.test.ts` is what caught it, which is why
  // those tests moved WITH their subject.
  //
  // `pipeline/` since rnfl (tools#146): `content/pipeline/` is the transitional
  // symlink, kept only while a tools pin older than the move is still mounted.
  const tools = resolve(import.meta.dir, "..", "..", "..", "..", "cat-harness-tools");
  const moved = join(tools, "pipeline");
  return existsSync(moved) ? moved : join(tools, "content", "pipeline");
}

/**
 * `folio-assistant-core/scripts/`, the CONTENT layer's own executable surface.
 *
 * A third place to look, and it exists because a pipeline script is not
 * automatically the platform's. Bean `yj6r` moved the glossary cluster —
 * `build-glossary` and its `:refterm` codemod — up into core, where the
 * `schemas/glossary.ts` they read already lived; before that they imported
 * UPWARD out of `cat-harness/` into a sibling layer the harness does not
 * declare as a need.
 *
 * Resolving this as a SIBLING of the platform root, not through the platform's
 * own tree: `adapters/document/tools/` -> platform root -> its parent, which is
 * the checkout holding both layers. That parent hop is the whole reason this
 * is a separate function with a comment — it is the one place in this module
 * that assumes the two layers are checked out beside each other, which is
 * true pre-split and is what #223 will remove.
 */
function corePipelineDir(): string {
  // Now WITHIN this module's own layer — the simplification the move bought.
  // This used to hop out to the parent checkout and back down, the one place
  // here that assumed the two layers sit beside each other. That assumption
  // is gone from this function; what remains of it is in `platformPipelineDir`,
  // pointing the other way and in the LEGAL direction.
  return resolve(import.meta.dir, "..", "..", "..", "scripts");
}

/**
 * Absolute path to a `content/pipeline/<script>.ts` file, or `undefined` when
 * neither the folio nor the platform has one.
 *
 * Two layouts are in the wild and both are legitimate:
 *
 * - the folio carries its own `content/pipeline/` — the `qou` layout, from
 *   when the platform was vendored inside the content repo; and
 * - the folio carries only `content/schema/` and reaches the pipeline in the
 *   platform checkout, which is what `folio_init` scaffolds.
 *
 * and a THIRD location that is not a layout at all: `folio-assistant-core/
 * scripts/`, where the content layer keeps the pipeline scripts whose subject is
 * a folio's content rather than the harness (bean `yj6r`). Searched LAST, so the
 * folio's fork still wins and the platform's copy still wins over core's — a
 * script that exists in two places was already a decided question and this does
 * not re-open it.
 *
 * Resolving ONLY against the folio meant every pipeline-backed tool — around
 * twenty-five of them, the whole QA, audit, bibliography and transform surface
 * — returned `pipeline script not found` on every scaffolded folio. That was
 * at least honest (see {@link runPipeline}), unlike the same defect in
 * `content_validate`, which reported a clean run; but honest and inert is
 * still inert.
 *
 * The folio's own copy wins when present, so a folio that has deliberately
 * forked a pipeline script keeps its fork.
 */
export function resolvePipelineScript(script: string): string | undefined {
  const name = script.endsWith(".ts") ? script : `${script}.ts`;
  const inFolio = join(get.REPO_ROOT(), "content", "pipeline", name);
  if (existsSync(inFolio)) return inFolio;
  const inPlatform = join(platformPipelineDir(), name);
  if (existsSync(inPlatform)) return inPlatform;
  const inCore = join(corePipelineDir(), name);
  return existsSync(inCore) ? inCore : undefined;
}

/**
 * Absolute path to the folio's `content/pipeline/<script>.ts`.
 *
 * @deprecated Prefer {@link resolvePipelineScript}, which also finds the
 * platform's copy. Kept because it is exported and says something true — where
 * the script would live *in this folio* — but it must not be used to decide
 * whether a script exists.
 */
export function pipelineScriptPath(script: string): string {
  const name = script.endsWith(".ts") ? script : `${script}.ts`;
  return join(get.REPO_ROOT(), "content", "pipeline", name);
}

/**
 * Best-effort JSON extraction: many scripts print a human banner before the
 * JSON, so parse from the first `{`/`[`. Returns undefined if nothing parses.
 */
export function tryParseJson(s: string): unknown | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const candidates = ["{", "["]
    .map((c) => t.indexOf(c))
    .filter((i) => i >= 0);
  if (candidates.length === 0) return undefined;
  const start = Math.min(...candidates);
  try {
    return JSON.parse(t.slice(start));
  } catch {
    return undefined;
  }
}

/** Run a pipeline script and capture a structured result. Never throws. */
export function runPipeline(
  script: string,
  args: string[] = [],
  opts: { timeoutMs?: number } = {},
): PipelineResult {
  const path = resolvePipelineScript(script);
  if (!path) {
    return {
      ok: false,
      script,
      exitCode: null,
      stdout: "",
      stderr: "",
      error:
        `pipeline script not found: content/pipeline/${script}.ts — ` +
        `looked in this folio, in the platform checkout and in the content layer's folio-assistant-core/scripts/`,
    };
  }
  const res = spawnSync("bun", ["run", path, ...args], {
    cwd: get.REPO_ROOT(),
    encoding: "utf-8",
    timeout: opts.timeoutMs ?? 120_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (res.error) {
    return {
      ok: false,
      script,
      exitCode: res.status ?? null,
      stdout: res.stdout ?? "",
      stderr: res.stderr ?? "",
      error: res.error.message,
    };
  }
  const stdout = res.stdout ?? "";
  return {
    ok: res.status === 0,
    script,
    exitCode: res.status,
    stdout,
    stderr: res.stderr ?? "",
    json: args.includes("--json") ? tryParseJson(stdout) : undefined,
  };
}

const MAX = 12_000;

/** Format a PipelineResult as an MCP text tool result. */
export function asToolText(title: string, r: PipelineResult) {
  let text: string;
  if (r.error) {
    text = `# ${title}\n\n⚠️ ${r.error}`;
  } else {
    const body =
      r.json !== undefined
        ? "```json\n" + JSON.stringify(r.json, null, 2).slice(0, MAX) + "\n```"
        : (r.stdout || r.stderr || "(no output)").slice(0, MAX);
    text = `# ${title} (${r.ok ? "ok" : `exit ${r.exitCode}`})\n\n${body}`;
  }
  return { content: [{ type: "text" as const, text }] };
}

/** Format a path-containment or input validation refusal as an MCP error result. */
export function refuseTool(title: string, reason: string) {
  return {
    content: [{ type: "text" as const, text: `# ${title}\n\n❌ Refused: ${reason}` }],
    isError: true,
  };
}

/** Resolve the single paper under folio/ if not given (else undefined). */
export function autoPaper(paper?: string): string | undefined {
  if (paper !== undefined) return safeSegment(paper);
  const dir = folioDir(get.REPO_ROOT());
  if (!existsSync(dir)) return undefined;
  const papers = readdirSync(dir, { withFileTypes: true })
    .filter(
      (d) =>
        d.isDirectory() &&
        !d.name.startsWith(".") &&
        !["pipeline", "schema", "node_modules"].includes(d.name),
    )
    .map((d) => safeSegment(d.name))
    .filter((n): n is string => n !== undefined);
  return papers.length === 1 ? papers[0] : undefined;
}
