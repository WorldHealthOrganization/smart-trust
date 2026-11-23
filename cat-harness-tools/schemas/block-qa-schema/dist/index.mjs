// js/index.ts
import { z } from "zod";
var QaReviewerKind = z.enum(["script", "agent", "human"]);
var QaReviewer = z.object({
  kind: QaReviewerKind,
  id: z.string(),
  version: z.string().optional(),
  // kind: "script" provenance — staleness drivers
  script_hash: z.string().optional(),
  script_commit_sha: z.string().optional(),
  deps_hash: z.string().optional(),
  // kind: "agent" provenance — model-level audit trail
  agent_model: z.string().optional(),
  agent_session: z.string().optional(),
  agent_date: z.string().optional(),
  agent_skill: z.string().optional()
}).passthrough();
var QaFieldHash = z.object({
  // Paper adapter companions.
  md: z.string().optional(),
  ts: z.string().optional(),
  lean: z.string().optional(),
  // WHO SMART Guidelines L2 DAK companions.
  bpmn: z.string().optional(),
  dmn: z.string().optional(),
  xlsx: z.string().optional(),
  // WHO SMART Guidelines L3 FHIR companions.
  fsh: z.string().optional(),
  cql: z.string().optional()
}).passthrough();
var QaScore = z.object({
  value: z.number(),
  max: z.number(),
  rubric: z.record(z.string(), z.number()).optional()
}).passthrough();
var QaEvidenceItem = z.object({
  line: z.number().int().optional(),
  text: z.string().optional()
}).passthrough();
var DaScope = z.enum(["limited", "structural"]);
var DaRuling = z.enum(["surviving", "rebutted", "partial"]);
var DaVerdict = z.enum(["clean-rebutted", "no-objection-raised", "clean", "survivable-objection", "open-objection"]);
var QaCriterionEntry = z.object({
  field_hash: QaFieldHash,
  result: z.enum(["pass", "fail", "warn", "n/a"]),
  severity: z.enum(["critical", "major", "minor"]).optional(),
  score: QaScore.optional(),
  evidence: z.union([z.string(), z.array(QaEvidenceItem)]).optional(),
  // Descriptive structural measures a checker emits alongside its verdict
  // (e.g. the detangler axis's tanglement_score / cone_size / pagerank /
  // graph_energy snapshot) — not a quality score.
  metrics: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
  // ── da-axis extension fields ──
  scope: DaScope.optional(),
  ruling: DaRuling.optional(),
  referee_argument: z.string().optional(),
  rebuttal: z.string().optional(),
  verdict: DaVerdict.optional(),
  reviewer: QaReviewer,
  // ISO-8601 UTC datetime; legacy agent entries may carry a bare ISO date.
  reviewed_at: z.string().optional(),
  // derived from reviewed_tree on read since 0.2.0 (owner rulings 2026-11-06, cards "QA dates" and "Date source")
  // Tree of repo HEAD at audit time (`HEAD^{tree}`). What producers write
  // since bean 69lr: a PR run's HEAD commit can vanish, its tree cannot.
  reviewed_tree: z.string().optional(),
  // Repo HEAD at audit time. No longer written (superseded by
  // `reviewed_tree`), kept readable for existing sidecars; legacy agent
  // entries (pre-2026-06) omit it, so it is optional here.
  reviewed_sha: z.string().optional(),
  notes: z.string().optional()
}).passthrough().refine((val) => !(val.ruling === "surviving" && val.result !== "fail"), { message: "result must agree with ruling on finding entries.", path: ["result"] }).refine((val) => !(val.ruling === "partial" && val.result !== "warn"), { message: "result must agree with ruling on finding entries.", path: ["result"] }).refine((val) => !(val.ruling === "rebutted" && val.result !== "pass"), { message: "result must agree with ruling on finding entries.", path: ["result"] }).refine((val) => !(val.verdict === "open-objection" && val.result !== "fail"), { message: "result must agree with verdict on the rollup entry.", path: ["result"] }).refine((val) => !(val.verdict === "survivable-objection" && val.result !== "warn"), { message: "result must agree with verdict on the rollup entry.", path: ["result"] }).refine((val) => !((val.verdict === "clean" || val.verdict === "clean-rebutted") && val.result !== "pass"), { message: "result must agree with verdict on the rollup entry.", path: ["result"] }).refine((val) => !(val.scope === "structural" && (!val.rebuttal || !val.referee_argument)), { message: "structural scope requires a non-empty rebuttal naming the invariant.", path: ["rebuttal"] });
var BlockQaReport = z.object({
  $schema: z.literal("block-qa/v1"),
  label: z.string(),
  kind: z.string(),
  paths: z.object({
    ts: z.string(),
    md: z.string().optional(),
    lean: z.string().optional()
  }).passthrough(),
  source_hashes: QaFieldHash,
  criteria: z.record(z.string(), z.array(QaCriterionEntry)),
  updated_at: z.string().optional()
}).passthrough();
var QaScriptSidecar = z.object({
  $schema: z.literal("qa-script/v1"),
  criterion_id: z.string(),
  source_file: z.string(),
  script_hash: z.string(),
  script_commit_sha: z.string(),
  extra_inputs: z.array(z.string()).optional(),
  deps_hash: z.string().optional(),
  last_run_at: z.string().optional(),
  last_run_sha: z.string(),
  engine_version: z.string().optional()
}).passthrough();
var VERSION = "0.2.0";
export {
  BlockQaReport,
  DaRuling,
  DaScope,
  DaVerdict,
  QaCriterionEntry,
  QaEvidenceItem,
  QaFieldHash,
  QaReviewer,
  QaReviewerKind,
  QaScore,
  QaScriptSidecar,
  VERSION
};
