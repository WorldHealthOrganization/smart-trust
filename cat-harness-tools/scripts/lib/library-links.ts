/**
 * Where a library reference links — bean `qgjh`.
 *
 * Owner, 2026-09-30: a library reference links to THREE things, and a
 * reference is resolved to each only where that target exists:
 *
 * 1. `viewer` — the library viewer's page for the item's layer, opened on
 *    the item (`#<instance>/<id>`, the key the viewer honours on load and
 *    on hashchange).
 *    A SITE-relative path; the page that shows it prefixes its own root.
 * 2. `readme` — the item's generated README (`library-readmes.ts`), "like
 *    bootstrap readmes", on the repository host.
 * 3. `source` — the document's own record upstream: arXiv or DOI, from the
 *    identifier its manifest records (read as its README reads it). None is
 *    invented for an item without one.
 * 4. `entry` — the item's OWN page, `<instance page>/<id>/`, where its
 *    document is drawn and its held source opens in the view panel (owner,
 *    2026-10-16: *"how do you actually see a methodology linked"* — the
 *    listing anchor and the README showed neither). Site-relative, like
 *    `viewer`; only when that page is on disk.
 *
 * Read, never composed: the item from the library projection
 * (`assets/library/index.json`, written by `gen-library-viz.ts`), the viewer
 * page and the README from disk. A reference none of this resolves gets no
 * link at all, so it stays text rather than becoming a 404.
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";

import { readDeclaration, sourceLinks } from "../../schemas/kg/cat-harness.ts";
import { detectRepoUrl } from "../../src/core/git-refs.js";
import { baseDocsDir } from "../compose-docs.js";
import { itemFacts } from "../library-readmes.ts";
import { existingPageDir } from "../viewer-declarations.ts";
import { overlayPath } from "./layer-output.ts";
import { corpusDirectoriesForGraph } from "../../schemas/kg/harness-config.js";

/** The links a library reference resolves to; each absent where it does not. */
export interface LibraryLinks {
  viewer?: string;
  entry?: string;
  readme?: string;
  source?: string;
}

interface Entry {
  id: string;
  instance: string;
  dir: string;
}

/** A resolver over one checkout, built once and asked per reference. */
export interface LibraryResolver {
  links(id: string, instance?: string): LibraryLinks | undefined;
}

/** The branch a README link views. The same answer the landing data uses. */
const SOURCE_BRANCH = "main";

/**
 * `site`: the site the linking page is written into, when a writer is pointed
 * at one (`--site`, `lib/site-target.ts`). The library's projection and pages
 * are written there too, not into the harness's own docs, so a resolver that
 * looked only in `baseDocsDir` found nothing on an IG site and linked nothing
 * (owner, 2026-11-10).
 */
export function libraryResolver(repo: string, instanceRoot: string, site?: string): LibraryResolver {
  let base: string | undefined = site;
  if (base === undefined) {
    try {
      base = baseDocsDir(repo);
    } catch {
      base = undefined;
    }
  }
  const handler = readDeclaration(instanceRoot)?.name;
  const libs = corpusDirectoriesForGraph(instanceRoot, "library");
  // The segment `gen-library-viz.ts` publishes under: the TOP-LEVEL declared
  // directory, so a corpus declared from within a named sub-graph
  // (cat-harness#1032: `library/corpus/`) is `library`, not `corpus`.
  const topOf = (d: string): string => {
    const first = relative(instanceRoot, d).split(sep)[0]!;
    return first === "" || first === ".." ? basename(d) : first;
  };
  const seg = libs.length > 0 ? topOf(libs[0]!) : undefined;
  const projection = base === undefined ? undefined : join(base, "assets", "library", "index.json");
  const entries: Entry[] =
    // Written at publish, so in a composed checkout it is at the layer's
    // output root (bean sm8r), not in the pinned mount.
    projection !== undefined && existsSync(overlayPath(projection))
      ? ((JSON.parse(readFileSync(overlayPath(projection), "utf-8")) as { entries?: Entry[] }).entries ?? [])
      : [];
  const repoUrl = detectRepoUrl(repo);

  return {
    links(id, instance) {
      const matches = entries.filter((e) => e.id === id && (instance === undefined || e.instance === instance));
      // Ambiguous without a layer: two libraries hold the slug, and
      // picking one would be a guess that reads as a resolution.
      if (matches.length !== 1) return undefined;
      const e = matches[0]!;
      const out: LibraryLinks = {};
      if (base !== undefined && handler !== undefined && seg !== undefined) {
        // The page under the locale (`<locale>/<harness>/<seg>/<instance>/`,
        // folio-assistant#2527) or, on a site not yet regenerated, at the old
        // address — never the forwarding page compose-docs writes there.
        const dir = existingPageDir(base, { harness: handler, visualiser: seg, subgraph: e.instance });
        if (dir !== undefined && existsSync(overlayPath(join(dir, "index.html")))) {
          // The viewer's own anchor key is `<instance>/<id>` (`honourAnchor` in
          // gen-library-viz.ts matches `e.instance + "/" + e.id`), so a bare id
          // would open the page without selecting anything.
          out.viewer = `${relative(base, dir).split(sep).join("/")}/#${encodeURIComponent(`${e.instance}/${e.id}`)}`;
          if (existsSync(overlayPath(join(dir, e.id, "index.html")))) out.entry = `${relative(base, join(dir, e.id)).split(sep).join("/")}/`;
        }
      }
      const readme = `${e.dir}/README.md`;
      if (existsSync(join(repo, readme))) out.readme = sourceLinks(repoUrl, readme, SOURCE_BRANCH)?.viewHref;
      // From the item's own manifest, through the reader its README uses, so
      // the two cannot disagree. The projection's `arxiv` is not used: it
      // flattens the manifest's `{ id, version }` record to an empty string.
      const facts = itemFacts(join(repo, e.dir));
      if (facts?.arxiv) out.source = `https://arxiv.org/abs/${facts.arxiv}`;
      else if (facts?.doi) out.source = `https://doi.org/${facts.doi}`;
      return Object.values(out).some((v) => v !== undefined) ? out : undefined;
    },
  };
}
