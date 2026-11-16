/**
 * Dependency injection point for the bibliography.
 *
 * The reference database is CONTENT: in qou it is
 * `content/schema/references.ts`, ~7900 lines of CSL-JSON entries. It belongs
 * to the folio, the same way the values registry and the Lake package list do.
 *
 * Six pipeline files imported it directly as `../../schemas/references` — a
 * path that does not exist in this repo. They did not merely fail to
 * type-check; **every one of them threw `Cannot find module` at import**, so
 * `validate-bib`, `bib-qa`, `export-bibtex`, `export-json`,
 * `validate-references` and `validate-references-human-review` could not run
 * here at all. The whole bibliography subsystem was dead code, and nothing
 * said so, because `content/**` was outside the tsconfig program (bean
 * `folio-assistant-tsca`) and nothing else imports these entry points.
 *
 * This mirrors `value-registry-di.ts` exactly, including the Proxy that lets
 * consumers keep writing `references` as a value. Downstream runner scripts
 * call `configureReferenceRegistry` before invoking pipeline functions — see
 * qou's `scripts/run-validate.ts` for the established shape.
 *
 * @module pipeline/references-registry-di
 */

import type { z } from "zod";
import type { Data as CSLData } from "csl-json";

export type { CSLData };

export interface ReferenceRegistryAPI {
  /** Every entry, in declaration order. */
  references: CSLData[];
  /** `id` → entry. */
  referenceMap: Map<string, CSLData>;
  /** Zod schema the folio validates entries against at construction time. */
  CSLEntrySchema: z.ZodType<unknown>;
}

let currentApi: ReferenceRegistryAPI | null = null;

export function configureReferenceRegistry(api: ReferenceRegistryAPI): void {
  currentApi = api;
}

/**
 * Has a folio supplied references at all?
 *
 * `getReferenceRegistry` throws when unconfigured, which is right for a
 * lookup that must succeed — but a caller that can legitimately proceed
 * without references needs to ASK rather than catch. `validate.ts` is
 * one: it builds the constraint context, and `cites-resolve` no-ops when
 * `allRefIds` is absent. Without this predicate the validator could not
 * tell "this folio has no bibliography" from "the citation check did not
 * run", and reported the same clean result either way.
 */
export function referenceRegistryConfigured(): boolean {
  return currentApi !== null;
}

export function getReferenceRegistry(): ReferenceRegistryAPI {
  if (!currentApi) {
    throw new Error(
      "Reference registry not configured. " +
        "The downstream repo must call configureReferenceRegistry() before running pipeline functions.",
    );
  }
  return currentApi;
}

/**
 * The reference list, as a value.
 *
 * A Proxy over an array so the six consumers keep reading `references` the way
 * they always have — `.length`, index access, `for…of`, `.map`, `.filter` —
 * while the actual data is resolved lazily from the injected registry. Without
 * this every call site would have to become `getReferenceRegistry().references`
 * and the diff would be far larger than the defect.
 */
export const references: CSLData[] = new Proxy([] as CSLData[], {
  get: (_, prop) => {
    const arr = getReferenceRegistry().references;
    const v = Reflect.get(arr, prop);
    return typeof v === "function" ? v.bind(arr) : v;
  },
  has: (_, prop) => Reflect.has(getReferenceRegistry().references, prop),
  ownKeys: () => Reflect.ownKeys(getReferenceRegistry().references),
  getOwnPropertyDescriptor: (_, prop) =>
    Reflect.getOwnPropertyDescriptor(getReferenceRegistry().references, prop),
});

/** `id` → entry, resolved from the injected registry. */
export const referenceMap: Map<string, CSLData> = new Proxy(new Map(), {
  get: (_, prop) => {
    const map = getReferenceRegistry().referenceMap;
    const v = Reflect.get(map, prop);
    return typeof v === "function" ? v.bind(map) : v;
  },
}) as Map<string, CSLData>;

/** The folio's entry schema, resolved from the injected registry. */
export const CSLEntrySchema: z.ZodType<unknown> = new Proxy(
  {} as z.ZodType<unknown>,
  {
    get: (_, prop) => {
      const schema = getReferenceRegistry().CSLEntrySchema as unknown as Record<
        string | symbol,
        unknown
      >;
      const v = schema[prop];
      return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(schema) : v;
    },
  },
);
