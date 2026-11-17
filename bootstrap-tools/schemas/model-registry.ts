/**
 * Which languages a MODEL is good at, and whether anybody checked.
 *
 * @module schemas/model-registry
 * @graphNode schema
 *
 * Owner, 2026-09-21: *"note if agent was not trained primaruily in english,
 * the agent/person staring the bootstrap on that model should potentially use
 * other lanuges than english (especially if human validated) should clarify
 * each new model added to bootstrap which of the preferred languages"*.
 * Bean `46uh`.
 *
 * ## Why the registry lives in bootstrap, and this file does not
 *
 * The REGISTRY (`bootstrap/models/models.json`) lives in bootstrap for the
 * reason everything else there does: an agent reaching for the language it
 * should communicate in **has not yet loaded the Harness that would
 * otherwise answer**. Kept anywhere higher, it would be unreachable in
 * exactly the case it exists for — the opening steps of a session on a model
 * nobody has looked at.
 *
 * THIS FILE is code, and bootstrap holds none (its FR-7). Zod lives in
 * bootstrap-tools, beside bootstrap rather than in it, so it lives here and `gen-bootstrap-schemas.ts` publishes it into bootstrap as
 * `schemas/model-registry.schema.json`, which is what a reader with nothing
 * installed opens. Moved 2026-09-23 on the owner's ruling (bean iwtn).
 *
 * ## "Especially if human validated" is the whole design
 *
 * A model's own claim about which languages it handles well **is not
 * evidence**. It is a generated assertion about a generated system, and this
 * repository draws the line between a determined answer and an assumed one
 * everywhere else — a QA sidecar's `reviewer.kind`, an interaction
 * preference's `source`, a lane that DECLARES its performer varies rather
 * than merely having no role.
 *
 * So {@link ModelEntry.validation} is required and has three values, and the
 * middle one is the point: `self-reported` is not a weaker `human-validated`,
 * it is a DIFFERENT KIND OF CLAIM. Collapsing them to a boolean would make
 * "somebody checked" and "the model said so" the same fact.
 *
 * ## What this does NOT license
 *
 * **An agent choosing a language because its model prefers one.** The owner
 * was explicit and the reasoning is not subtle: a model strong in a language
 * the person cannot read is *worse* than the fallback, not better. These
 * languages are ONE INPUT to a determination the
 * [`communication-language`](../skills/communication-language.md) skill makes,
 * ranked below the person's stated preference and below the language of their
 * own turns. A registry that was read as the answer would be a regression
 * dressed as a feature.
 */
import { tagCompatible } from "./release-iri.ts";
import { z } from "zod";

/**
 * How a language claim came to be believed.
 *
 * Ordered weakest to strongest so a reader cannot mistake the middle value
 * for an endorsement.
 */
export const VALIDATION_STATES = ["unverified", "self-reported", "human-validated"] as const;
export type ValidationState = (typeof VALIDATION_STATES)[number];

/**
 * The value a record carries when the model that produced it was not
 * disclosed. Declared, so it is a decision rather than a string that looks
 * like one (#1168 B10c).
 */
export const NOT_DISCLOSED = "not-disclosed";

/**
 * A model identifier as a record carries it: exactly as the runtime reports
 * it (`claude-opus-5`, `claude-haiku-4-5-20251001`, a vendor-prefixed id), or
 * {@link NOT_DISCLOSED}. The SHAPE is checked here — no spaces, no empty, no
 * display name. Whether the id is one the registry KNOWS is a separate,
 * advisory question (`check-model-languages`), because the registry is
 * deliberately populated only by people (owner, 2026-09-30, #1168 B10c).
 */
export const ModelIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/@-]*$/, "a model id is the runtime's identifier: no spaces, no display name");
export type ModelId = z.infer<typeof ModelIdSchema>;

export const ModelEntrySchema = z.object({
  /** The model identifier, exactly as the runtime reports it. */
  id: ModelIdSchema,
  /** Human-readable name, for a report a person reads. */
  title: z.string().min(1),
  /**
   * BCP 47 tags, best first.
   *
   * MAY be empty, and an empty list is a DETERMINED empty rather than an
   * absence: it says somebody looked and found no language this model is
   * notably strong in, which is different from nobody having looked. That
   * second state is `validation: "unverified"`.
   *
   * ABSENT only on an `unverified` entry, which then records the model's
   * IDENTITY and claims nothing about its languages (#1168 B10c, owner
   * 2026-09-30: "resolve properly"). That is what lets a record's model id
   * resolve to a registry node without anybody asserting language evidence —
   * the thing this registry forbids an agent to supply. A `self-reported` or
   * `human-validated` entry IS a language claim, so it must carry the list.
   */
  preferredLanguages: z.array(z.string().min(2)).optional(),
  /** How the list above came to be believed. Required — see the header. */
  validation: z.enum(VALIDATION_STATES),
  /** Who checked, when `validation` is `human-validated`. */
  validatedBy: z.string().optional(),
  /** ISO date of that check. A validation with no date cannot go stale. */
  validatedOn: z.string().optional(),
  /** Anything a reader needs that the fields above cannot carry. */
  note: z.string().optional(),
}).refine((m) => m.validation === "unverified" || m.preferredLanguages !== undefined, {
  message: "a self-reported or human-validated entry is a language claim, and must state preferredLanguages",
  path: ["preferredLanguages"],
});

export type ModelEntry = z.infer<typeof ModelEntrySchema>;

/**
 * bootstrap's tag for the registry (bean `r3gy`, D2): the schema's name and
 * its own semver. A reader accepts any tag of the same MAJOR version.
 */
export const MODEL_REGISTRY_SCHEMA_NAME = "model-registry";
export const MODEL_REGISTRY_SCHEMA_VERSION = "1.0.0";
export const MODEL_REGISTRY_SCHEMA = `${MODEL_REGISTRY_SCHEMA_NAME}/${MODEL_REGISTRY_SCHEMA_VERSION}`;
/** The tag before 2026-09-29, naming the platform above bootstrap. Read, never written; drop after one release. */
export const LEGACY_MODEL_REGISTRY_SCHEMA = "folio-model-registry/v1";

export const ModelRegistrySchema = z.object({
  // The published schema names only the new tag; the old one is accepted by
  // `parseModelRegistry` alone, so bootstrap never states a platform name.
  $schema: z.literal(MODEL_REGISTRY_SCHEMA),
  models: z.array(ModelEntrySchema),
});

export type ModelRegistry = z.infer<typeof ModelRegistrySchema>;

/** Directory, relative to the layer root, holding the registry. */
export const MODEL_REGISTRY_DIR = "models";
/** Its filename. Declared in the file, not inferred from the extension. */
export const MODEL_REGISTRY_FILENAME = "models.json";

/**
 * A claim strong enough to act on, or `undefined`.
 *
 * `human-validated` only. `self-reported` and `unverified` are REPORTED by
 * the session sweep and never acted on, because the whole reason the owner
 * asked for a validation state is that a model's own word is not evidence —
 * and a helper that silently accepted it would put the distinction back where
 * it was.
 */
export function validatedLanguages(entry: ModelEntry): readonly string[] | undefined {
  return entry.validation === "human-validated" ? (entry.preferredLanguages ?? []) : undefined;
}

/**
 * Parse a registry, or say why it cannot be parsed.
 *
 * Throws rather than returning a default. A registry this code could not read
 * is not a registry with no models: reporting it as empty would make "nobody
 * has declared a model" and "the file is malformed" the same answer, and an
 * agent would then fall through to English believing a determination had been
 * made.
 */
export function parseModelRegistry(raw: unknown, where: string): ModelRegistry {
  const tag = raw && typeof raw === "object" ? (raw as { $schema?: unknown }).$schema : undefined;
  const tagged =
    tag === LEGACY_MODEL_REGISTRY_SCHEMA || (tag !== MODEL_REGISTRY_SCHEMA && tagCompatible(tag, MODEL_REGISTRY_SCHEMA_NAME, 1))
      ? { ...(raw as object), $schema: MODEL_REGISTRY_SCHEMA }
      : raw;
  const parsed = ModelRegistrySchema.safeParse(tagged);
  if (!parsed.success) throw new Error(`${where} is not a valid model registry: ${parsed.error.message}`);
  const ids = new Set<string>();
  for (const m of parsed.data.models) {
    if (ids.has(m.id)) throw new Error(`${where}: model id "${m.id}" is declared twice.`);
    ids.add(m.id);
    if (m.validation === "human-validated" && (m.validatedBy === undefined || m.validatedOn === undefined)) {
      // A human validation with nobody's name on it cannot be questioned, and
      // one with no date cannot go stale. Both are required precisely because
      // this is the only state an agent is allowed to act on.
      throw new Error(
        `${where}: model "${m.id}" is human-validated but does not say by whom and when ` +
          `(validatedBy, validatedOn are required for that state).`,
      );
    }
  }
  return parsed.data;
}
