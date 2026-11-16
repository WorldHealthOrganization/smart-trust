"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// js/index.ts
var index_exports = {};
__export(index_exports, {
  BlockQaReport: () => BlockQaReport,
  DaRuling: () => DaRuling,
  DaScope: () => DaScope,
  DaVerdict: () => DaVerdict,
  QaCriterionEntry: () => QaCriterionEntry,
  QaEvidenceItem: () => QaEvidenceItem,
  QaFieldHash: () => QaFieldHash,
  QaReviewer: () => QaReviewer,
  QaReviewerKind: () => QaReviewerKind,
  QaScore: () => QaScore,
  QaScriptSidecar: () => QaScriptSidecar,
  VERSION: () => VERSION
});
module.exports = __toCommonJS(index_exports);
var import_zod = require("zod");
var QaReviewerKind = import_zod.z.enum(["script", "agent", "human"]);
var QaReviewer = import_zod.z.object({
  kind: QaReviewerKind,
  id: import_zod.z.string(),
  version: import_zod.z.string().optional(),
  // kind: "script" provenance — staleness drivers
  script_hash: import_zod.z.string().optional(),
  script_commit_sha: import_zod.z.string().optional(),
  deps_hash: import_zod.z.string().optional(),
  // kind: "agent" provenance — model-level audit trail
  agent_model: import_zod.z.string().optional(),
  agent_session: import_zod.z.string().optional(),
  agent_date: import_zod.z.string().optional(),
  agent_skill: import_zod.z.string().optional()
}).passthrough();
var QaFieldHash = import_zod.z.object({
  // Paper adapter companions.
  md: import_zod.z.string().optional(),
  ts: import_zod.z.string().optional(),
  lean: import_zod.z.string().optional(),
  // WHO SMART Guidelines L2 DAK companions.
  bpmn: import_zod.z.string().optional(),
  dmn: import_zod.z.string().optional(),
  xlsx: import_zod.z.string().optional(),
  // WHO SMART Guidelines L3 FHIR companions.
  fsh: import_zod.z.string().optional(),
  cql: import_zod.z.string().optional()
}).passthrough();
var QaScore = import_zod.z.object({
  value: import_zod.z.number(),
  max: import_zod.z.number(),
  rubric: import_zod.z.record(import_zod.z.string(), import_zod.z.number()).optional()
}).passthrough();
var QaEvidenceItem = import_zod.z.object({
  line: import_zod.z.number().int().optional(),
  text: import_zod.z.string().optional()
}).passthrough();
var DaScope = import_zod.z.enum(["limited", "structural"]);
var DaRuling = import_zod.z.enum(["surviving", "rebutted", "partial"]);
var DaVerdict = import_zod.z.enum(["clean-rebutted", "no-objection-raised", "clean", "survivable-objection", "open-objection"]);
var QaCriterionEntry = import_zod.z.object({
  field_hash: QaFieldHash,
  result: import_zod.z.enum(["pass", "fail", "warn", "n/a"]),
  severity: import_zod.z.enum(["critical", "major", "minor"]).optional(),
  score: QaScore.optional(),
  evidence: import_zod.z.union([import_zod.z.string(), import_zod.z.array(QaEvidenceItem)]).optional(),
  // Descriptive structural measures a checker emits alongside its verdict
  // (e.g. the detangler axis's tanglement_score / cone_size / pagerank /
  // graph_energy snapshot) — not a quality score.
  metrics: import_zod.z.record(import_zod.z.string(), import_zod.z.union([import_zod.z.number(), import_zod.z.string()])).optional(),
  // ── da-axis extension fields ──
  scope: DaScope.optional(),
  ruling: DaRuling.optional(),
  referee_argument: import_zod.z.string().optional(),
  rebuttal: import_zod.z.string().optional(),
  verdict: DaVerdict.optional(),
  reviewer: QaReviewer,
  // ISO-8601 UTC datetime; legacy agent entries may carry a bare ISO date.
  reviewed_at: import_zod.z.string().optional(),
  // derived from reviewed_tree on read since 0.2.0 (owner rulings 2026-11-06, cards "QA dates" and "Date source")
  // Tree of repo HEAD at audit time (`HEAD^{tree}`). What producers write
  // since bean 69lr: a PR run's HEAD commit can vanish, its tree cannot.
  reviewed_tree: import_zod.z.string().optional(),
  // Repo HEAD at audit time. No longer written (superseded by
  // `reviewed_tree`), kept readable for existing sidecars; legacy agent
  // entries (pre-2026-06) omit it, so it is optional here.
  reviewed_sha: import_zod.z.string().optional(),
  notes: import_zod.z.string().optional()
}).passthrough().refine((val) => !(val.ruling === "surviving" && val.result !== "fail"), { message: "result must agree with ruling on finding entries.", path: ["result"] }).refine((val) => !(val.ruling === "partial" && val.result !== "warn"), { message: "result must agree with ruling on finding entries.", path: ["result"] }).refine((val) => !(val.ruling === "rebutted" && val.result !== "pass"), { message: "result must agree with ruling on finding entries.", path: ["result"] }).refine((val) => !(val.verdict === "open-objection" && val.result !== "fail"), { message: "result must agree with verdict on the rollup entry.", path: ["result"] }).refine((val) => !(val.verdict === "survivable-objection" && val.result !== "warn"), { message: "result must agree with verdict on the rollup entry.", path: ["result"] }).refine((val) => !((val.verdict === "clean" || val.verdict === "clean-rebutted") && val.result !== "pass"), { message: "result must agree with verdict on the rollup entry.", path: ["result"] }).refine((val) => !(val.scope === "structural" && (!val.rebuttal || !val.referee_argument)), { message: "structural scope requires a non-empty rebuttal naming the invariant.", path: ["rebuttal"] });
var BlockQaReport = import_zod.z.object({
  $schema: import_zod.z.literal("block-qa/v1"),
  label: import_zod.z.string(),
  kind: import_zod.z.string(),
  paths: import_zod.z.object({
    ts: import_zod.z.string(),
    md: import_zod.z.string().optional(),
    lean: import_zod.z.string().optional()
  }).passthrough(),
  source_hashes: QaFieldHash,
  criteria: import_zod.z.record(import_zod.z.string(), import_zod.z.array(QaCriterionEntry)),
  updated_at: import_zod.z.string().optional()
}).passthrough();
var QaScriptSidecar = import_zod.z.object({
  $schema: import_zod.z.literal("qa-script/v1"),
  criterion_id: import_zod.z.string(),
  source_file: import_zod.z.string(),
  script_hash: import_zod.z.string(),
  script_commit_sha: import_zod.z.string(),
  extra_inputs: import_zod.z.array(import_zod.z.string()).optional(),
  deps_hash: import_zod.z.string().optional(),
  last_run_at: import_zod.z.string().optional(),
  last_run_sha: import_zod.z.string(),
  engine_version: import_zod.z.string().optional()
}).passthrough();
var VERSION = "0.2.0";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
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
});
