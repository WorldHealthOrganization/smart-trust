/**
 * Where a knowledge-graph subject's own page is, for a generator that links
 * to it — the ⓘ panel and the call-activity links in rendered BPMN.
 *
 * @module scripts/lib/subject-pages
 *
 * Owner, 2026-10-23T14:57Z: *"the info button/icons in the bpmn rendering
 * should point to those new IRIs"* (litlfred/cat-harness-tools#603). The IRI
 * is `makeIri`'s, against the document of the layer that declares the
 * subject (`publishedIdentity`), so a link and the `@id` it names cannot
 * disagree. `kg-export`'s `writeSubjectDocuments` writes the page there.
 *
 * A link is answered ONLY where a page is written: the host's document and
 * every layer `instance-exports.ts` exports that mints against this site
 * (not its own `canonicalUrl`), and — since the owner's 2026-10-29 choice
 * on litlfred/cat-harness-tools#638 (option B) — the COPY this site publishes
 * of an own-canonical layer's subjects, `owl:sameAs` the canonical IRI.
 * bootstrap's graph is still
 * bootstrap-tools' `export-graph.ts`, which mints fragments until its own
 * phase of #603, so its subjects get `undefined` and the caller keeps the
 * link it had — never a slash path nothing serves.
 *
 * ## Only where the checkout being built publishes the host's site
 *
 * The pages are written by `kg-export` in the HOST's own deploy: the
 * checkout whose root is the host or an index of its layers. A downstream
 * checkout (one whose root declares an instance of its own, the host only a
 * mount in it) builds ITS site, and nothing in that build writes a subject
 * page. Before this rule its links named the host's site anyway —
 * `<host base>/<downstream>/process/<id>/node/<id>`, which the host does not
 * publish either — so every step title in a downstream's BPMN was a 404.
 * There the answer is `undefined`, and each caller keeps the link it falls
 * back to: the processes viewer's page, a role's index row, the IG's page.
 */
import { resolve } from "node:path";
import { checkoutRootFor, findInstanceRoot, readDeclaration } from "../../schemas/kg/cat-harness.js";
import { findDeclarationFile } from "../../schemas/kg/instance-roots.js";
import { makeIri, publishedIdentity } from "../kg-export.js";
import { declaresOwnCanonical, instanceDocPath, publishesInstanceSchema } from "../instance-exports.js";
import { HARNESS_ROOT } from "./roots.ts";

const docIris = new Map<string, string | undefined>();

/**
 * Does building `checkout` publish the site of the host at `host`, where
 * `kg-export` writes the subject pages? Yes when the checkout IS the host, or
 * its root declares no layer (an index of the host's layers), or declares
 * the host itself. No when its root declares another layer: a downstream,
 * building its own site with the host mounted in it.
 */
export function publishesHostSite(checkout: string, host: string): boolean {
  const root = resolve(checkout);
  const h = resolve(host);
  if (root === h) return true;
  if (findDeclarationFile(root) === undefined) return true;
  try {
    const top = readDeclaration(root)?.name;
    return top !== undefined && top === readDeclaration(h)?.name;
  } catch {
    return false;
  }
}

let hostHere: boolean | undefined;
/** {@link publishesHostSite} for this run's harness, once. */
function hostSiteHere(): boolean {
  if (hostHere === undefined) {
    try {
      hostHere = publishesHostSite(checkoutRootFor(HARNESS_ROOT), HARNESS_ROOT);
    } catch {
      // The checkout could not be determined: no page is known to be written.
      hostHere = false;
    }
  }
  return hostHere;
}

/** The document IRI subjects of `instanceRoot` are minted against, when kg-export publishes their pages. */
function servingDocIri(instanceRoot: string): string | undefined {
  const key = resolve(instanceRoot);
  if (!docIris.has(key)) {
    let doc: string | undefined;
    try {
      if (!hostSiteHere()) throw new Error("a downstream checkout: its build writes no subject pages");
      const host = key === resolve(HARNESS_ROOT);
      const decl = readDeclaration(key);
      if (host || (publishesInstanceSchema(key) && !declaresOwnCanonical(decl))) {
        doc = publishedIdentity(key).docIri;
      } else if (publishesInstanceSchema(key) && decl !== undefined) {
        // A layer minting against its OWN `canonicalUrl` (e.g.
        // `http://smart.who.int/base`), which serves nothing yet: link the
        // copy `instance-exports` publishes on THIS site under `<name>/`
        // (#638 option B), never the canonical IRI.
        const stub = publishedIdentity(key).docPath.replace(/\.jsonld$/, "").split("/").pop()!;
        const siteBase = publishedIdentity(resolve(HARNESS_ROOT)).base;
        if (/^https?:\/\//.test(siteBase)) doc = `${siteBase}/${instanceDocPath({ name: decl.name, stub })}`;
      }
    } catch {
      doc = undefined;
    }
    docIris.set(key, doc);
  }
  return docIris.get(key);
}

/**
 * The page of subject `<kind>/<id>` declared by the file at `source`
 * (absolute): its subject IRI, absolute — the ruling is that the link IS the
 * IRI. `undefined` when nothing serves a page for it.
 *
 * Absolute rather than relative: the generators' own "way up" leads to their
 * docs root (`docs/<instance>/` on the site), not to the site root the
 * subjects are under, and a link built from the wrong root is the 404 this
 * migration exists to remove.
 */
export function subjectHref(source: string, kind: string, id: string): string | undefined {
  const inst = findInstanceRoot(resolve(source));
  if (inst === undefined) return undefined;
  const doc = servingDocIri(inst);
  return doc === undefined ? undefined : makeIri(doc, kind, id);
}

const publishedDocIris = new Map<string, string | undefined>();

/**
 * The IRI of subject `<kind>/<id>` declared by the file at `source`
 * (absolute), as its layer's document mints it, whichever checkout is being
 * built. {@link subjectHref} answers only where THIS build writes the
 * subject's page. This answers wherever the layer's own publication serves
 * it: the platform's site serves every layer it indexes
 * (`folio-assistant/<layer>/actor/<id>` and `.jsonld`, 200, measured
 * 2026-11-13). So a downstream's viewer row can name the node by its IRI and
 * link its JSON-LD (owner, 2026-11-13, node-kind audit: "link existing IRIs").
 * `undefined` for a layer whose document is not on the platform's site (one
 * minting against a `canonicalUrl` elsewhere, which serves nothing yet), and
 * for a file in no layer.
 */
export function subjectIri(source: string, kind: string, id: string): string | undefined {
  const inst = findInstanceRoot(resolve(source));
  if (inst === undefined) return undefined;
  const key = resolve(inst);
  if (!publishedDocIris.has(key)) {
    let doc: string | undefined;
    try {
      // Served where the platform's site serves it: a layer whose own
      // `canonicalUrl` is elsewhere (`http://smart.who.int/base`) serves
      // nothing there yet, so it has no IRI to link.
      const host = hostSiteBase();
      const minted = publishedIdentity(key).docIri;
      doc = host !== undefined && minted.startsWith(`${host}/`) ? minted : undefined;
    } catch {
      doc = undefined;
    }
    publishedDocIris.set(key, doc);
  }
  const doc = publishedDocIris.get(key);
  return doc === undefined ? undefined : makeIri(doc, kind, id);
}

/**
 * Whether this run's checkout publishes the platform's own site, where its
 * docs pages are ({@link publishesHostSite} for the harness). A downstream's
 * site holds none of them, so a link to one names the platform's site.
 */
export function buildsHostSite(): boolean {
  return hostSiteHere();
}

/** The platform's site, where its docs pages are published: the harness's document base. */
export function hostSiteBase(): string | undefined {
  try {
    const base = publishedIdentity(resolve(HARNESS_ROOT)).base;
    return /^https?:\/\//.test(base) ? base.replace(/\/+$/, "") : undefined;
  } catch {
    return undefined;
  }
}
