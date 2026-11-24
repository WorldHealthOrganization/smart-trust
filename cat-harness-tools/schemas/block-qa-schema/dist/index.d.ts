/**
 * @litlfred/block-qa-schema — Zod schemas for the folio block-QA sidecar format.
 *
 * The canonical schemas are `schemas/block-qa-schema/schema/block-qa.schema.json`
 * (the per-block `<block>.qa.json` report) and
 * `schemas/block-qa-schema/schema/qa-script.schema.json` (the per-criterion
 * `<criterion-id>.script.json` checker-staleness sidecar). This file ships Zod
 * schemas that validate against the same shapes, so any TypeScript / JavaScript
 * consumer can parse + type-check the QA sidecars emitted by the folio
 * qa-sweep pipeline (`pipeline/qa-sweep.ts`; producing types in
 * `schemas/sdlc/block-qa.ts`).
 *
 * @example
 * ```ts
 * import { BlockQaReport } from "@litlfred/block-qa-schema";
 * import { readFileSync } from "fs";
 *
 * const raw = JSON.parse(readFileSync("carbon-valence.qa.json", "utf-8"));
 * const report = BlockQaReport.parse(raw);
 *
 * for (const [criterion, entries] of Object.entries(report.criteria)) {
 *   const latest = entries[entries.length - 1];
 *   console.log(criterion, "→", latest.result, latest.reviewer.kind);
 * }
 * ```
 */
import { z } from "zod";
export declare const QaReviewerKind: z.ZodEnum<{
    agent: "agent";
    human: "human";
    script: "script";
}>;
export type QaReviewerKind = z.infer<typeof QaReviewerKind>;
export declare const QaReviewer: z.ZodObject<{
    kind: z.ZodEnum<{
        agent: "agent";
        human: "human";
        script: "script";
    }>;
    id: z.ZodString;
    version: z.ZodOptional<z.ZodString>;
    script_hash: z.ZodOptional<z.ZodString>;
    script_commit_sha: z.ZodOptional<z.ZodString>;
    deps_hash: z.ZodOptional<z.ZodString>;
    agent_model: z.ZodOptional<z.ZodString>;
    agent_session: z.ZodOptional<z.ZodString>;
    agent_date: z.ZodOptional<z.ZodString>;
    agent_skill: z.ZodOptional<z.ZodString>;
}, z.core.$loose>;
export type QaReviewer = z.infer<typeof QaReviewer>;
export declare const QaFieldHash: z.ZodObject<{
    md: z.ZodOptional<z.ZodString>;
    ts: z.ZodOptional<z.ZodString>;
    lean: z.ZodOptional<z.ZodString>;
    bpmn: z.ZodOptional<z.ZodString>;
    dmn: z.ZodOptional<z.ZodString>;
    xlsx: z.ZodOptional<z.ZodString>;
    fsh: z.ZodOptional<z.ZodString>;
    cql: z.ZodOptional<z.ZodString>;
}, z.core.$loose>;
export type QaFieldHash = z.infer<typeof QaFieldHash>;
export declare const QaScore: z.ZodObject<{
    value: z.ZodNumber;
    max: z.ZodNumber;
    rubric: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
}, z.core.$loose>;
export type QaScore = z.infer<typeof QaScore>;
export declare const QaEvidenceItem: z.ZodObject<{
    line: z.ZodOptional<z.ZodNumber>;
    text: z.ZodOptional<z.ZodString>;
}, z.core.$loose>;
export type QaEvidenceItem = z.infer<typeof QaEvidenceItem>;
export declare const DaScope: z.ZodEnum<{
    limited: "limited";
    structural: "structural";
}>;
export type DaScope = z.infer<typeof DaScope>;
export declare const DaRuling: z.ZodEnum<{
    partial: "partial";
    rebutted: "rebutted";
    surviving: "surviving";
}>;
export type DaRuling = z.infer<typeof DaRuling>;
export declare const DaVerdict: z.ZodEnum<{
    clean: "clean";
    "clean-rebutted": "clean-rebutted";
    "no-objection-raised": "no-objection-raised";
    "open-objection": "open-objection";
    "survivable-objection": "survivable-objection";
}>;
export type DaVerdict = z.infer<typeof DaVerdict>;
export declare const QaCriterionEntry: z.ZodObject<{
    field_hash: z.ZodObject<{
        md: z.ZodOptional<z.ZodString>;
        ts: z.ZodOptional<z.ZodString>;
        lean: z.ZodOptional<z.ZodString>;
        bpmn: z.ZodOptional<z.ZodString>;
        dmn: z.ZodOptional<z.ZodString>;
        xlsx: z.ZodOptional<z.ZodString>;
        fsh: z.ZodOptional<z.ZodString>;
        cql: z.ZodOptional<z.ZodString>;
    }, z.core.$loose>;
    result: z.ZodEnum<{
        fail: "fail";
        "n/a": "n/a";
        pass: "pass";
        warn: "warn";
    }>;
    severity: z.ZodOptional<z.ZodEnum<{
        critical: "critical";
        major: "major";
        minor: "minor";
    }>>;
    score: z.ZodOptional<z.ZodObject<{
        value: z.ZodNumber;
        max: z.ZodNumber;
        rubric: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    }, z.core.$loose>>;
    evidence: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodObject<{
        line: z.ZodOptional<z.ZodNumber>;
        text: z.ZodOptional<z.ZodString>;
    }, z.core.$loose>>]>>;
    metrics: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>>;
    scope: z.ZodOptional<z.ZodEnum<{
        limited: "limited";
        structural: "structural";
    }>>;
    ruling: z.ZodOptional<z.ZodEnum<{
        partial: "partial";
        rebutted: "rebutted";
        surviving: "surviving";
    }>>;
    referee_argument: z.ZodOptional<z.ZodString>;
    rebuttal: z.ZodOptional<z.ZodString>;
    verdict: z.ZodOptional<z.ZodEnum<{
        clean: "clean";
        "clean-rebutted": "clean-rebutted";
        "no-objection-raised": "no-objection-raised";
        "open-objection": "open-objection";
        "survivable-objection": "survivable-objection";
    }>>;
    reviewer: z.ZodObject<{
        kind: z.ZodEnum<{
            agent: "agent";
            human: "human";
            script: "script";
        }>;
        id: z.ZodString;
        version: z.ZodOptional<z.ZodString>;
        script_hash: z.ZodOptional<z.ZodString>;
        script_commit_sha: z.ZodOptional<z.ZodString>;
        deps_hash: z.ZodOptional<z.ZodString>;
        agent_model: z.ZodOptional<z.ZodString>;
        agent_session: z.ZodOptional<z.ZodString>;
        agent_date: z.ZodOptional<z.ZodString>;
        agent_skill: z.ZodOptional<z.ZodString>;
    }, z.core.$loose>;
    reviewed_at: z.ZodOptional<z.ZodString>;
    reviewed_tree: z.ZodOptional<z.ZodString>;
    reviewed_sha: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$loose>;
export type QaCriterionEntry = z.infer<typeof QaCriterionEntry>;
export declare const BlockQaReport: z.ZodObject<{
    $schema: z.ZodLiteral<"block-qa/v1">;
    label: z.ZodString;
    kind: z.ZodString;
    paths: z.ZodObject<{
        ts: z.ZodString;
        md: z.ZodOptional<z.ZodString>;
        lean: z.ZodOptional<z.ZodString>;
    }, z.core.$loose>;
    source_hashes: z.ZodObject<{
        md: z.ZodOptional<z.ZodString>;
        ts: z.ZodOptional<z.ZodString>;
        lean: z.ZodOptional<z.ZodString>;
        bpmn: z.ZodOptional<z.ZodString>;
        dmn: z.ZodOptional<z.ZodString>;
        xlsx: z.ZodOptional<z.ZodString>;
        fsh: z.ZodOptional<z.ZodString>;
        cql: z.ZodOptional<z.ZodString>;
    }, z.core.$loose>;
    criteria: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodObject<{
        field_hash: z.ZodObject<{
            md: z.ZodOptional<z.ZodString>;
            ts: z.ZodOptional<z.ZodString>;
            lean: z.ZodOptional<z.ZodString>;
            bpmn: z.ZodOptional<z.ZodString>;
            dmn: z.ZodOptional<z.ZodString>;
            xlsx: z.ZodOptional<z.ZodString>;
            fsh: z.ZodOptional<z.ZodString>;
            cql: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>;
        result: z.ZodEnum<{
            fail: "fail";
            "n/a": "n/a";
            pass: "pass";
            warn: "warn";
        }>;
        severity: z.ZodOptional<z.ZodEnum<{
            critical: "critical";
            major: "major";
            minor: "minor";
        }>>;
        score: z.ZodOptional<z.ZodObject<{
            value: z.ZodNumber;
            max: z.ZodNumber;
            rubric: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
        }, z.core.$loose>>;
        evidence: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodObject<{
            line: z.ZodOptional<z.ZodNumber>;
            text: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>>]>>;
        metrics: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>>;
        scope: z.ZodOptional<z.ZodEnum<{
            limited: "limited";
            structural: "structural";
        }>>;
        ruling: z.ZodOptional<z.ZodEnum<{
            partial: "partial";
            rebutted: "rebutted";
            surviving: "surviving";
        }>>;
        referee_argument: z.ZodOptional<z.ZodString>;
        rebuttal: z.ZodOptional<z.ZodString>;
        verdict: z.ZodOptional<z.ZodEnum<{
            clean: "clean";
            "clean-rebutted": "clean-rebutted";
            "no-objection-raised": "no-objection-raised";
            "open-objection": "open-objection";
            "survivable-objection": "survivable-objection";
        }>>;
        reviewer: z.ZodObject<{
            kind: z.ZodEnum<{
                agent: "agent";
                human: "human";
                script: "script";
            }>;
            id: z.ZodString;
            version: z.ZodOptional<z.ZodString>;
            script_hash: z.ZodOptional<z.ZodString>;
            script_commit_sha: z.ZodOptional<z.ZodString>;
            deps_hash: z.ZodOptional<z.ZodString>;
            agent_model: z.ZodOptional<z.ZodString>;
            agent_session: z.ZodOptional<z.ZodString>;
            agent_date: z.ZodOptional<z.ZodString>;
            agent_skill: z.ZodOptional<z.ZodString>;
        }, z.core.$loose>;
        reviewed_at: z.ZodOptional<z.ZodString>;
        reviewed_tree: z.ZodOptional<z.ZodString>;
        reviewed_sha: z.ZodOptional<z.ZodString>;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$loose>>>;
    updated_at: z.ZodOptional<z.ZodString>;
}, z.core.$loose>;
export type BlockQaReport = z.infer<typeof BlockQaReport>;
export declare const QaScriptSidecar: z.ZodObject<{
    $schema: z.ZodLiteral<"qa-script/v1">;
    criterion_id: z.ZodString;
    source_file: z.ZodString;
    script_hash: z.ZodString;
    script_commit_sha: z.ZodString;
    extra_inputs: z.ZodOptional<z.ZodArray<z.ZodString>>;
    deps_hash: z.ZodOptional<z.ZodString>;
    last_run_at: z.ZodOptional<z.ZodString>;
    last_run_sha: z.ZodString;
    engine_version: z.ZodOptional<z.ZodString>;
}, z.core.$loose>;
export type QaScriptSidecar = z.infer<typeof QaScriptSidecar>;
export declare const VERSION = "0.2.0";
