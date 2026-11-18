/**
 * `hloc` box 3 — what `gen-skill-docs` leaves behind must be the PUBLISHED
 * tree, not a link that happens to be unresolvable.
 *
 * The generator flattens a skill package: a body authored at
 * `cat-harness/skills/<pkg>/x.md` is published at
 * `cat-harness/docs/reference/skill-instructions/x.md`. Both are three
 * directories deep, so a `../../../` link is correct at the source and lands
 * one level short in the output — `<repo>/beans/defs/` becomes
 * `cat-harness/beans/defs/`, which does not exist.
 *
 * `rebaseLinks` exists to fix exactly that, and its matcher required a FILE
 * EXTENSION:
 *
 * ```text
 * /\]\((\.{0,2}[^)\s:]*?\.[A-Za-z0-9]+)(#[^)\s]*)?\)/g
 * ```
 *
 * A directory target has none, so `](../../../beans/defs/)` never reached
 * `publishedLocation` and was published broken. I widened that pattern from
 * `\.md` to `\.[A-Za-z0-9]+` in #1398 — more extensions, still no directories,
 * and the case I added it for hid the case I did not.
 *
 * This asserts the OUTCOME rather than the pattern: a relative link on a
 * generated page resolves inside the site, or it is one of the documented
 * leave-alones. A regex test would pass again the next time the matcher is
 * widened in a way that misses a shape.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { siteDirFor } from "../../schemas/kg/cat-harness.ts";

import { indexSummary, orphanPages, twinsInCheckout, unpublishedTwins } from "../gen-skill-docs.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { siteNotBuilt } from "../../test/support/checkout.ts";
import { overlayPath } from "../lib/layer-output.ts";

const HARNESS = resolve(HARNESS_ROOT);
const GENERATED = join(HARNESS, siteDirFor(HARNESS), "reference", "skill-instructions");
/**
 * Where `skills:docs` wrote the pages: the layer's output root where it is
 * mounted (bean `cat-tools-sm8r`), else {@link GENERATED}. Links still resolve
 * from GENERATED, through the same overlay a reader sees.
 */
const WRITTEN = overlayPath(GENERATED);
/** The generated pages are written at publish and gitignored (bean w1gy F18). */
const NOT_GENERATED = siteNotBuilt("the skill reference pages `skills:docs` writes at publish (gitignored)", WRITTEN);

/** Every inline markdown link target on a page, anchors and titles stripped. */
function linkTargets(body: string): string[] {
  const out: string[] = [];
  for (const m of body.matchAll(/\]\(([^)\s]+)/g)) out.push(m[1].replace(/#.*$/, ""));
  return out;
}

/**
 * A link whose destination does not depend on where the page sits — an
 * absolute URL, a site-absolute path, or a bare fragment. None of these is
 * the generator's to rebase.
 */
function relativeTarget(t: string): boolean {
  if (t === "" || t.startsWith("/") || t.startsWith("#")) return false;
  return !/^[a-z][a-z0-9+.-]*:/i.test(t);
}

describe.skipIf(NOT_GENERATED)("generated skill instruction pages", () => {
  const pages = existsSync(WRITTEN)
    ? readdirSync(WRITTEN).filter((f) => f.endsWith(".md"))
    : [];

  const resolvesFrom = (dir: string, t: string): boolean => {
    const dest = resolve(dir, t);
    const candidates = [dest, `${dest}.md`, join(dest, "index.md")];
    if (dest.endsWith(".html")) candidates.push(`${dest.slice(0, -".html".length)}.md`);
    return candidates.some((c) => existsSync(overlayPath(c)));
  };

  test("the generated directory exists and has pages", () => {
    // Without this the assertion below passes over an empty set, which is the
    // vacuity every check in this repo is required to rule out.
    expect(pages.length).toBeGreaterThan(10);
  });

  test("a link that is correct AT ITS SOURCE resolves from the generated page too", () => {
    // The control, and it is `ahab`'s applied to a generator rather than to a
    // translator. A published page sits one directory DEEPER than the body it
    // was generated from — `cat-harness/skills/<pkg>/x.md` is three from the
    // repository root, `cat-harness/docs/reference/skill-instructions/x.md` is
    // four — so `../../../beans/defs/` is right at the source and lands at
    // `cat-harness/beans/defs/` here. `rebaseLinks` exists to close that
    // gap and its matcher required a file extension, so a DIRECTORY target
    // never reached it.
    //
    // Broken at BOTH depths is not this test's business and must not be:
    // `hloc` box 2 says a target the generator cannot place is left exactly as
    // written, because a plausible-looking rewrite turns a broken link into an
    // undetectable one. `.claude/skills/local/todo-manager.md` links
    // `../../../work-plan/skills/work-plan/todo-manager.md`, which resolves nowhere
    // from its own source either — so it is a SOURCE defect, correctly
    // published untouched, and an earlier draft of this test wrongly called it
    // a generator failure.
    const unrebased: string[] = [];
    for (const page of pages) {
      const abs = join(GENERATED, page);
      const own = dirname(abs);
      const atSource = dirname(own); // one level up — the source page's depth
      for (const t of linkTargets(readFileSync(join(WRITTEN, page), "utf-8"))) {
        if (!relativeTarget(t)) continue;
        if (resolvesFrom(own, t)) continue;
        if (resolvesFrom(atSource, t)) unrebased.push(`${page}: ${t}`);
      }
    }
    expect(unrebased).toEqual([]);
  });
});

describe("indexSummary", () => {
  test("a short line is kept whole", () => {
    expect(indexSummary("A short summary.")).toBe("A short summary.");
  });
  test("a cut inside a link target is extended to the link's end", () => {
    const line = `Process: [\`a/b.bpmn\`](../../en/cat-harness/processes/getting-started.html) and more text after it.`;
    const got = indexSummary(line, 40);
    expect(got).toBe("Process: [`a/b.bpmn`](../../en/cat-harness/processes/getting-started.html)");
  });
  test("a cut outside any link stays at the limit", () => {
    const line = "[a](b.html) " + "x".repeat(200);
    expect(indexSummary(line, 30)).toBe(line.slice(0, 30));
  });
});

/**
 * `3x2o` — a page produced by NO source is the failure `--check` could not see.
 *
 * `emit` compares content per path and reports what differs. A page whose
 * source has become unreachable is never emitted, so it is never compared, and
 * the drift report reads "up to date" over it. Two such pages
 * (`fhir-client-operations`, `smart-launch`) sat on the published site with a
 * "Generated from … — do not edit here" banner pointing at a directory nothing
 * declared.
 *
 * The unit cases carry the whole assertion, because the corpus case cannot: the
 * real answer is now the empty set, which is also what a guard computing
 * nothing returns. Falsified against the corpus by deleting the
 * `fhir-ig-skills` declaration — six named orphans, exactly the pages that
 * declaration reaches — but a test may not leave the tree in that state, so the
 * discrimination is asserted here instead.
 */
describe("orphanPages", () => {
  test("a page nothing produced is an orphan", () => {
    expect(orphanPages(["a.md", "b.md"], ["a"])).toEqual(["b.md"]);
  });

  test("index.md is the generator's own and is never an orphan", () => {
    // Without this the guard fails on every clean run, since no group produces
    // `index.md` — and the cheapest wrong fix is to add it to `written`, which
    // would make a genuinely missing index invisible instead.
    expect(orphanPages(["index.md", "a.md"], ["a"])).toEqual([]);
  });

  test("non-markdown is not judged", () => {
    // The output directory is Jekyll's; an asset beside the pages is not a
    // page this generator claims to produce.
    expect(orphanPages(["a.md", "diagram.svg"], ["a"])).toEqual([]);
  });

  test("the PUBLISHED name is what is compared, not the source basename", () => {
    // `written` is keyed on the published name, so a prefixed group's page is
    // `local-todo-manager.md`. Comparing against the basename would report
    // every prefixed page as an orphan on a clean tree.
    expect(orphanPages(["local-todo-manager.md"], ["local-todo-manager"])).toEqual([]);
    expect(orphanPages(["local-todo-manager.md"], ["todo-manager"])).toEqual([
      "local-todo-manager.md",
    ]);
  });

  test.skipIf(NOT_GENERATED)("it is DISCRIMINATING over the real output directory", () => {
    // The vacuity control. `orphanPages(onDisk, [])` over the live tree must
    // name essentially all of it; a guard that returned `[]` unconditionally
    // would pass every assertion above this one's absence.
    expect(orphanPages(readdirSync(WRITTEN), []).length).toBeGreaterThan(10);
  });
});


/**
 * `bsay` — a twin entry is only true while BOTH its pages are produced.
 *
 * `SAME_BASENAME_DIFFERENT_DOCUMENT` says "these two names are different
 * documents", and the generator turns that into a banner on each page naming
 * and LINKING the other. It is consulted for a name being published and never
 * asked whether the partner is, so the check ran on the wrong side of the
 * relation.
 *
 * `kg-navigation` sat that way from `pve3` — which ruled bootstrap's skills
 * out of this layer — until 2026-09-27. The live page carried *"A stub of
 * the same name is published as [Reading a knowledge graph before you have
 * anything (bootstrap)](local-kg-navigation.html)"*, and that page does not
 * exist and cannot: the `local-` prefix comes from `.claude/skills/local/`,
 * which holds three skills, none of them `kg-navigation`. A reader ACTS on a
 * banner, which is what makes this worse than the silently-dead
 * `SKILLS_CATEGORIES["bootstrap"]` heading of the same week.
 *
 * `reportOrphans` cannot see it. An orphan is a page with no source; this is a
 * LINK to a page that was never a page, so no sweep of the output directory
 * reaches it.
 */
describe("unpublishedTwins", () => {
  const ok = { "a": [{ published: "a" }, { published: "local-a" }] };

  test("both twins produced is clean", () => {
    expect(unpublishedTwins(ok, ["a", "local-a"])).toEqual([]);
  });

  test("a twin nothing produces is named, with the entry it belongs to", () => {
    // The `kg-navigation` case exactly: the canonical page publishes, the
    // partner does not, and the banner still goes out.
    expect(unpublishedTwins(ok, ["a"])).toEqual(["a -> local-a"]);
  });

  test("an entry whose OWN name is not among its twins is reported too", () => {
    // A different failure and it must not be silent: `other`/`self` are picked
    // by comparing against the published name, so a table that does not
    // contain its own key makes the generator choose the wrong side and emit
    // the stub banner on the canonical page.
    expect(unpublishedTwins({ "a": [{ published: "x" }, { published: "y" }] }, ["x", "y"])).toEqual([
      'a: no twin publishes under "a" itself',
    ]);
  });

  test("it is DISCRIMINATING over a table that is entirely unpublished", () => {
    // The vacuity control, and the reason both halves are asserted above: a
    // function returning `[]` unconditionally satisfies the first test.
    expect(unpublishedTwins(ok, []).length).toBe(2);
  });
});

/**
 * A twin whose publishing group's DIRECTORY this checkout does not hold is out
 * of scope here, not the `bsay` defect (smart-ra#66: a document folio has no
 * `.claude/skills/local/`, and `skills:docs` failed `derive:publish` on it).
 * The guard must still fire wherever the group is present.
 */
describe("twinsInCheckout", () => {
  const table = { "a": [{ published: "a" }, { published: "local-a" }] };
  const groups = [{ dir: "/skills" }, { dir: "/local", publishPrefix: "local-" }];

  test("the partner's group directory absent: the entry is dropped and named, so no banner and no failure", () => {
    const r = twinsInCheckout(table, groups, (d) => d !== "/local");
    expect(r.table).toEqual({});
    expect(r.absent).toEqual(["a -> local-a"]);
    expect(unpublishedTwins(r.table, ["a"])).toEqual([]);
  });

  test("the group present (the folio-assistant index): the entry is kept, and a missing stub still fails", () => {
    const r = twinsInCheckout(table, groups, () => true);
    expect(r.table).toEqual(table);
    expect(r.absent).toEqual([]);
    expect(unpublishedTwins(r.table, ["a"])).toEqual(["a -> local-a"]);
  });

  test("a twin no declared group would publish is kept, so the table contradicting the groups still fails", () => {
    const r = twinsInCheckout({ "a": [{ published: "a" }, { published: "other-a" }] }, groups, (d) => d !== "/local");
    expect(Object.keys(r.table)).toEqual(["a"]);
    expect(unpublishedTwins(r.table, ["a"])).toEqual(["a -> other-a"]);
  });
});
