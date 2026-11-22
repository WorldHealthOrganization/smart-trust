/**
 * A library entry's ONE IRI — the address of its published JSON-LD.
 *
 * The asset (the entry's manifest) is named by the URL its JSON-LD is
 * published at, and that URL dereferences to the file. The viewer page at
 * `<site>/cat-harness/library/<instance>/<id>/` is a RENDERING of it: a second
 * resource with its own IRI, which points TO the asset and is never named by
 * it.
 *
 * The IRI is `…/assets/library/jsonld/<instance>/source/<id>`: extensionless,
 * its last two segments the node's kind and id (`source`, from the entry's
 * class `SourceDocument`; issue #1830, Q-THIN-2 A, Q-THIN-6 B). Beside it:
 *
 *   <IRI>.jsonld   the entry's manifest, as committed
 *   <IRI>.html     a stub that declares the node and points to its rendering
 *   <IRI>/…        the entry's other published files (`l1-extraction/`, …)
 *
 * It sits under `assets/library/`, not `/library/<instance>/`, which is each
 * instance's own mount route (`mount-instance-docs.ts`, rule 2). Block ids are
 * not published addresses: they key `summaries.json`, LSI indexes and kg-qa
 * sidecars.
 *
 * ONE function, called by the writer of the `@id` (`gen-library-jsonld`) and
 * the publisher of the file (`gen-library-viz`), so the IRI and the place the
 * file lands cannot disagree.
 *
 * It holds no Zod type: the rule it publishes is the address, not a shape.
 * It is a graph node anyway (owner, 2026-11-10) so the rule has a page beside
 * the library schemas a reader is directed to (`library-nodes`,
 * `document-structure`), instead of being findable only in the source.
 *
 * @module schemas/library-iri
 * @graphNode schema
 */
import { ownNamespace } from "../kg/namespaces.ts";

/** The published site's root — `_config.yml` `url` + `baseurl`, from the own-namespaces code list. */
export const DOCS_SITE = ownNamespace("docs-site");

/** Where every entry's JSON-LD is published, site-relative — the publisher's to prune. */
export const LIBRARY_JSONLD_SITE_DIR = "assets/library/jsonld";

/** The kind segment of an entry's IRI: the entry is a `SourceDocument`. */
export const LIBRARY_ENTRY_KIND = "source";

/** The entry's IRI path, SITE-relative and extensionless: `<dir>/<instance>/source/<id>`. */
export function libraryEntrySitePath(instance: string, docId: string): string {
  return `${LIBRARY_JSONLD_SITE_DIR}/${encodeURIComponent(instance)}/${LIBRARY_ENTRY_KIND}/${encodeURIComponent(docId)}`;
}

/** The entry's JSON-LD, SITE-relative: where the publisher writes it under the site directory. */
export function libraryAssetSitePath(instance: string, docId: string): string {
  return `${libraryEntrySitePath(instance, docId)}.jsonld`;
}

/** The stub page at the entry's IRI, SITE-relative: it declares the node and points to its rendering. */
export function libraryStubSitePath(instance: string, docId: string): string {
  return `${libraryEntrySitePath(instance, docId)}.html`;
}

/** The entry's IRI — absolute, dereferenceable, instance-qualified, `…/source/<id>`. */
export function libraryAssetIri(instance: string, docId: string): string {
  return `${DOCS_SITE}${libraryEntrySitePath(instance, docId)}`;
}
