/**
 * The `folio` graph typology — registered by **core**, not declared by the harness.
 *
 * A `folio` graph is authored content that the just-the-docs pipeline renders
 * to a website. It is the only **renderable** kind, and everything that
 * depends on that pipeline belongs to core, so it does not live in
 * `schemas/kg/cat-harness.ts`. The harness declares the three kinds it can
 * serve — `tools`, `kg`, `schemas` — and core adds this one on top, through
 * the same load-time registration the contribution mechanism uses.
 *
 * Because it is a registration and not a constant, the harness does not know
 * the kind exists until core registers it, and an unregistered kind is a hard
 * error naming what *is* known.
 *
 * @module schemas/folio-graph-typology
 * @graphNode schema
 */

// THE LEAF, not `cat-harness.ts`. That is what makes this direction legal and
// the registration automatic: this module is core, the registry is harness,
// and core importing the harness is the allowed direction. Importing
// `cat-harness.ts` here was the cycle that stopped it triggering its own
// registration — bean `q2wn`, and `graph-typology-registry.ts`'s header.
import { defaultGraphTypologies, type GraphTypologyDef, type GraphTypologyRegistry } from "./graph-typology-registry.js";
// Straight from the namespace leaf, not via the harness: the IRI is the
// platform's, not the harness's to re-export.

/** The one renderable graph typology. */
export const FOLIO_GRAPH_TYPOLOGY: GraphTypologyDef = {
  // Said, not silent (bean riit: the validator sweep now reaches the kinds core
  // registers in code, and found this one had said nothing).
  validatorNotApplicable:
    "its nodes are `.ts` block manifests and `.md` prose, TypeScript that the content pipeline loads and " +
    "`content_validate` checks against the Block union, not JSON a runtime Zod schema could parse.",
    description:
      "authored content an AUTHOR creates using the graph — a note, a visualization, a paper. An L1 library's catalogue is `library/`; a note about it is a `folio`; the page explaining how ingestion works is `docs`.",
    renderableNote: "just-the-docs renders it to a website",
  // A harness kind since folio-assistant#2598 (owner, 2026-10-16, "1a"): the
  // harness declares a `folio/` of its own and renders it, so it names the
  // kind in its own namespace rather than in the content layer's.
  renderable: true,
  // The subject matter itself — a folio IS the thing a reader came for, which
  // is also why it is the only renderable kind. The two axes are independent
  // in principle and coincide here: everything renderable so far is content,
  // and nothing about `state` forbids a future kind being rendered.
  holds: "content",
  perInstance: true,
  title: "Folio",
  summary: "Authored content, rendered to a website by the just-the-docs pipeline.",
};

/**
 * Register `folio` into a registry.
 *
 * Idempotent, so a diamond dependency graph reaching core twice is not an
 * error — the same rule the contribution registry follows.
 */
export function registerFolioGraphTypology(registry: GraphTypologyRegistry = defaultGraphTypologies): void {
  registry.register("folio", FOLIO_GRAPH_TYPOLOGY);
}

// Registering on import is what makes `folio` available to anything that
// imports core. The harness alone never sees it.
registerFolioGraphTypology();
