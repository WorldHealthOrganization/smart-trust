/**
 * Run context — what ONE run ran on, stated once, and cited by digest.
 *
 * @module schemas/run-context
 * @graphNode schema
 *
 * Test-plan executions, QA reports and tool runs all need the same version
 * facts (the checker's hash and version, the commit under test — a block-qa
 * verdict's `reviewed_tree` names its tree, the legacy `reviewed_sha` its
 * commit — runtimes, the platform commit, the mount lock). This record states each fact once:
 *
 * | field | the fact | reused from |
 * |---|---|---|
 * | `platform` | the commit of the checkout that ran | `CommitShaSchema` |
 * | `mounts` | the mount lock's digest, and each mounted layer's pinned commit | `LockedInstanceSchema` |
 * | `profile` | the tool profile selected, by name and digest | — |
 * | `releases[]` | every tool and runtime release resolved, or why it could not be | `ToolReleaseRefSchema`, `ReleaseDigestSchema` |
 * | `invoker` | the script, model or person that ran it | `ActorKindSchema` |
 * | `inputs[]` | hash bases | `HashBasisSchema` |
 * | `prov` | the PROV activity that records this context as `prov:used` | — |
 *
 * ## Referenced by sha256, written once per run
 *
 * A report carries {@link RunContextRefSchema} — `{ sha256 }` — and never the
 * context itself, so thousands of `block-qa` sidecars from one sweep cite one
 * context. The digest is over {@link canonicalRunContext}'s bytes, so two
 * writers of one context agree on its reference.
 *
 * ## Three states, never two
 *
 * - A release that could not be provisioned is `could-not-provision` WITH a
 *   reason; a context that omitted it would read as one that never needed it.
 * - `mounts` is `none`, `locked` or `could-not-determine`. "No mount lock was
 *   found" and "this run mounts nothing" are different facts.
 * - A `system` invoker must give its `script_hash`; the token `unknown` is
 *   allowed and is not a hash.
 *
 * Run-context records are produced per run and have no directory: the
 * run-level record that writes one says where.
 */
import { createHash } from "node:crypto";

import { z } from "zod";

import { nodeKind } from "../kg/node-kind.js";

import { ReleaseDigestSchema } from "./binary-release";
import { CommitShaSchema, LockedInstanceSchema } from "../kg/remote-mount";
import { ActorKindSchema } from "../kg/skill-package";
import { HashBasisSchema, UNKNOWN_HASH } from "./test-run";
import { ToolReleaseRefSchema } from "../tools/tool-release";

/** The tag a run-context document carries. */
export const RUN_CONTEXT_SCHEMA_TAG = "folio-run-context/v1";

const Sha256Schema = z.string().regex(/^[0-9a-f]{64}$/, "a sha256 digest is 64 lowercase hex characters");

/**
 * How a report cites its run's context: by the sha256 of the context's
 * canonical bytes. The one field every run and report family will carry.
 */
export const RunContextRefSchema = z.object({ sha256: Sha256Schema }).strict();
export type RunContextRef = z.infer<typeof RunContextRefSchema>;

/** One mounted layer, as the run saw it: which layer, from where, at which commit. */
export const RunMountSchema = LockedInstanceSchema.pick({ instance: true, repository: true, sha: true });

/** The mounts a run ran over. Three states — see the module doc. */
export const RunMountsSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("none") }).strict(),
  z
    .object({
      state: z.literal("locked"),
      /** sha256 over the mount-lock file's bytes. */
      lock: z.object({ file: z.string().min(1), sha256: Sha256Schema }).strict(),
      instances: z.array(RunMountSchema).min(1),
    })
    .strict(),
  z.object({ state: z.literal("could-not-determine"), reason: z.string().min(1) }).strict(),
]);

/** One release the run resolved, or failed to. */
export const RunReleaseSchema = z.discriminatedUnion("state", [
  z
    .object({
      state: z.literal("provisioned"),
      release: ToolReleaseRefSchema,
      digest: ReleaseDigestSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal("could-not-provision"),
      release: ToolReleaseRefSchema,
      /** Why — no network, a hash mismatch, no record for this platform. Required: a failure without a reason cannot be acted on. */
      reason: z.string().min(1),
      /** The digest the record expected, where there was a record. */
      expected: ReleaseDigestSchema.optional(),
    })
    .strict(),
]);
export type RunRelease = z.infer<typeof RunReleaseSchema>;

/**
 * Who or what ran it. Replaces `script_hash` / `engine_version` /
 * `reviewer.version` / `by.version` with one shape.
 */
export const RunInvokerSchema = z
  .object({
    kind: ActorKindSchema,
    /** The script path, the model id, the person's handle. */
    id: z.string().min(1),
    version: z.string().min(1).optional(),
    /** Hash of the script's bytes, or `unknown`. Required for a `system` invoker. */
    script_hash: z
      .string()
      .refine((h) => h === UNKNOWN_HASH || /^[0-9a-f]{12,64}$/.test(h), `a hex digest (12 to 64 characters), or \`${UNKNOWN_HASH}\``)
      .optional(),
  })
  .strict()
  .superRefine((inv, ctx) => {
    if (inv.kind === "system" && inv.script_hash === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["script_hash"],
        message: `a \`system\` invoker is a script, and must say what it was — its hash, or \`${UNKNOWN_HASH}\` if that could not be read`,
      });
    }
  });

/** One run's context, as a `folio-run-context/v1` document. */
/** The fields of a run context: the {@link RunContextKind}'s own, and the schema's. */
const runContextFields = {
  $schema: z.literal(RUN_CONTEXT_SCHEMA_TAG),
  platform: z.object({ commit: CommitShaSchema }).strict(),
  mounts: RunMountsSchema,
  /** The tool profile selected. Absent: the run selected none, and `releases[]` lists what it resolved anyway. */
  profile: z.object({ name: z.string().min(1), sha256: Sha256Schema }).strict().optional(),
  releases: z.array(RunReleaseSchema),
  invoker: RunInvokerSchema,
  inputs: z.array(HashBasisSchema),
  /** The PROV activity that records this context as `prov:used`. Absent until the run records one (step 3). */
  prov: z.object({ activity: z.string().min(1) }).strict().optional(),
};

/** One run, one answer per release: no release is listed twice. */
function releasesListedOnce(c: { releases: readonly { release: string }[] }, ctx: z.RefinementCtx): void {
  const seen = new Set<string>();
  c.releases.forEach((r, i) => {
    if (seen.has(r.release)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["releases", i, "release"], message: `\`${r.release}\` is listed twice — one run, one answer per release` });
    }
    seen.add(r.release);
  });
}

export const RunContextSchema = z.object(runContextFields).strict().superRefine(releasesListedOnce);
export type RunContext = z.infer<typeof RunContextSchema>;

/**
 * `folio-run-context/v1` as a node kind, the validator of the library kind's
 * family of that name (`validators/library-run-context.json`). It judges a
 * file exactly as {@link RunContextSchema} does.
 */
export const RunContextKind = nodeKind(RUN_CONTEXT_SCHEMA_TAG, [], runContextFields, {
  strict: true,
  refine: releasesListedOnce,
  term: "Run context",
  summary: "What one run resolved: the platform commit, the mounted layers, the tool profile and releases, the invoker and the inputs it hashed.",
});

/** Key-sorted JSON, so the bytes do not depend on the order a writer set fields in. */
function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v !== null && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .map((k) => [k, canonical((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

/** The bytes a context's reference is computed over: key-sorted JSON, no whitespace. */
export function canonicalRunContext(c: RunContext): string {
  return JSON.stringify(canonical(c));
}

/** The reference a report carries for this context. */
export function runContextRef(c: RunContext): RunContextRef {
  return { sha256: createHash("sha256").update(canonicalRunContext(c)).digest("hex") };
}

/** Releases the run needed and did not get. A non-empty answer is a logged fact, not a pass. */
export function unprovisioned(c: RunContext): Extract<RunRelease, { state: "could-not-provision" }>[] {
  return c.releases.filter((r): r is Extract<RunRelease, { state: "could-not-provision" }> => r.state === "could-not-provision");
}

/**
 * Project `QaReport.toolchain` (`{ publisher?, sushi?, fhirVersion? }`) from a
 * {@link RunContext}'s provisioned releases (Step 7 of
 * `docs/proposals/tool-releases-2026-10-07.md`, C2: `QaReport.toolchain` is a
 * projection of `RunContext.releases[]` rather than a hand-maintained second
 * version list).
 */
export function toolchainFromRunContext(
  c: Pick<RunContext, "releases">,
  extra?: { fhirVersion?: string },
): { publisher?: string; sushi?: string; fhirVersion?: string } {
  const out: { publisher?: string; sushi?: string; fhirVersion?: string } = {};
  for (const r of c.releases) {
    if (r.state !== "provisioned") continue;
    const at = r.release.indexOf("@");
    if (at < 0) continue;
    const name = r.release.slice(0, at);
    const version = r.release.slice(at + 1);
    if (name === "fhir-ig-publisher" || name === "ig-publisher" || name === "publisher") {
      out.publisher = version;
    } else if (name === "fsh-sushi" || name === "sushi") {
      out.sushi = version;
    }
  }
  if (extra?.fhirVersion) out.fhirVersion = extra.fhirVersion;
  return out;
}
