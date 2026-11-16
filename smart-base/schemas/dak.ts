/**
 * The **DAK** content type — a repository that is a WHO SMART Guidelines
 * Digital Adaptation Kit.
 *
 * **This is a placeholder, and the placeholder is the point.** A repo declares
 * itself a DAK by carrying a {@link DAK_INDEX_SECTION} section in its root
 * `index.config.json`, as it declares itself a harness layer by carrying
 * `harness.json`. That
 * much is settled and is modelled here, and so is the wrapper each of WHO's
 * nine components uses (url, canonical or inline instance). What this module
 * does *not* model is the inside of an inline instance, nor the tenth component,
 * scheduling logic, which WHO's model lacks (`DAK_UNFORMALIZED_COMPONENTS`):
 * it **records the components without restating their contents**.
 *
 * ## Why a placeholder rather than waiting
 *
 * Because the marker is what a consumer needs first, and it does not depend on
 * the model. "Is this repository a DAK, and where does it publish?" is
 * answerable today; "what is inside `healthInterventions[0]`?" is not. Blocking
 * the first on the second would leave the type unrepresented for however long
 * the LM takes, and a type nothing can name is a type nothing can scan for.
 *
 * ## What this deliberately does NOT model
 *
 * **The inside of a component's inline instance.** Each of WHO's nine is
 * declared `0..* <Name>Source` in `smart-base`'s `input/fsh/models/DAK.fsh`,
 * and every `<Name>Source` in `DAKComponentSources.fsh` is the same wrapper:
 * a `url`, a `canonical`, or an inline `instance`, exactly one. Both models are
 * `#active` (bean `cz17`, 2026-10-24), so the cardinality and the wrapper
 * are enforced ({@link DakComponentSourceSchema}). The `instance` itself is
 * still `unknown` and is carried through untouched: typing nine instance
 * models here would be a second copy of WHO's, which is the argument
 * `schemas/dak-blocks.ts` already makes about `ValueSet.compose.include`.
 * Scheduling logic, which WHO's model does not have yet
 * (`DAK_UNFORMALIZED_COMPONENTS`), has no wrapper to follow, so its elements
 * stay `unknown`.
 *
 * **Anything else a real DAK declaration carries.** The schema is
 * {@link DakDeclarationSchema | passthrough}: unknown keys survive a
 * parse-and-write round trip. A placeholder that silently dropped the fields it
 * had not learned about yet would be worse than no placeholder — it would
 * destroy data from a real DAK on the first tool that read and rewrote one.
 *
 * ## Where the component vocabulary lives
 *
 * `smart-base/schemas/dak-kinds.ts` (core's `block-kinds.ts` until bean
 * `1335`), not here: {@link DAK_COMPONENTS} names the ten,
 * {@link DAK_COMPONENT_FIELDS} maps each to its field in WHO's own model, and
 * `smart-base/schemas/dak-blocks.test.ts` checks those names against a real
 * `DAK.fsh` when a `smart-base` checkout is present — reporting `n/a`, never a
 * pass, when it is not. This module builds its shape **from** that table rather
 * than restating it, so the two cannot drift.
 *
 * @module schemas/dak
 * @graphNode schema
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

import {
  DAK_COMPONENTS,
  DAK_COMPONENT_FIELDS,
  DAK_UNFORMALIZED_COMPONENTS,
  type DakComponent,
} from "./dak-kinds";
import { kgNodeLabelShape, type KgNodeLabels } from "../platform/schema.js";
import { SMART_BASE_NS } from "../platform/schema.js";

/**
 * The `contentTypes` key of the root `index.config.json` whose presence
 * declares a repository a DAK; its value is the DAK declaration.
 *
 * ## `dak.json` → `dak.config.json` → a section of `index.config.json`
 *
 * 2026-09-22, the owner: `dak.json` was renamed `dak.config.json`, for
 * consistency with `<name>.config.json`. It was renameable because the type is
 * OURS (bean `cz17`), unlike `sushi-config.yaml`, which is SUSHI's.
 *
 * 2026-10-24, the owner: *"do B"*, the declaration moves into
 * `index.config.json`, and WHO adopts that file. The platform carries the
 * section without knowing what it holds (`contentTypes` in cat-harness's
 * `index-config.ts`); this layer validates it ({@link DakDeclarationSchema}).
 * Its presence is the marker (`IndexSectionMarker` in `content-type.ts`),
 * the same assertion a marker file made.
 *
 * No second spelling is read. Accepting `dak.json` as well would make "this
 * repository has migrated" and "it has not" indistinguishable, which is the
 * state a rename exists to end.
 */
export const DAK_INDEX_SECTION = "dak";

/** The root file the {@link DAK_INDEX_SECTION} section lives in. */
export const DAK_INDEX_FILE = "index.config.json";

/** The `@type` a DAK declaration projects to — WHO's own logical model. */
export const DAK_TYPE = `${SMART_BASE_NS}DAK`;

/** The three ways WHO's `<Name>Source` types point at a component's content. */
export const DAK_COMPONENT_SOURCE_KEYS = ["url", "canonical", "instance"] as const;

/**
 * One entry of a formalized component: WHO's `<Name>Source` wrapper, from
 * `smart-base` `input/fsh/models/DAKComponentSources.fsh`.
 *
 * Exactly one of `url`, `canonical` or `instance`, as the FSH description of
 * every wrapper says. `instance` is `unknown` (see the module note). Other keys
 * survive, for the same no-data-loss reason as the declaration itself.
 */
export const DakComponentSourceSchema = z
  .object({
    url: z.string().min(1).optional(),
    canonical: z.string().min(1).optional(),
    instance: z.unknown().optional(),
  })
  .passthrough()
  .refine((s) => DAK_COMPONENT_SOURCE_KEYS.filter((k) => s[k] !== undefined).length === 1, {
    message: "a DAK component source carries exactly one of url, canonical or instance",
  });

export type DakComponentSource = z.infer<typeof DakComponentSourceSchema>;

/**
 * One component's contents, as read from a DAK declaration.
 *
 * A formalized component's entries are {@link DakComponentSource}s; an
 * unformalized one's are `unknown`. Every component is `0..*`.
 */
export type DakComponentEntries = unknown[];

/**
 * A DAK declaration, as much of it as is settled.
 *
 * The component fields are reachable by their WHO names through
 * {@link DAK_COMPONENT_FIELDS}; {@link componentEntries} does that lookup so a
 * caller never hardcodes one.
 */
export interface DakDeclaration extends KgNodeLabels {
  /** The instance's name, e.g. the immunizations DAK's own instance name. */
  name: string;
  /** Where the published DAK lives — the base its `@id`s are minted against. */
  canonicalUrl?: string;
  /** Where the built IG is published, when that differs from `canonicalUrl`. */
  publicationUrl?: string;
  /** Where CI previews are served. */
  previewUrl?: string;
  /** The components, keyed by their field name (WHO's, or prospective for an unformalized one). */
  [component: string]: unknown;
}

/**
 * The component fields, built from {@link DAK_COMPONENT_FIELDS} rather
 * than written out, so a component added to the vocabulary appears here with
 * no edit. A formalized component takes WHO's source wrapper; an unformalized
 * one takes anything.
 */
const componentShape: Record<string, z.ZodTypeAny> = Object.fromEntries(
  DAK_COMPONENTS.map((c) => [
    DAK_COMPONENT_FIELDS[c],
    DAK_UNFORMALIZED_COMPONENTS.includes(c)
      ? z.array(z.unknown()).optional()
      : z.array(DakComponentSourceSchema).optional(),
  ]),
);

export const DakDeclarationSchema = z
  .object({
    name: z.string().min(1),
    canonicalUrl: z.string().url().optional(),
    publicationUrl: z.string().url().optional(),
    previewUrl: z.string().url().optional(),
    ...kgNodeLabelShape,
    ...componentShape,
  })
  // Unknown keys survive. A real DAK declaration carries more than this module has
  // learned about, and a placeholder that dropped it would destroy data on the
  // first tool that read and rewrote one.
  .passthrough();

/** A component's entries, or `[]` when the declaration does not carry it. */
export function componentEntries(
  declaration: DakDeclaration,
  component: DakComponent,
): DakComponentEntries {
  const value = declaration[DAK_COMPONENT_FIELDS[component]];
  return Array.isArray(value) ? value : [];
}

/**
 * Which components a declaration actually populates.
 *
 * Coverage is answerable rather than assumed — a component present but empty
 * is **declared and empty**, which is a different fact from absent, and both
 * are different from "this repository is not a DAK at all".
 */
export function populatedComponents(declaration: DakDeclaration): DakComponent[] {
  return DAK_COMPONENTS.filter((c) => componentEntries(declaration, c).length > 0);
}

/**
 * Read a repository's DAK declaration: the {@link DAK_INDEX_SECTION} section
 * of its root `index.config.json`.
 *
 * No index, or an index without the section → `undefined`: a repository that
 * is not a DAK is not an error. An index that is not valid JSON, or a section
 * that is malformed → **throws**: a marker nobody can read leaves every
 * consumer guessing at what the repository is, which is worse than not having
 * one. Same contract as `readDeclaration` in `schemas/cat-harness.ts`.
 */
export function readDakDeclaration(repoRoot: string): DakDeclaration | undefined {
  const p = join(repoRoot, DAK_INDEX_FILE);
  if (!existsSync(p)) return undefined;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(p, "utf-8"));
  } catch (e) {
    throw new Error(`${p} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  const sections = (raw as { contentTypes?: unknown } | null)?.contentTypes;
  const section =
    sections !== null && typeof sections === "object" ? (sections as Record<string, unknown>)[DAK_INDEX_SECTION] : undefined;
  if (section === undefined) return undefined;
  const parsed = DakDeclarationSchema.safeParse(section);
  if (!parsed.success) {
    throw new Error(`${p} contentTypes.${DAK_INDEX_SECTION} is not a valid DAK declaration: ${parsed.error.message}`);
  }
  return parsed.data as DakDeclaration;
}
