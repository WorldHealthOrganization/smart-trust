/**
 * The landing sticky, and the contribution seam that composes the board.
 *
 * The content assertions here read **the declaration** rather than a constant in
 * `schemas/`. That is the point of the change these tests were rewritten for: the
 * words moved into `harness.json`, so a test asserting a TypeScript constant would
 * be checking something no longer shipped — green while the board said something
 * else entirely.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  DEFAULT_ONBOARDING_LINKS,
  LANDING_STICKY_PAGE,
  LANDING_STICKY_SCHEMA_TAG,
  LandingLinkSchema,
  LandingStickySchema,
  isExternalLink,
  isLandingSticky,
  stickyFromContribution,
  sourceLinks,
  type LandingSticky,
} from "./content/landing-sticky.js";
import {
  STICKY_ORDER_LEADING,
  STICKY_ORDER_TRAILING,
  StickyContributionSchema,
  StickyIdConflictError,
  composeContributions,
  readerText,
  type DeclaredContribution,
} from "./content/sticky-contribution.js";
import { CatHarnessDeclarationSchema, siteDirFor, declarationPathIn } from "./kg/cat-harness.js";
import { THEMES } from "./ui/themes.js";
import { resolveThemeBackdrop } from "./ui/theme.js";
import { inAggregate } from "../test/support/checkout.js";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { declaredDocsSources } from "../scripts/lib/docs-sources.ts";
import { dirname } from "node:path";

const REPO = join(dirname(HARNESS_ROOT));
/** This layer's root — where its own declaration and site live. */
const INSTANCE = join(HARNESS_ROOT);
const NOW = "2026-09-20T00:00:00.000Z";

/** A declaration, read the way a consumer reads it. */
function decl(rel: string) {
  return CatHarnessDeclarationSchema.parse(
    JSON.parse(readFileSync(declarationPathIn(join(REPO, rel))!, "utf8")),
  );
}

/** Every contribution a layer declares, paired with that layer's own fields. */
function contributionsOf(rel: string): DeclaredContribution[] {
  const d = decl(rel);
  return (d.stickies ?? []).map((c) => ({
    contribution: c,
    declaredBy: d.name,
    declaredIn: `${rel}/harness.json`.replace(/^\//, ""),
    ...(d.description === undefined ? {} : { description: d.description }),
    ...(d.summary === undefined ? {} : { summary: d.summary }),
    ...(d.alsoWritten === undefined ? {} : { alsoWritten: d.alsoWritten }),
  }));
}

// ONE CARD PER HARNESS, which is the shape the owner asked for: "not all
// stickies should be cat harness they should be outputs (as if) each init
// harness ran ... each own intiaization sticky note to show sucess".
//
// The ids were `landing`, `cat-harness` and `subgraphs`, all three of them this
// one harness talking about itself. They are now one card each for three
// harnesses, and these fixtures name them that way so a reader of the tests
// sees the structure rather than a list of historical ids.
/**
 * A PUBLISHED CARD ID DOES NOT MOVE WITH ITS DIRECTORY — bean `8xtj`.
 *
 * The comment below `CORE` states this rule. It was stated and not asserted,
 * and on 2026-09-20 a session swept `folio-assist-core` → `folio-assistant-core`
 * across 103 files, renaming the published card id along with the directory.
 * **`bun test` stayed at 0 fail**, `tsc` and `eslint` were clean, and sixteen
 * check scripts were green. It surfaced only because the reverting session
 * compared `docs/_data/stickies.json` against `main` by hand.
 *
 * ## Why the literal assertions below did not catch it, and this does
 *
 * `landing-sticky.test.ts` already names `"folio-assist-core"` in four places.
 * They did not fire because **the sweep renamed them too** — a `sed` over the
 * repository moves a test's literal exactly as readily as the value it guards,
 * so an assertion written as a copy of its subject is satisfied by any edit
 * that changes both. That is the general hazard, not a lapse in this file.
 *
 * So this asserts a RELATION instead: which declared sticky ids differ from
 * their own layer directory. A sweep collapsing the divergence makes the
 * differing set EMPTY, and a sweep introducing a new one makes it larger.
 * Neither can be satisfied by renaming both sides, because "they differ" is
 * not a string any sed matches.
 *
 * ## It is pinned to one pair on purpose
 *
 * Measured across every declaration: `bootstrap` and `cat-harness` have
 * `sticky.id === directory`, and `folio-assistant-core` is the ONE that
 * differs. So divergence is the exception rather than the rule here, which is
 * why the assertion is an exact set rather than a count — a count of one would
 * still pass if the divergence moved to a different layer, and that is a
 * different repository from this one.
 */
describe("a published card id does not move with its directory", () => {
  /** Every (layer directory, declared sticky id) pair, from the real files. */
  const pairs = ["bootstrap", "cat-harness", "folio-assistant-core"].flatMap((rel) =>
    (decl(rel).stickies ?? []).map((s) => ({ dir: rel, id: s.id })),
  );

  test("the declarations are actually being read — not an empty sweep", () => {
    // `6tkl`: every assertion below is about a SET, and a set computed from no
    // files is empty and agrees with nothing. This is what stops that reading
    // as a pass.
    expect(pairs.length).toBeGreaterThanOrEqual(3);
  });

  test("EXACTLY the known divergence, named — collapsing it turns this red", () => {
    const diverging = pairs.filter((p) => p.id !== p.dir).map((p) => p.dir).sort();
    // `folio-assistant-core/` is the directory since the owner's ruling of
    // 2026-09-20; its card id stays `folio-assist-core` because a card id is a
    // published identifier on the landing page and the directory is only where
    // the files sit. This line is the one place they differ.
    expect(diverging).toEqual(["folio-assistant-core"]);
  });

  test("...and every other instance's card id DOES match, which is the contrast", () => {
    // Without this, the assertion above would also pass on a repository where
    // every id had drifted from its directory and only one happened to match.
    const matching = pairs.filter((p) => p.id === p.dir).map((p) => p.dir).sort();
    expect(matching).toEqual(["bootstrap", "cat-harness"]);
  });
});

const CAT = contributionsOf("cat-harness");
// The DIRECTORY, which is `folio-assistant-core/` since the owner's ruling of
// 2026-09-20 ("use folio-assistant-core/"). The sticky's own id below is
// `folio-assist-core` and is deliberately NOT renamed with it: a card id is a
// published identifier on the landing page, the directory is where the files
// sit, and this line is the one place they differ — which is exactly why it
// broke when they were assumed to be one string.
const CORE = contributionsOf("folio-assistant-core");
const BOOT = contributionsOf("bootstrap");
const ALL = [...CAT, ...CORE, ...BOOT];

function built(declared: DeclaredContribution[]): LandingSticky[] {
  return composeContributions(declared).map((d) => stickyFromContribution(d, { createdAt: NOW }));
}

function sticky(declared: DeclaredContribution[], id: string): LandingSticky {
  const found = built(declared).find((s) => s.id === id);
  if (!found) throw new Error(`no sticky "${id}" among ${built(declared).map((s) => s.id).join(", ")}`);
  return found;
}

describe("a sticky is a CONTRIBUTION from a layer, not an entry in one list", () => {
  test("cat-harness contributes its own, and bootstrap contributes its own", () => {
    // The property the whole change exists for. Neither list is empty, and
    // neither layer appears in the other's declaration.
    expect(CAT.length).toBeGreaterThan(0);
    expect(BOOT.length).toBeGreaterThan(0);
    expect(CAT.every((c) => c.declaredBy === "cat-harness")).toBe(true);
    expect(BOOT.every((c) => c.declaredBy === "bootstrap")).toBe(true);
  });

  test("the built sticky records which layer contributed it", () => {
    expect(sticky(BOOT, "bootstrap").contributedBy).toBe("bootstrap");
    // `cat-harness`, the DECLARED NAME, since the owner's 2026-09-20 ruling that
    // the three layers are distinct. It read `folio-assistant` while the
    // harness layer and the repository shared that name — which is the
    // collision the ruling ended, and this line could not have told them apart.
    expect(sticky(CAT, "cat-harness").contributedBy).toBe("cat-harness");
  });

  test("no layer's declaration names another layer's sticky", () => {
    const catIds = new Set(CAT.map((c) => c.contribution.id));
    for (const b of BOOT) expect(catIds.has(b.contribution.id)).toBe(false);
  });
});

describe("bootstrap has its OWN cat, not cat-harness's", () => {
  // SUPERSEDED, and the supersession is the point. This block asserted that
  // every theme bootstrap declared resolved to NO backdrop at all — which was
  // how the ruling *"i want the grumpy cat moved out of bootstrap and into cat
  // harness"* was satisfied while bootstrap had no art of its own: by having no
  // cat.
  //
  // The owner supplied bootstrap art on 2026-09-20, so the ruling is now
  // satisfied the better way. What must hold is not "no cat" but "not
  // cat-harness's cat", and that is what these check.
  test("bootstrap declares a theme, and it is not the one cat-harness uses", () => {
    expect(BOOT.length).toBeGreaterThan(0);
    const catThemes = new Set(CAT.map((c) => c.contribution.theme.themeId));
    for (const b of BOOT) {
      expect(catThemes.has(b.contribution.theme.themeId)).toBe(false);
    }
  });

  test("its theme resolves to its OWN art, not the default cloud's", () => {
    const images = decl("cat-harness").images ?? [];
    for (const b of BOOT) {
      const theme = THEMES.find((t) => t.id === b.contribution.theme.themeId);
      expect(theme, `no theme "${b.contribution.theme.themeId}"`).toBeDefined();
      const resolved = resolveThemeBackdrop(theme!, images);
      expect(resolved.none).toBe(false);
      expect(resolved.art.size).toBe(3);
      // The role is bootstrap's, so a reader can tell whose cat it is.
      for (const [, img] of resolved.art) expect(img.src).toContain("bootstrap");
    }
  });

  test("the schema gives `theme` no default, so a layer cannot inherit a cat by silence", () => {
    // Unchanged, and still the mechanism: a default here is how a layer that
    // said nothing would end up wearing somebody else's theme.
    expect(() =>
      StickyContributionSchema.parse({ id: "x", order: 1, body: "words" }),
    ).toThrow();
  });

  test("every backdrop role a theme names has all three crops, or it serves none", () => {
    // The falsifier for the check above: `resolveThemeBackdrop` refuses an
    // incomplete backdrop WHOLESALE, so "resolved 3 layouts" is the only state
    // that renders art at all.
    const images = decl("cat-harness").images ?? [];
    const used = new Set(ALL.map((c) => c.contribution.theme.themeId));
    for (const id of used) {
      const theme = THEMES.find((t) => t.id === id)!;
      if (!theme.backdrop) continue;
      const r = resolveThemeBackdrop(theme, images);
      expect(r.missing, `${id} has a partial backdrop`).toEqual([]);
    }
  });
});

describe("order is DECLARED, not inherited from dependency resolution", () => {
  test("the description comes first and bootstrap's card comes last", () => {
    // The cost the work-plan item named before any of this was written: a
    // composed set with no declared order renders deepest-dependency-first,
    // which would put bootstrap above the layer's own description.
    const ids = built([...BOOT, ...CORE, ...CAT]).map((s) => s.id);
    expect(ids[0]).toBe("cat-harness");
    expect(ids.at(-1)).toBe("bootstrap");
  });

  test("the order survives the layers being read in the other sequence", () => {
    expect(built(ALL).map((s) => s.id)).toEqual(
      built([...BOOT, ...CORE, ...CAT]).map((s) => s.id),
    );
  });

  test("a tie breaks on layer then id, so the board is never read-order dependent", () => {
    const tie = (declaredBy: string, id: string): DeclaredContribution => ({
      contribution: StickyContributionSchema.parse({ id, order: 50, theme: { themeId: "pale-sage" }, body: "w" }),
      declaredBy,
      declaredIn: `${declaredBy}/harness.json`,
    });
    const a = [tie("b-layer", "zebra"), tie("a-layer", "yak"), tie("a-layer", "ant")];
    expect(composeContributions(a).map((d) => `${d.declaredBy}/${d.contribution.id}`)).toEqual([
      "a-layer/ant",
      "a-layer/yak",
      "b-layer/zebra",
    ]);
  });

  test("bootstrap declares the trailing order, and it is the shared constant", () => {
    expect(BOOT.map((b) => b.contribution.order)).toEqual([STICKY_ORDER_TRAILING]);
    expect(CAT[0]!.contribution.order).toBe(STICKY_ORDER_LEADING);
  });
});

describe("two layers cannot claim one sticky id", () => {
  test("a duplicate is REFUSED rather than letting the last writer win", () => {
    // The failure mode with no symptom: the id is the file name, so a collision
    // produces one file written twice and one layer's card simply absent.
    const dup = (declaredBy: string): DeclaredContribution => ({
      contribution: StickyContributionSchema.parse({
        id: "landing",
        order: 1,
        theme: { themeId: "pale-sage" },
        body: "w",
      }),
      declaredBy,
      declaredIn: `${declaredBy}/harness.json`,
    });
    expect(() => composeContributions([dup("one"), dup("two")])).toThrow(StickyIdConflictError);
  });

  test("the error names both layers, so the reader knows where to look", () => {
    const dup = (declaredBy: string): DeclaredContribution => ({
      contribution: StickyContributionSchema.parse({
        id: "landing",
        order: 1,
        theme: { themeId: "pale-sage" },
        body: "w",
      }),
      declaredBy,
      declaredIn: `${declaredBy}/harness.json`,
    });
    try {
      composeContributions([dup("alpha"), dup("beta")]);
      throw new Error("expected a conflict");
    } catch (e) {
      expect((e as StickyIdConflictError).message).toContain("alpha");
      expect((e as StickyIdConflictError).message).toContain("beta");
    }
  });

  test("the live board has no duplicate", () => {
    expect(() => composeContributions(ALL)).not.toThrow();
  });
});

describe("`body` and `bodyFrom` are exclusive — both is a contradiction, neither has no words", () => {
  test("both is refused", () => {
    expect(() =>
      StickyContributionSchema.parse({
        id: "x",
        order: 1,
        theme: { themeId: "pale-sage" },
        body: "w",
        bodyFrom: "description",
      }),
    ).toThrow();
  });

  test("neither is refused", () => {
    expect(() =>
      StickyContributionSchema.parse({ id: "x", order: 1, theme: { themeId: "pale-sage" } }),
    ).toThrow();
  });

  test("a misspelled key is refused rather than silently dropped", () => {
    expect(() =>
      StickyContributionSchema.parse({
        id: "x",
        order: 1,
        theme: { themeId: "pale-sage" },
        body: "w",
        onboardingLink: true,
      }),
    ).toThrow();
  });
});

describe("`bodyFrom` reads the DECLARING layer's fields", () => {
  test("bootstrap's card carries bootstrap's sentence, not this instance's", () => {
    // The defect that would make the seam pointless: a board of one sentence
    // repeated.
    const boot = sticky(BOOT, "bootstrap");
    // `startsWith` rather than equality: a card may APPEND to its description
    // (`bodyAppend`), which is how the scope line is added without copying the
    // sentence above it. What must hold is that the description is read from
    // the DECLARING layer and comes first, verbatim.
    expect(boot.comment.startsWith(decl("bootstrap").description!)).toBe(true);
    expect(boot.comment.startsWith(decl("cat-harness").description!)).toBe(false);
  });

  test("this instance's card carries its summary and its spellings, the landing's text", () => {
    const card = sticky(CAT, "cat-harness");
    const d = decl("cat-harness");
    // The owner's ruling on bean `ob3m` finding 3 (2026-10-01): "Stickies show
    // the same text as the landing page" — the declaration's `summary`, then
    // `alsoWritten` under "Also written". Read from the declaration rather
    // than copied, so it cannot drift from the one place it is written.
    expect(card.comment.startsWith(readerText(d)!)).toBe(true);
    expect(card.comment.startsWith(d.summary!)).toBe(true);
    // THE ACRONYM CHAIN, and the owner's instruction was explicit: "dont lose
    // acronym definitions". It is the Also written list now.
    expect(card.comment).toContain("Also written:");
    for (const form of ["caaat-harness", "ca&at-harness", "c@t-harness"]) {
      expect(card.comment).toContain(`\`${form}\``);
    }
    // Markdown, not an image, so it stays selectable and readable by a screen
    // reader.
    expect(card.comment).toContain("\n");
  });

  test("an instance with no description falls back to its NAME rather than failing", () => {
    // Deliberately a non-failure, carried over rather than re-decided:
    // initiation failing over a declaration nobody has filled in yet is worse
    // than a thin card.
    const s = stickyFromContribution(
      {
        contribution: StickyContributionSchema.parse({
          id: "x",
          order: 1,
          theme: { themeId: "pale-sage" },
          bodyFrom: "description",
        }),
        declaredBy: "some-instance",
        declaredIn: "some-instance/harness.json",
      },
      { createdAt: NOW },
    );
    expect(s.comment).toBe("some-instance");
  });

  test("a whitespace-only description falls back too", () => {
    const s = stickyFromContribution(
      {
        contribution: StickyContributionSchema.parse({
          id: "x",
          order: 1,
          theme: { themeId: "pale-sage" },
          bodyFrom: "description",
        }),
        declaredBy: "some-instance",
        declaredIn: "some-instance/harness.json",
        description: "   \n  ",
      },
      { createdAt: NOW },
    );
    expect(s.comment).toBe("some-instance");
  });
});

describe("it is page-global BY TYPE, not by convention", () => {
  const one = () => sticky(CAT, "cat-harness");

  test("the built sticky carries a page anchor", () => {
    expect(one().anchor).toEqual({ kind: "page", page: LANDING_STICKY_PAGE });
  });

  test("a BLOCK anchor is refused", () => {
    expect(() =>
      LandingStickySchema.parse({ ...one(), anchor: { kind: "block", block: "b1" } }),
    ).toThrow();
  });

  test("the `none` anchor is refused too", () => {
    expect(() => LandingStickySchema.parse({ ...one(), anchor: { kind: "none" } })).toThrow();
  });

  test("an ABSENT anchor is refused, unlike on the base note", () => {
    const { anchor: _anchor, ...withoutAnchor } = one();
    expect(() => LandingStickySchema.parse(withoutAnchor)).toThrow();
  });
});

describe("building it twice produces the same node — the idempotency key", () => {
  test("two calls with the same input are identical", () => {
    expect(built(ALL)).toEqual(built(ALL));
  });

  test("the id is declared, not derived from the description", () => {
    const d = CAT.find((c) => c.contribution.id === "cat-harness")!;
    const other = stickyFromContribution(
      { ...d, description: "something else entirely" },
      { createdAt: NOW },
    );
    expect(other.id).toBe("cat-harness");
  });

  test("`createdAt` is an argument, so the node does not move on its own", () => {
    const d = CAT[0]!;
    expect(stickyFromContribution(d, { createdAt: "2020-01-01T00:00:00.000Z" }).createdAt).toBe(
      "2020-01-01T00:00:00.000Z",
    );
  });
});

describe("an href may not resolve by luck — bean blv9", () => {
  const ACCEPTED = ["/guides/index.html", "https://example.org/x", "HTTPS://EXAMPLE.ORG/x"];
  const REFUSED = ["guides/index.html", "installation.html", "./x.html", "../x.html", ""];

  test.each(ACCEPTED)("accepts %s", (href) => {
    expect(() => LandingLinkSchema.parse({ label: "x", href })).not.toThrow();
  });

  test.each(REFUSED)("refuses %s", (href) => {
    expect(() => LandingLinkSchema.parse({ label: "x", href })).toThrow();
  });

  test("every default link is accepted by that rule", () => {
    for (const link of DEFAULT_ONBOARDING_LINKS) {
      expect(() => LandingLinkSchema.parse(link)).not.toThrow();
    }
  });

  test("every link in every live declaration is accepted by that rule", () => {
    // The declarations are now where links are authored, so this is the check
    // that matters. A bare-relative href in `harness.json` would otherwise reach
    // the page and resolve against whatever rendered it.
    const links = ALL.flatMap((c) => c.contribution.links);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(() => LandingLinkSchema.parse(link)).not.toThrow();
  });

  test("external links are DERIVED from the scheme, not declared", () => {
    expect(isExternalLink({ label: "x", href: "https://example.org" })).toBe(true);
    expect(isExternalLink({ label: "x", href: "/guides/index.html" })).toBe(false);
  });

  test("no default link is external, so all four take `relative_url`", () => {
    expect(DEFAULT_ONBOARDING_LINKS.filter(isExternalLink)).toEqual([]);
  });
});

describe("the four default links point at pages that EXIST", () => {
  // `siteDirFor` rather than the literal: the site root is one answer, derived
  // from the declaration, and `site-dir-single-answer.test.ts` fails any source
  // file that spells it out. A hardcoded one here would be right until a
  // layer chose differently, and then silently check nothing.
  const DOCS = join(INSTANCE, siteDirFor(INSTANCE));

  test.each(DEFAULT_ONBOARDING_LINKS.map((l) => l.href))("%s resolves to a source page", (href) => {
    const stem = href.replace(/^\//, "").replace(/\.html$/, "");
    const candidates = [`${stem}.md`, join(stem, "index.md"), `${stem}.html`];
    expect(candidates.some((c) => existsSyncSafe(join(DOCS, c)))).toBe(true);
  });

  test("the check CAN fire", () => {
    expect(existsSyncSafe(join(DOCS, "definitely-not-a-page.md"))).toBe(false);
  });

  test("there are four of them, in the order a reader meets them", () => {
    expect(DEFAULT_ONBOARDING_LINKS).toHaveLength(4);
    expect(DEFAULT_ONBOARDING_LINKS.map((l) => l.href)).toEqual([
      "/guides/beans-and-todos.html",
      "/start/getting-started.html",
      "/concepts/content-types.html",
      "/guides/index.html",
    ]);
  });
});

describe("EVERY declared link resolves to a page that exists", () => {
  // The onboarding four were already checked. This is the rest, and it is the
  // check the sub-graphs card needed: the owner asked for links, and a link
  // that 404s is worse than the naming-without-linking it replaced. Site-root
  // paths are resolved against the docs tree; absolute URLs are not fetched
  // (this suite does no network), so they are checked for shape only.
  const DOCS = join(INSTANCE, siteDirFor(INSTANCE));
  const siteLinks = ALL
    .flatMap((c) => c.contribution.links)
    .filter((l) => !isExternalLink(l));

  test("there are site links to check", () => {
    expect(siteLinks.length).toBeGreaterThan(3);
  });

  test.each(siteLinks.map((l) => [l.label, l.href] as const))(
    "%s -> %s resolves to a source page",
    (_label, href) => {
      const stem = href.replace(/^\//, "").replace(/\.html$/, "");
      const candidates = (s: string) => [`${s}.md`, join(s, "index.md"), `${s}.html`];
      // `/<instance>/<page>` is a page a layer above this one renders
      // into a docs directory it declares (`lib/docs-sources.ts`), composed
      // into the one site under the layer's own name.
      const [head, ...rest] = stem.split("/");
      const roots = [
        ...candidates(stem).map((c) => join(DOCS, c)),
        ...(rest.length > 0
          ? declaredDocsSources(join(REPO, head!)).flatMap((s) => candidates(rest.join("/")).map((c) => join(s.outDir, c)))
          : []),
      ];
      expect(roots.some((c) => existsSyncSafe(c))).toBe(true);
    },
  );

  test("every absolute link is https, not a bare host or http", () => {
    const abs = ALL.flatMap((c) => c.contribution.links).filter(isExternalLink);
    expect(abs.length).toBeGreaterThan(0);
    for (const l of abs) expect(l.href.startsWith("https://")).toBe(true);
  });
});

describe("`onboardingLinks` asks for the SET rather than copying it", () => {
  test("the flag appends all four, AFTER the layer's own links", () => {
    const card = sticky(CAT, "cat-harness");
    const own = CAT.find((c) => c.contribution.id === "cat-harness")!.contribution.links;
    expect(own.length).toBeGreaterThan(0);
    expect(card.links).toEqual([...own, ...DEFAULT_ONBOARDING_LINKS]);
  });

  test("no declaration copies the onboarding SET, which would be the BLOCK_KINDS shape", () => {
    // Relaxed from "no declaration reuses an onboarding href", which was too
    // strict and fired on something legitimate: the sub-graphs card links to
    // `/concepts/content-types.html` under the label "Content", and two cards pointing
    // at one page is normal. The failure this guards is a layer hand-COPYING
    // the set instead of asking for it with the flag — one enumeration in
    // several places, one of which goes short.
    const onboarding = new Set(DEFAULT_ONBOARDING_LINKS.map((l) => l.href));
    for (const c of ALL) {
      const copied = c.contribution.links.filter((l) => onboarding.has(l.href)).length;
      expect(copied).toBeLessThan(onboarding.size);
    }
  });

  test("without the flag a sticky carries exactly its declared links and no more", () => {
    const declared = CORE.find((c) => c.contribution.id === "folio-assist-core")!.contribution;
    expect(declared.onboardingLinks ?? false).toBe(false);
    expect(sticky(CORE, "folio-assist-core").links).toEqual([...declared.links]);
  });
});

describe("it is recognised by its declared tag, not by its shape", () => {
  test("the built sticky is recognised", () => {
    expect(isLandingSticky(sticky(CAT, "cat-harness"))).toBe(true);
  });

  test("a note that merely has the id is NOT", () => {
    expect(isLandingSticky({ id: "landing", summary: "x" })).toBe(false);
  });

  test("null and undefined do not throw", () => {
    expect(isLandingSticky(null)).toBe(false);
    expect(isLandingSticky(undefined)).toBe(false);
  });

  test("the tag is what the schema requires", () => {
    expect(sticky(CAT, "cat-harness").$schema).toBe(LANDING_STICKY_SCHEMA_TAG);
  });
});

describe("the summary is derived, not a second field to keep in step", () => {
  test("it is the body's first non-blank line when none is declared", () => {
    // A contribution with NO summary of its own. This used the cat-harness card,
    // which declares one, and passed only while that summary happened to equal
    // the description's first line.
    const landing = stickyFromContribution(
      {
        contribution: StickyContributionSchema.parse({
          id: "x",
          order: 1,
          theme: { themeId: "pale-sage" },
          bodyFrom: "summary",
        }),
        declaredBy: "some-instance",
        declaredIn: "some-instance/harness.json",
        summary: "First line.",
        alsoWritten: ["s0me-instance"],
      },
      { createdAt: NOW },
    );
    expect(landing.summary).toBe("First line.");
    expect(landing.comment).toBe("First line.\n\nAlso written: `s0me-instance`");
  });

  test("a declared summary wins", () => {
    expect(sticky(CORE, "folio-assist-core").summary).toBe("What a folio is");
  });
});

describe("the sub-graphs card says what the owner asked for", () => {
  const body = () => sticky(CORE, "folio-assist-core").comment;
  const links = () => sticky(CORE, "folio-assist-core").links;

  // It WAS two sentences with no links, on the owner's first instruction. The
  // second: "knwoedege graph (content, skills, process, tools) could be a but
  // more informative. needs links." Naming four things and giving a reader no
  // way to reach any of them is the state that was corrected, so the tests
  // check reachability now rather than brevity.
  test("it names all four sub-graphs, including `process`", () => {
    for (const word of ["Content", "Skills", "Processes", "Tools"]) {
      expect(body()).toContain(word);
    }
  });

  test("each of the four is LINKED, not merely named", () => {
    const labels = links().map((l) => l.label);
    for (const label of ["Content", "Skills", "Processes", "Tools"]) {
      expect(labels).toContain(label);
    }
  });

  test("acquisition is described as a STEP, not a fifth graph typology", () => {
    // `readDeclaration` throws on an unknown kind, so prose naming a fifth one
    // would send the next agent looking for a directory that is not there. The
    // card now says so outright instead of merely avoiding the word.
    expect(body()).toContain("acquisition");
    expect(body()).toMatch(/step rather than a graph typology/i);
  });

  test("it says where acquisition's two ends are, since they are real directories", () => {
    expect(body()).toContain("uploads/");
    expect(body()).toContain("library/");
  });
});

describe("the cat's introduction keeps the owner's own words", () => {
  test("verbatim, down to the shape of the sentence", () => {
    // APPENDED to this harness's card now rather than being a card of its own
    // — one card per harness — so containment rather than equality. The words
    // are unchanged, which is the point: the joke carries a real gloss on
    // "computable adjudication and agentic test harness".
    expect(sticky(CAT, "cat-harness").comment).toContain(
      "Please be introduced to a cat who acquires things, for whatever purpose — maybe somebody knows.",
    );
  });

  test("every card of this harness takes ONE theme — the convention", () => {
    // SUPERSEDES the earlier expectation that the description card took the
    // engineer theme while this one took plain grumpy cat. The owner set a
    // convention over that: "each harness hould have its own unique theme (by
    // convention)", and assigned it — "cat-harness=gumpy hoddie. test=engineer."
    //
    // So the two differing is no longer the point; the harness having one look
    // is. `engineer` is reserved for testing surfaces and is deliberately used
    // by nothing here.
    //
    // `grumpy-cyborg-agents` since 2026-09-24 — the same hoodie, on a sled pulled by robot
    // cats: "use this for the cat-harness theme, the current plain grump cat
    // them it is using should be for folio-assisnt-core".
    const themes = new Set(CAT.map((c) => c.contribution.theme.themeId));
    expect([...themes]).toEqual(["grumpy-cyborg-agents"]);
  });

  test("bootstrap does NOT share it, which is what makes the theme the harness's own", () => {
    const boot = new Set(BOOT.map((c) => c.contribution.theme.themeId));
    for (const t of boot) expect(t).not.toBe("grumpy-cyborg-agents");
  });

  test("its source link is absolute and does not point at this site", () => {
    const links = sticky(CAT, "cat-harness").links;
    const source = links.find((l) => isExternalLink(l))!;
    expect(source).toBeDefined();
    // A sticky on the landing page linking to the landing page is a link to
    // itself: cat-harness has no site of its own yet (issue #223).
    expect(source.href).not.toBe(decl("cat-harness").canonicalUrl);
  });

  test("it also carries an RTFM link to this harness's own docs", () => {
    // The owner: "all sticky notes should be ... provife links to that
    // harness's docs (RTFM=...)".
    const links = sticky(CAT, "cat-harness").links;
    expect(links.some((l) => /RTFM/i.test(l.label))).toBe(true);
  });
});

describe("bootstrap's card links to its source and does NOT invent a site", () => {
  test("it offers a source link", () => {
    const links = sticky(BOOT, "bootstrap").links;
    expect(links.length).toBeGreaterThan(0);
    // `/bootstrap`, not `/bootstrap` — the separator is a hyphen, so the
    // old substring stopped matching when the directory was renamed and this
    // assertion failed for the right reason. Verified against the real link:
    // `.../tree/main/bootstrap`.
    expect(links.some((l) => isExternalLink(l) && l.href.includes("/bootstrap"))).toBe(true);
  });

  test("it offers no link to a bootstrap site, because there is none", () => {
    // The owner asked for "link back to the source code + ghpaghes for boot
    // strrap". Bootstrap has no site — this layer's canonicalUrl is
    // cat-harness's — and a declared link to a page that does not exist is a
    // 404 on the landing page.
    const site = decl("cat-harness").canonicalUrl!;
    for (const l of sticky(BOOT, "bootstrap").links) expect(l.href.startsWith(site)).toBe(false);
  });
});

function existsSyncSafe(p: string): boolean {
  try {
    readFileSync(p);
    return true;
  } catch {
    return false;
  }
}

describe("sourceLinks — where a card's declaration can be read and edited", () => {
  const REPO = "https://github.com/litlfred/folio-assistant";

  test("both forms, because reading and editing are different acts", () => {
    // The owner: "edit tool = link to github pages edit directrly ... rendeding
    // shows edit src icon (and also need view icon)". `/blob/` reads and
    // `/edit/` opens the editor; a reader checking what a card says should not
    // land in a text box.
    //
    // A file the index checkout itself holds, since cat-harness, like every
    // other layer, became a remote mount of its own repository
    // (2026-10-09): `index.config.json` is the checkout's own.
    expect(sourceLinks(REPO, "index.config.json", "main")).toEqual({
      viewHref: `${REPO}/blob/main/index.config.json`,
      editHref: `${REPO}/edit/main/index.config.json`,
    });
  });

  // Both read the index checkout's mount lock, which a standalone
  // cat-harness checkout does not have (bean `ho66`).
  test.skipIf(!inAggregate())("a file in a remote mount is read and edited in the mount's own repository", () => {
    // Since the cutovers every layer here is a remote mount, and the lock
    // says where it came from: this checkout's forge holds no copy of it.
    expect(sourceLinks(REPO, "cat-harness/cat-harness.json", "main")).toEqual({
      viewHref: "https://github.com/litlfred/cat-harness/blob/main/cat-harness.json",
      editHref: "https://github.com/litlfred/cat-harness/edit/main/cat-harness.json",
    });
  });

  test("a file in a submodule is read and edited in the submodule's own repository", () => {
    // `bootstrap/` is litlfred/bootstrap since 2026-09-30 (bean `xsqm`): this
    // checkout's forge shows only a pointer there, so a link through it is dead.
    expect(sourceLinks(REPO, "bootstrap/bootstrap.json", "main")).toEqual({
      viewHref: "https://github.com/litlfred/bootstrap/blob/main/bootstrap.json",
      editHref: "https://github.com/litlfred/bootstrap/edit/main/bootstrap.json",
    });
  });

  test("with NO forge, it is ABSENT rather than broken", () => {
    // "if github tools avaialable in rendering pipeline". A link that 404s is
    // worse than no link: it invites a click, and on a private repository it
    // 404s for exactly the reader who cannot edit — which reads as "this page
    // is broken" rather than "you cannot do this".
    expect(sourceLinks(undefined, "bootstrap/bootstrap.json", "main")).toBeUndefined();
  });

  test.skipIf(!inAggregate())("the path is the CONTRIBUTING instance's, not a default", () => {
    // The falsifier that matters. Three layers contribute today, so a
    // resolver that always answered `cat-harness/harness.json` would be
    // silently right one time in three.
    const a = sourceLinks(REPO, "cat-harness/cat-harness.json", "main")!;
    const b = sourceLinks(REPO, "folio-assistant-core/folio-assistant-core.json", "main")!;
    expect(a.editHref).not.toEqual(b.editHref);
    // Each in its own repository, since both are remote mounts.
    expect(a.editHref).toBe("https://github.com/litlfred/cat-harness/edit/main/cat-harness.json");
    expect(b.editHref).toBe("https://github.com/litlfred/folio-assistant-core/edit/main/folio-assistant-core.json");
  });

  test("a branch other than main is honoured", () => {
    // `declaredIn` is a repo-relative PATH STRING, not a directory to look in
    // — `REPO` here is the remote URL. A codemod briefly passed this through
    // `findDeclarationFile`, which asked the filesystem about a URL.
    expect(sourceLinks(REPO, "index.config.json", "claude/x")!.editHref).toBe(`${REPO}/edit/claude/x/index.config.json`);
  });

  test("a path segment with a space survives as an escape, not as a break", () => {
    // Declarations do not have spaces today, but the queue this repository
    // ingests from is full of them, and a URL that breaks at the first space
    // is a link that silently points somewhere else.
    expect(sourceLinks(REPO, "some dir/some dir.json", "main")!.viewHref).toBe(
      `${REPO}/blob/main/some%20dir/some%20dir.json`,
    );
  });
});
