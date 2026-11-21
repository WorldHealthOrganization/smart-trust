/**
 * An avatar for every declared kind, in both schemes, in and out of trash.
 *
 * Bean `folio-assistant-4kj4`. Owner, 2026-09-19: *"each content type should
 * have an avatar in and out of trash. dark and light mode"* and *"QA
 * sidescares if avatar thems not fully done"*.
 *
 * @module scripts/tests/avatars.test
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { allAvatars, GENERIC, avatarFor, avatarKinds, hasAvatar } from "../../schemas/content/avatars.ts";
import { BASE_GRAPH_TYPOLOGIES, defaultGraphTypologies, layerRootsIn, readDeclaration } from "../../schemas/kg/cat-harness.ts";
import { avatarsCssPath, renderAvatarsCss } from "../gen-avatars-css.ts";
import { coverage, requiredKinds, trashDerivationPresent } from "../check-avatar-coverage.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { notApplicableAlone, siteNotBuilt } from "../../test/support/checkout.ts";

// The harness, whose avatars.css this reads; the test moved up in 70lx B2b.
const ROOT = HARNESS_ROOT;
const CSS_PATH = join(ROOT, avatarsCssPath(ROOT));
// `gen-avatars-css` writes it at publish and `.gitignore` keeps it out of a clone.
const CSS_NOT_BUILT = siteNotBuilt("the avatar stylesheet `gen-avatars-css` writes at publish (gitignored)", CSS_PATH);
const CSS = CSS_NOT_BUILT ? "" : readFileSync(CSS_PATH, "utf8");

describe("the registry", () => {
  test("it is not empty — the guard every count below needs", () => {
    expect(avatarKinds().length).toBeGreaterThan(10);
  });

  test("every declared graph typology has an avatar of its own", () => {
    // Named, not counted: `toHaveLength(n)` breaks on the next kind and says
    // nothing about which one is missing.
    const missing = defaultGraphTypologies.names().filter((k) => !hasAvatar(k));
    expect(missing).toEqual([]);
  });

  test("an unknown kind gets the question mark, not a blank", () => {
    // The third-state rule applied to art. A neutral dot would read as a
    // deliberate choice; a question mark reads as a gap, which is what it is.
    expect(avatarFor("no-such-kind-exists")).toBe(GENERIC);
    expect(GENERIC.reads).toContain("no avatar is declared");
  });

  test("every avatar says what it reads as", () => {
    // The field exists so the next person deciding whether to redraw one has
    // the intent rather than only the path data.
    for (const [kind, a] of allAvatars()) {
      expect(a.reads.length, `${kind} has no \`reads\``).toBeGreaterThan(8);
      expect(a.glyph.length, `${kind} has no glyph`).toBeGreaterThan(8);
    }
  });

  test("a tone is a HUE, so no kind can be authored into an unreadable corner", () => {
    // The whole reason the field is an angle and not a colour: lightness is
    // fixed per scheme by the generator, so legibility is not a per-kind
    // decision anybody can get wrong. `y8cm` and `rptk` are what that
    // prevents.
    for (const [kind, a] of allAvatars()) {
      expect(a.tone, `${kind}`).toBeGreaterThanOrEqual(0);
      expect(a.tone, `${kind}`).toBeLessThan(360);
      expect(Number.isInteger(a.tone), `${kind}`).toBe(true);
    }
  });

  test("no two kinds share a glyph", () => {
    // Two kinds that look identical convey nothing, and the fan would show
    // the same mark twice with no way to tell which was which.
    const byGlyph = new Map<string, string[]>();
    for (const [kind, a] of allAvatars()) {
      byGlyph.set(a.glyph, [...(byGlyph.get(a.glyph) ?? []), kind]);
    }
    const shared = [...byGlyph.values()].filter((ks) => ks.length > 1);
    expect(shared).toEqual([]);
  });
});

describe.skipIf(CSS_NOT_BUILT)("the generated stylesheet", () => {
  test("it is current — an edited node that was never regenerated fails here", () => {
    expect(CSS).toBe(renderAvatarsCss());
  });

  test("every kind is styled in BOTH schemes", () => {
    // The pair, not one of them. A kind coloured only for light is invisible
    // in dark and nothing else would say so.
    for (const [kind] of allAvatars()) {
      const light = CSS.match(new RegExp(`data-fa-scheme="light"[\\s\\S]*?${kind}"\\]`));
      const dark = CSS.match(new RegExp(`data-fa-scheme="dark"[\\s\\S]*?${kind}"\\]`));
      expect(light, `${kind} has no light rule`).not.toBeNull();
      expect(dark, `${kind} has no dark rule`).not.toBeNull();
    }
  });

  test("the dual guard is present, not just the explicit choice", () => {
    // `[data-fa-scheme]` alone leaves a reader who never chose with no art;
    // the media query alone leaves a reader who DID choose with the other
    // scheme's. This repo's standing pattern is both, and the `:not()` is
    // what stops the system preference overriding the explicit one.
    expect(CSS).toContain('@media (prefers-color-scheme: dark)');
    expect(CSS).toContain(':root:not([data-fa-scheme="light"])');
    expect(CSS).toContain('@media (prefers-color-scheme: light)');
    expect(CSS).toContain(':root:not([data-fa-scheme="dark"])');
  });

  test("the trash state is muted in both schemes, and never invisible", () => {
    // Muted is not hidden. An unreadable discarded item is a deleted one as
    // far as a reader is concerned, which is the rule fsh-guts exists to
    // uphold — so the lightness has to keep clearing the surface.
    const trashTones = [...CSS.matchAll(/data-fa-trash="true"\] \{ background-color: hsl\((\d+) (\d+)% (\d+)%\)/g)];
    expect(trashTones.length).toBeGreaterThan(20);
    for (const m of trashTones) {
      const sat = Number(m[2]);
      const light = Number(m[3]);
      expect(sat).toBeLessThan(25);          // muted
      expect(light).toBeGreaterThan(40);     // but not swallowed by either surface
      expect(light).toBeLessThan(70);
    }
  });

  test("the glyph is a mask, so the colour is a property and not an asset", () => {
    expect(CSS).toContain("--fa-avatar-glyph:");
    expect(CSS).toContain("mask-image: var(--fa-avatar-glyph)");
    // Unprefixed AND -webkit-: Safari still needs the prefix for masks, and
    // an avatar that is a solid square on one browser is worse than none.
    expect(CSS).toContain("-webkit-mask-image:");
  });

  test("the data URI is escaped, so it does not terminate early", () => {
    // `<` and `#` inside an unescaped data URI truncate it; the avatar then
    // renders as nothing, in every scheme, silently.
    expect(CSS).not.toMatch(/url\("data:image\/svg\+xml,<svg/);
    expect(CSS).toContain("%3Csvg");
  });
});

describe("coverage is a QA axis, not a promise", () => {
  test("the answer does not depend on what the caller imported", () => {
    // MEASURED, and it is why this test exists. `defaultGraphTypologies` is a live
    // registry that modules write into on import: run from the CLI the check
    // saw 16 kinds and reported full coverage, run inside the suite it saw
    // 17 — and the seventeenth was `folio`, the one RENDERABLE kind, with no
    // avatar at all. A check whose result changes with the importer is not a
    // check, so `requiredKinds` unions the base table in explicitly.
    const { required } = requiredKinds(ROOT);
    for (const k of Object.keys(BASE_GRAPH_TYPOLOGIES)) expect(required).toContain(k);
    // `folio` is registered ON IMPORT by `folio-graph-typology.ts` and is absent
    // from the base table, so it is the exact case the union exists for.
    expect(Object.keys(BASE_GRAPH_TYPOLOGIES)).not.toContain("folio");
    expect(required).toContain("folio");
    expect(hasAvatar("folio")).toBe(true);
  });

  test("it reports against the instance's OWN declaration, not just the registry", () => {
    // A layer may declare a kind the base registry never heard of, which
    // is what an open vocabulary is for. Checking only the registry would
    // report a clean run over exactly those.
    const { required, declared } = requiredKinds(ROOT);
    expect(declared.length).toBeGreaterThan(0);
    for (const d of declared) expect(required).toContain(d);
  });

  test("the real corpus is fully covered", () => {
    expect(coverage(ROOT).missing.map((m) => m.kind)).toEqual([]);
  });

  test("an INSTANCE-keyed avatar is REPORTED on the kind axis, not pruned", () => {
    // These two are keyed on a declared LAYER name, not on a graph typology —
    // `harness-tiles` calls `avatarFor(decl.name)`. So this check, which asks
    // only about kinds, is right to report them and will go on doing so.
    //
    // The comment here used to say they were "ahead of their declaration",
    // *"the split (#223) has not happened, so nothing declares them yet"*.
    // Both halves were false by 2026-09-21: `bootstrap/harness.json` and
    // `folio-assistant-core/harness.json` both exist and both declare a
    // `name`. The reason the finding is correct changed; the finding did not.
    //
    // It is `folio-assistant-core` and not `folio-assist-core`. The key was
    // the short spelling until bean `hso8`, so `avatarFor("folio-assistant-
    // core")` returned GENERIC — the question mark meaning "none declared" —
    // while the art sat under a name nothing carries. This assertion is what
    // now fails if the key drifts off the declared name again.
    //
    // Since sod4 #4 a layer's avatar lives on its own declaration, so
    // `folio-assistant-core` is no longer a table key and no longer reported.
    // `bootstrap` stays in the table (it is below the harness and declares no
    // avatar field of its own), so it still is.
    const orphaned = coverage(ROOT).orphaned;
    expect(orphaned).toContain("bootstrap");
    expect(orphaned).not.toContain("folio-assistant-core");
  });

  // The avatar now lives on folio-assistant-core's own declaration (sod4 #4),
  // so it resolves only where that higher layer is composed.
  const NO_CORE =
    !layerRootsIn(resolve(ROOT, "..")).some((r) => readDeclaration(r)?.name === "folio-assistant-core") &&
    notApplicableAlone("folio-assistant-core, whose declaration carries its avatar (an instance above the harness)");
  test.skipIf(NO_CORE)("and `folio-assistant-core` resolves to its own avatar, not the question mark", () => {
    expect(avatarFor("folio-assistant-core")).not.toBe(GENERIC);
  });

  test("every instance-keyed avatar resolves for the name an instance declares", () => {
    // The defect `hso8` left behind, stated as a property rather than as one
    // spelling: an avatar keyed on a layer must match a real declared
    // name, or it is unreachable AND counted as declared — worse than absent,
    // because coverage reads clean over it.
    // The REPOSITORY root, not `ROOT`. `ROOT` is this LAYER (`cat-harness/`)
    // and is the right argument for `coverage`, which asks what this layer
    // declares — but layer NAMES are a repository-level fact, and asking
    // `layerRootsIn(ROOT)` returns cat-harness's own subdirectories. The
    // two roots were the same directory before the split, which is why this
    // distinction is easy to get wrong and worth saying in place.
    const declared = new Set(
      layerRootsIn(resolve(ROOT, "..")).map((r) => readDeclaration(r)?.name),
    );
    for (const key of coverage(ROOT).orphaned) {
      expect([key, declared.has(key)]).toEqual([key, true]);
    }
  });

  test("the trash derivation is asserted once, and it is in place", () => {
    // A per-kind trash criterion could never fail, because the state is
    // composed rather than drawn — and a criterion that cannot fail reads as
    // coverage while measuring nothing.
    expect(trashDerivationPresent()).toBe(true);
  });
});
