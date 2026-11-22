/**
 * This layer's own namespaces, derived from its declaration.
 *
 * Until folio-assistant#2598 (owner, 2026-10-16, "2a" and "1a") the harness
 * listed them in its `own-namespaces` code list and named this layer to do it.
 * A lower layer may not name a higher one, so the content layer registers its
 * own: `<iriBase>v<major>/ns#` from `folio-assistant-core.json`, by the one
 * rule every layer's namespace follows (`instanceNamespaceOf` in the
 * harness's `schemas/namespaces.ts`). The IRIs are byte-identical to the ones
 * the code list held, which `own-namespace.test.ts` pins.
 *
 * @module schemas/own-namespace
 * @graphNode none — two IRI constants, not a schema
 */
import { readFileSync } from "node:fs";
import { instanceNamespaceOf } from "@litlfred/cat-harness-tools/schemas/kg/namespaces.js";

const declaration = JSON.parse(readFileSync(new URL("../folio-assistant-core.json", import.meta.url), "utf-8")) as {
  name: string;
  stub?: string;
  iriBase?: string;
  version?: string;
};

/** The namespace this layer's terms, kinds and block-kind classes are minted in. */
export const CORE_NAMESPACE: string = instanceNamespaceOf(declaration);

/**
 * Where a DSpace qualified Dublin Core field name with no DCMI equivalent is
 * minted: under this layer's release, beside its vocabulary, because this
 * is the layer that owns the Dublin Core model (`dublin-core.ts`).
 */
export const DSPACE_NAMESPACE: string = `${CORE_NAMESPACE}dspace/`;
