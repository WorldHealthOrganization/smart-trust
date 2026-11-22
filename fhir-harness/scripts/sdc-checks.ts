#!/usr/bin/env bun
/**
 * sdc-checks.ts — build-time Structured Data Capture checks on an IG's built
 * Questionnaires, with CSIRO's SDC libraries (all Apache-2.0). Checks, not UI
 * (owner, 2026-10-14). Skill `fhir-questionnaire-wireframe`, step 4b; the
 * result is the skill output's `sdcChecks[]`, one entry per Questionnaire.
 *
 * | check | library | runs when | passes when |
 * |---|---|---|---|
 * | `assemble` | `@aehrc/sdc-assemble` | the Questionnaire declares `assemble-root` | every `subQuestionnaire` resolves in this IG and none is left in the result |
 * | `template-extract` | `@aehrc/sdc-template-extract` | the Questionnaire carries a template, and the fixture has `response.json` + `extract-expected.json` | each expected resource is found among the extracted ones |
 * | `populate` | `@aehrc/sdc-populate` | the fixture has `populate-context.json` + `populate-expected.json` | each expected answer is in the populated response |
 * | `behaviour` | `@aehrc/questionnaire-test-toolkit` | the fixture has `behaviour.test.tsx` | `bun test` on it passes — **warn-only**: the toolkit is early |
 *
 * Fixtures are the IG's own, one directory per Questionnaire id under
 * `--fixtures` (an IG keeps them at, say, `input/tests/questionnaires/`).
 * Everything resolves inside the IG: a `subQuestionnaire` or a populate query
 * is answered from the AST and the fixture, never from a server.
 *
 * A check with nothing to run says so (`not-applicable`, `no-fixture`) and is
 * never a pass. A check that could not run is `could-not-determine`.
 *
 *   bun run fhir-harness/scripts/sdc-checks.ts --ast <output-ast> [--questionnaire <id>]…
 *       [--fixtures <dir>] [--out <dir>] [--json]
 *
 * `--out` writes each assembled Questionnaire as `Questionnaire-<id>.assembled.json`:
 * assembly as a build step as well as a check.
 *
 * Exit: 0 no failure, 1 an error-severity failure, 2 the AST could not be read.
 *
 * @module fhir-harness/scripts/sdc-checks
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { assemble } from "@aehrc/sdc-assemble";
import { canBeTemplateExtracted, inAppExtract } from "@aehrc/sdc-template-extract";
import { populateQuestionnaire } from "@aehrc/sdc-populate";
import { readAst } from "./ig-ast.ts";

const SDC = "http://hl7.org/fhir/uv/sdc/StructureDefinition/";
const ASSEMBLE_EXPECTATION = `${SDC}sdc-questionnaire-assemble-expectation`;
const SUB_QUESTIONNAIRE = `${SDC}sdc-questionnaire-subQuestionnaire`;

/** The library each check uses, and its pinned version. */
export const SDC_LIBRARIES = {
  assemble: "@aehrc/sdc-assemble@2.0.3",
  "template-extract": "@aehrc/sdc-template-extract@1.0.16",
  populate: "@aehrc/sdc-populate@4.7.2",
  behaviour: "@aehrc/questionnaire-test-toolkit@0.1.0",
} as const;

export type SdcCheckName = keyof typeof SDC_LIBRARIES;
export type SdcStatus = "pass" | "fail" | "not-applicable" | "no-fixture" | "could-not-determine";

export interface SdcCheck {
  check: SdcCheckName;
  library: string;
  status: SdcStatus;
  /** `warning` for the behavioural tests, whose failure never fails the run. */
  severity: "error" | "warning";
  findings: string[];
  /** The assembled Questionnaire, when `--out` wrote it. */
  output?: string;
}

export interface SdcResult {
  questionnaire: string;
  checks: SdcCheck[];
}

/* eslint-disable @typescript-eslint/no-explicit-any -- FHIR resources are read as plain JSON. */
type Json = Record<string, any>;

const result = (check: SdcCheckName, status: SdcStatus, findings: string[] = [], extra: Partial<SdcCheck> = {}): SdcCheck => ({
  check,
  library: SDC_LIBRARIES[check],
  status,
  severity: check === "behaviour" ? "warning" : "error",
  findings,
  ...extra,
});

const readJson = (p: string): Json | undefined => (existsSync(p) ? JSON.parse(readFileSync(p, "utf-8")) : undefined);

/** Is `want` contained in `got`: every key of an object, every element of an array matched by some element. */
export function contains(got: unknown, want: unknown): boolean {
  if (Array.isArray(want)) return Array.isArray(got) && want.every((w) => got.some((g) => contains(g, w)));
  if (want !== null && typeof want === "object")
    return got !== null && typeof got === "object" && !Array.isArray(got) && Object.entries(want).every(([k, v]) => contains((got as Json)[k], v));
  return got === want;
}

const anyItem = (items: Json[] | undefined, p: (it: Json) => boolean): boolean => (items ?? []).some((it) => p(it) || anyItem(it.item, p));
const hasSub = (it: Json) => (it.extension ?? []).some((e: Json) => e.url === SUB_QUESTIONNAIRE);

/** A searchset Bundle answering a canonical (`url` or `url&version=v`) from this IG's Questionnaires. */
export function canonicalBundle(byUrl: Map<string, Json>, query: string): Json {
  const [url, v] = query.split("&version=");
  const hit = [...byUrl.values()].find((q) => q.url === url && (v === undefined || q.version === v));
  return { resourceType: "Bundle", type: "searchset", entry: hit ? [{ resource: hit }] : [] };
}

export async function checkAssemble(q: Json, byUrl: Map<string, Json>, out?: string): Promise<SdcCheck> {
  const root = (q.extension ?? []).some((e: Json) => e.url === ASSEMBLE_EXPECTATION && e.valueCode === "assemble-root");
  if (!root) return result("assemble", "not-applicable", ["not an assemble-root"]);
  const r: Json = await assemble({ resourceType: "Parameters", parameter: [{ name: "questionnaire", resource: q }] } as any, async (c: string) => canonicalBundle(byUrl, c), {});
  const assembled = r.resourceType === "Questionnaire" ? r : r.resourceType === "Parameters" ? r.parameter?.find((p: Json) => p.name === "return")?.resource : undefined;
  const outcome = r.resourceType === "OperationOutcome" ? r : r.resourceType === "Parameters" ? r.parameter?.find((p: Json) => p.name === "outcome")?.resource : undefined;
  const issues = (outcome?.issue ?? []).map((i: Json) => `${i.severity}: ${i.details?.text ?? i.diagnostics ?? i.code}`);
  if (!assembled) return result("assemble", "fail", issues.length ? issues : ["assembly returned no Questionnaire"]);
  if (anyItem(assembled.item, hasSub)) return result("assemble", "fail", [...issues, "a subQuestionnaire is still unresolved in the assembled Questionnaire"]);
  let output: string | undefined;
  if (out) {
    mkdirSync(out, { recursive: true });
    output = join(out, `Questionnaire-${q.id}.assembled.json`);
    writeFileSync(output, JSON.stringify(assembled, null, 2) + "\n");
  }
  return result("assemble", issues.some((i: string) => i.startsWith("error")) ? "fail" : "pass", issues, output ? { output } : {});
}

export async function checkExtract(q: Json, fixture: string | undefined): Promise<SdcCheck> {
  if (!canBeTemplateExtracted(q as any)) return result("template-extract", "not-applicable", ["no templateExtract template"]);
  const response = fixture && readJson(join(fixture, "response.json"));
  const expected = fixture && readJson(join(fixture, "extract-expected.json"));
  if (!response || !expected) return result("template-extract", "no-fixture", ["response.json and extract-expected.json are needed"]);
  const r = await inAppExtract(response as any, q as any, null);
  const er: Json = r.extractResult as Json;
  if (!r.extractSuccess || er.resourceType === "OperationOutcome")
    return result("template-extract", "fail", (er.issue ?? []).map((i: Json) => i.details?.text ?? i.diagnostics ?? "extraction failed"));
  const got = (er.extractedBundle?.entry ?? []).map((e: Json) => e.resource);
  const want: Json[] = expected.resourceType === "Bundle" ? (expected.entry ?? []).map((e: Json) => e.resource) : Array.isArray(expected) ? expected : [expected];
  const missing = want.filter((w) => !got.some((g: Json) => contains(g, w)));
  return result(
    "template-extract",
    missing.length ? "fail" : "pass",
    missing.map((m) => `expected ${m.resourceType} not extracted: ${JSON.stringify(m)}`),
  );
}

const answersByLinkId = (qr: Json): Map<string, unknown[]> => {
  const m = new Map<string, unknown[]>();
  const walk = (items: Json[] | undefined) => {
    for (const it of items ?? []) {
      if (it.answer) m.set(it.linkId, it.answer);
      walk(it.item);
      for (const a of it.answer ?? []) walk(a.item);
    }
  };
  walk(qr.item);
  return m;
};

export async function checkPopulate(q: Json, fixture: string | undefined): Promise<SdcCheck> {
  const ctx = fixture && readJson(join(fixture, "populate-context.json"));
  const expected = fixture && readJson(join(fixture, "populate-expected.json"));
  if (!ctx || !expected) return result("populate", "no-fixture", ["populate-context.json and populate-expected.json are needed"]);
  // Queries are answered from the fixture's own resources, never a server.
  const resources: Json[] = ctx.resources ?? [];
  const fetchResourceCallback = async (query: string) => {
    const type = query.split(/[?/]/)[0];
    return { resourceType: "Bundle", type: "searchset", entry: resources.filter((r) => r.resourceType === type).map((resource) => ({ resource })) };
  };
  const r = await populateQuestionnaire({
    questionnaire: q as any,
    fetchResourceCallback,
    fetchResourceRequestConfig: { sourceServerUrl: "urn:fixture" } as any,
    patient: ctx.patient,
    ...(ctx.user ? { user: ctx.user } : {}),
    ...(ctx.encounter ? { encounter: ctx.encounter } : {}),
    timeoutMs: 10000,
  });
  if (!r.populateSuccess || !r.populateResult) return result("populate", "fail", ["population did not succeed"]);
  const got = answersByLinkId(r.populateResult.populatedResponse as Json);
  const findings: string[] = [];
  for (const [linkId, answer] of answersByLinkId(expected)) {
    if (!contains(got.get(linkId), answer)) findings.push(`item "${linkId}": expected ${JSON.stringify(answer)}, populated ${JSON.stringify(got.get(linkId) ?? null)}`);
  }
  return result("populate", findings.length ? "fail" : "pass", findings);
}

/** Is the toolkit in a `node_modules` at or above `dir`? */
export function toolkitInstalled(dir: string): boolean {
  for (let d = resolve(dir); ; d = dirname(d)) {
    if (existsSync(join(d, "node_modules", "@aehrc", "questionnaire-test-toolkit", "package.json"))) return true;
    if (dirname(d) === d) return false;
  }
}

/** Behavioural tests, warn-only: the IG's own `behaviour.test.tsx`, run with bun when the toolkit is installed. */
export function checkBehaviour(fixture: string | undefined, run = spawnSync): SdcCheck {
  const file = fixture && join(fixture, "behaviour.test.tsx");
  if (!file || !existsSync(file)) return result("behaviour", "no-fixture", ["behaviour.test.tsx is needed"]);
  // Looked for on disk, never resolved: Bun auto-installs a package it cannot
  // find when no node_modules is above it, and this check reaches no network.
  if (!toolkitInstalled(fixture!)) {
    return result("behaviour", "could-not-determine", [
      `${SDC_LIBRARIES.behaviour} is not installed where ${file} can reach it, with its React and Smart Forms peers; install it with the IG's tests to run them`,
    ]);
  }
  const p = run("bun", ["--no-install", "test", resolve(file)], { encoding: "utf-8", cwd: fixture });
  const tail = `${p.stdout ?? ""}${p.stderr ?? ""}`.trim().split("\n").slice(-5);
  return result("behaviour", p.status === 0 ? "pass" : "fail", p.status === 0 ? [] : tail);
}

/** Every check, for every Questionnaire in the AST (or the ids asked for). */
export async function sdcChecks(astDir: string, o: { ids?: string[]; fixtures?: string; out?: string } = {}): Promise<SdcResult[]> {
  const manifest = readAst(astDir).manifest;
  const qs = manifest.resources
    .filter((r) => r.resourceType === "Questionnaire" && existsSync(join(astDir, r.file)))
    .map((r) => JSON.parse(readFileSync(join(astDir, r.file), "utf-8")) as Json);
  const byUrl = new Map(qs.filter((q) => q.url).map((q) => [`${q.url}|${q.version ?? ""}`, q]));
  const out: SdcResult[] = [];
  for (const q of qs) {
    if (o.ids?.length && !o.ids.includes(q.id)) continue;
    const fixture = o.fixtures && existsSync(join(o.fixtures, q.id)) ? join(o.fixtures, q.id) : undefined;
    const guard = async (name: SdcCheckName, f: () => Promise<SdcCheck> | SdcCheck): Promise<SdcCheck> => {
      try {
        return await f();
      } catch (e) {
        return result(name, "could-not-determine", [(e as Error).message]);
      }
    };
    out.push({
      questionnaire: q.id,
      checks: [
        await guard("assemble", () => checkAssemble(q, byUrl, o.out)),
        await guard("template-extract", () => checkExtract(q, fixture)),
        await guard("populate", () => checkPopulate(q, fixture)),
        await guard("behaviour", () => checkBehaviour(fixture)),
      ],
    });
  }
  return out;
}

/** 1 when any error-severity check failed or could not run; warnings never fail. */
export function exitCode(rs: SdcResult[]): 0 | 1 {
  return rs.some((r) => r.checks.some((c) => c.severity === "error" && (c.status === "fail" || c.status === "could-not-determine"))) ? 1 : 0;
}

if (import.meta.main) {
  const a = process.argv.slice(2);
  const opt = (n: string) => {
    const i = a.indexOf(n);
    return i >= 0 ? a[i + 1] : undefined;
  };
  const ast = opt("--ast");
  if (!ast || !existsSync(join(ast, "manifest.json"))) {
    console.error("usage: sdc-checks.ts --ast <output-ast> [--questionnaire <id>]… [--fixtures <dir>] [--out <dir>] [--json]  (no AST manifest: could not determine)");
    process.exit(2);
  }
  const ids = a.flatMap((x, i) => (x === "--questionnaire" && a[i + 1] ? [a[i + 1]!] : []));
  const rs = await sdcChecks(ast, { ids, fixtures: opt("--fixtures"), out: opt("--out") });
  if (a.includes("--json")) console.log(JSON.stringify(rs, null, 2));
  else
    for (const r of rs) {
      console.log(`Questionnaire/${r.questionnaire}`);
      for (const c of r.checks) console.log(`  ${c.check.padEnd(16)} ${c.status}${c.severity === "warning" ? " (warn-only)" : ""}${c.findings.length ? ` — ${c.findings.join("; ")}` : ""}`);
    }
  process.exit(exitCode(rs));
}
