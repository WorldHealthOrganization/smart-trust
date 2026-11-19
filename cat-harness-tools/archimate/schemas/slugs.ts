/**
 * Readable page paths for ArchiMate views and elements.
 *
 * @graphNode none — path functions for ArchiMate pages; no schema
 * @module cat-harness/archimate/schemas/slugs
 * @covers archimate
 *
 * Owner, 2026-10-30, of `…/views/id-007936f8c2424b96ad1893ef0ff66059/`:
 * *"do we need to use such ugly IDs … why not nicer slug IRIs?"*; then, of
 * the designs offered (cat-harness-tools#1054), *"B. clean break ok"*.
 *
 * ## The id stays the IRI; the slug is where the page is
 *
 * A node's `@id` is still `<m>/view/<archi id>` (data at `.jsonld`): Archi's ids are what
 * the RA mapper keys on. Only the PAGE is at a slug, `<m>/view/<slug>/`.
 * Relationships are almost all unnamed (smart-ra 0.2.0: 6 of 284), so their
 * pages stay at their ids.
 *
 * ## Worked out on every build, and a clean break
 *
 * Slugs come from the names each build ({@link planSlugs}); nothing is
 * committed and nothing redirects. The page at an old id path is gone, and a
 * rename moves a page. That is the trade the owner chose: the id IRI is the
 * permanent identifier, the page path is for reading.
 *
 * - A slug is the name in lower-case words joined by `-`, cut at a word break
 *   at {@link SLUG_MAX}.
 * - An author can choose one in Archi with a `slug` property on the view or
 *   element. It must be lower-case words joined by `-`; two objects choosing
 *   the same one is refused, because a rewritten slug is a path nobody chose.
 * - On a clash, the object first in the model keeps the plain slug and each
 *   later one gets `-<first hex of its id>`.
 * - An object with no readable name keeps its id as its path.
 */
import type { ArchimateModel, ArchimateProperty } from "./archimate.ts";

/** Lower-case words of letters and digits joined by single dashes. */
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** A derived slug is cut at a word break at or below this length. */
export const SLUG_MAX = 60;

/**
 * A name as a slug: accents dropped, lower case, every run of other
 * characters one `-`, cut at a word break at {@link SLUG_MAX}. `undefined`
 * when nothing readable is left, or when what is left looks like an Archi id
 * (`id-<hex>`), which would be mistaken for one.
 */
export function slugify(name: string): string | undefined {
  let s = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length > SLUG_MAX) {
    const cut = s.slice(0, SLUG_MAX + 1);
    const at = cut.lastIndexOf("-");
    s = (at > 0 ? cut.slice(0, at) : s.slice(0, SLUG_MAX)).replace(/-+$/, "");
  }
  return s === "" || looksLikeId(s) ? undefined : s;
}

const looksLikeId = (s: string): boolean => /^id-[0-9a-f]{8,}$/.test(s);

/** The slug an author chose in Archi, if any. Throws on one that is not a slug. */
export function chosenSlug(properties: ArchimateProperty[] | undefined, what: string): string | undefined {
  const p = (properties ?? []).find((x) => x.key === "slug");
  if (p === undefined) return undefined;
  if (!SLUG.test(p.value) || looksLikeId(p.value)) {
    throw new Error(`${what}: its \`slug\` property "${p.value}" is not lower-case words joined by "-"`);
  }
  return p.value;
}

/** The short tail a clashing slug takes: its id's first characters, as a slug. */
function idTail(id: string, n: number): string {
  const t = id.replace(/^id-/, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return (t || "x").slice(0, n);
}

/**
 * The page slug of each view and element of a model that has one, by Archi
 * id (ids are unique across kinds in a model). Views and elements are slugged
 * separately, as their pages are in separate directories. Pure: the same
 * model always gives the same slugs.
 */
export function planSlugs(model: ArchimateModel): Map<string, string> {
  const slugOf = new Map<string, string>();
  const ids = new Set([...model.views, ...model.elements, ...model.relationships].map((o) => o.id));
  const kinds = [
    model.views.map((v) => ({ id: v.id, name: v.name, properties: v.properties, what: `view "${v.name}" (${v.id})` })),
    model.elements.map((e) => ({ id: e.id, name: e.name, properties: e.properties, what: `element "${e.name}" (${e.id})` })),
  ];
  for (const objects of kinds) {
    const owner = new Map<string, string>();
    const free = (s: string) => !ids.has(s) && !owner.has(s);
    // Chosen slugs first, so a derived one never takes what an author chose.
    const chosen = objects.map((o) => chosenSlug(o.properties, o.what));
    objects.forEach((o, i) => {
      const c = chosen[i];
      if (c === undefined) return;
      if (!free(c)) throw new Error(`${o.what}: its \`slug\` property "${c}" is also chosen by ${owner.get(c) ?? "an object id"}`);
      owner.set(c, o.id);
      slugOf.set(o.id, c);
    });
    objects.forEach((o, i) => {
      if (chosen[i] !== undefined) return;
      const want = slugify(o.name);
      if (want === undefined) return;
      let slug = free(want) ? want : undefined;
      for (let n = 4; slug === undefined; n++) {
        const c = `${want}-${idTail(o.id, n)}`;
        if (free(c)) slug = c;
        else if (n > 40) throw new Error(`${o.what}: no free slug for "${want}"`);
      }
      owner.set(slug, o.id);
      slugOf.set(o.id, slug);
    });
  }
  return slugOf;
}
