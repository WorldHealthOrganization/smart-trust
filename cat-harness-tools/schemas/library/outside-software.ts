/**
 * Outside software — the core every record of somebody else's software shares:
 * its name, its version, its SPDX licence and where that was read, the digest
 * of its bytes, and where the bytes come from. **Never the bytes.**
 *
 * @module schemas/outside-software
 * @graphNode schema
 *
 * Two kinds record outside software, and both extend this core:
 *
 * | kind | `$schema` | what the platform does with it | adds |
 * |---|---|---|---|
 * | `tool-release` | `folio-tool-release/v1` | RUNS it | `role`, `kind`, `entry`, `runtimes`, `platform`, `note` |
 * | `software-library` | `software-library/1.2.0` | IMPORTS it, or keeps it vendored | `range`, `dev`, `usedBy`, `shim`, `vendored`, `layer` |
 *
 * They stay two kinds because their rules differ (a library is never run, and
 * a lockfile's integrity is sha512). Each kind NARROWS a core field where its
 * own rule needs it: `tool-release` narrows `name` to a tool name and `digest`
 * to sha256; `software-library` narrows `name` to an npm package name and
 * `source` to a URL.
 *
 * ## What is written once against the core
 *
 * - {@link outsideSoftwareRef} and {@link parseOutsideSoftwareRef} — the
 *   `name@version` ref. Split at the LAST `@`, because a scoped npm name
 *   (`@scope/pkg`) starts with one.
 * - {@link outsideSoftwareLicenceProblem} — the licence checked against the
 *   PINNED SPDX License List with `check:source-licence`'s own
 *   `checkLicenceExpression`, never a second parser.
 */
import { z } from "zod";

import { ReleaseDigestSchema } from "../sdlc/binary-release";
import { nodeKind } from "../kg/node-kind";
import { checkLicenceExpression, type SpdxLicenseList } from "./spdx-license-expression";

/** A version as the publisher spells it (`21.0.4+7`, `1.2024.7`, `3.53.4-build2`). No whitespace, `@` or `/`. */
export const SoftwareVersionSchema = z.string().regex(/^[^\s@/]+$/, "a version: no whitespace, `@` or `/`");

/**
 * A sha512 over the artefact's bytes, as 128 lowercase hex characters.
 *
 * What a `bun.lock` integrity records (`sha512-<base64>`), re-spelled in hex so
 * both algorithms read the same way. The shape mirrors
 * `binary-release`'s {@link ReleaseDigestSchema}, which is the sha256 arm.
 */
export const Sha512DigestSchema = z
  .object({
    algorithm: z.literal("sha512"),
    digest: z.string().regex(/^[0-9a-f]{128}$/, "a sha512 digest is 128 lowercase hex characters"),
    verifiedAt: z.string().min(1).optional(),
  })
  .strict();

/**
 * The digest of the artefact's bytes: sha256 or sha512.
 *
 * The core accepts either; a kind may narrow it. `tool-release` does, to
 * sha256 alone, because its resolver compares against the publisher's sha256.
 */
export const SoftwareDigestSchema = z.discriminatedUnion("algorithm", [ReleaseDigestSchema, Sha512DigestSchema]);
export type SoftwareDigest = z.infer<typeof SoftwareDigestSchema>;

/** `<registry>/<repository>@sha256:<64 hex>` — the only OCI form a record accepts. Group 3 is the hex. */
export const OCI_BY_DIGEST = /^[a-z0-9][a-z0-9.-]*(:[0-9]+)?(\/[a-z0-9._-]+)+@sha256:([0-9a-f]{64})$/;

/** A file fetched over https. */
export const SoftwareUrlSourceSchema = z
  .object({
    type: z.literal("url"),
    url: z.string().url().refine((u) => u.startsWith("https://"), "fetch over https"),
  })
  .strict();

/**
 * Where the artefact is fetched from.
 *
 * A URL for a file; an OCI reference for an image. The OCI form is accepted
 * ONLY by digest: `ghcr.io/x/y:1.0` is refused, because the bytes behind a
 * tag can change and the record would go on vouching for them.
 */
export const SoftwareSourceSchema = z.discriminatedUnion("type", [
  SoftwareUrlSourceSchema,
  z
    .object({
      type: z.literal("oci"),
      reference: z
        .string()
        .regex(OCI_BY_DIGEST, "an OCI image is identified by its digest — `<registry>/<repository>@sha256:<64 hex>`, never by a tag"),
    })
    .strict(),
]);
export type SoftwareSource = z.infer<typeof SoftwareSourceSchema>;

/**
 * An SPDX licence expression, one line.
 *
 * Zod checks only that it is one line; whether every id is ON the pinned SPDX
 * License List needs the list, which is read from disk, so
 * {@link outsideSoftwareLicenceProblem} does it.
 */
export const SpdxLicenceSchema = z
  .string()
  .min(1)
  .refine((l) => !/[\r\n]/.test(l), "a licence expression is one line");

/**
 * The core of every outside-software record.
 *
 * Not a document family on its own — it carries no `$schema` — so a file is
 * never "an outside-software record"; it is a tool release or a library, and
 * each kind extends this.
 */
export const OutsideSoftwareCoreSchema = z.object({
  /** The software's name. Each kind narrows it to its own naming rule. */
  name: z.string().min(1),
  version: SoftwareVersionSchema,
  /** The digest of the bytes. Required: a record with no digest gives nothing to compare a download against. */
  digest: SoftwareDigestSchema,
  source: SoftwareSourceSchema,
  /** An SPDX licence expression, one line. Checked against the pinned list by {@link outsideSoftwareLicenceProblem}. */
  licence: SpdxLicenceSchema,
  /** Where the licence was read from — the jar's own `-license`, the archive's `legal/`, the package's own `package.json`. */
  licenceSource: z.string().min(1),
});
export type OutsideSoftwareCore = z.infer<typeof OutsideSoftwareCoreSchema>;

/**
 * The core as a node-kind MIXIN (`schemas/kg/node-kind.ts`): unversioned, so it
 * has no `$schema` of its own, and a kind that names it as a parent inherits
 * every field above. `software-library` does. `tool-release` predates node
 * kinds and extends {@link OutsideSoftwareCoreSchema} directly.
 */
export const OutsideSoftwareKind = nodeKind("outside-software", [], OutsideSoftwareCoreSchema.shape);

/** The ref a record is addressed by: `<name>@<version>`. */
export function outsideSoftwareRef(r: Pick<OutsideSoftwareCore, "name" | "version">): string {
  return `${r.name}@${r.version}`;
}

/**
 * Split a `<name>@<version>` ref at its LAST `@`.
 *
 * The last, because a scoped npm name begins with one (`@types/mdast@4.0.4`).
 * A version never contains `@` ({@link SoftwareVersionSchema}), so the last
 * `@` is always the separator. `undefined` when there is none, or when either
 * side would be empty.
 */
export function parseOutsideSoftwareRef(ref: string): { name: string; version: string } | undefined {
  const at = ref.lastIndexOf("@");
  if (at <= 0 || at === ref.length - 1) return undefined;
  return { name: ref.slice(0, at), version: ref.slice(at + 1) };
}

/**
 * Is the licence a valid expression over the pinned SPDX License List?
 *
 * `undefined` when it is; otherwise the problem, in the words
 * `checkLicenceExpression` gives. A deprecated id is reported by that function
 * and NOT refused here, matching `check:source-licence`.
 */
export function outsideSoftwareLicenceProblem(r: Pick<OutsideSoftwareCore, "licence">, list: SpdxLicenseList): string | undefined {
  return checkLicenceExpression(r.licence, list).problem;
}
