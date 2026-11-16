/**
 * `kg-export` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness-tools/scripts/tests/kg-export.test.ts` (bean `7zz1`, owner ruling
 * 2026-10-06 "Top-level instance"): each exports the graph of every layer
 * in the checkout, who-iris's packages among them, which only the checkout
 * holds. Standing alone, cat-harness has none of it, and
 * `check:cat-harness-standalone` collects every test in that layer. The rest
 * of that file's tests stay there; every path here is composed from
 * ORIGIN_DIR, the directory they were written in, so nothing they read
 * changed.
 */
import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";
import { readFileSync } from "node:fs";

import { buildExport } from "../../scripts/kg-export.js";
import { declaresOwnCanonical } from "../../scripts/instance-exports.js";
import { layerRootsIn, readDeclaration, repoRootFor } from "../../schemas/kg/cat-harness.js";
import { termIri } from "../../schemas/kg/namespaces.js";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

// The repo's own canonicalUrl, so the shared fixture is the CANONICAL export.
// Using an arbitrary base made it a preview, which (correctly) gave it an
// array `@type` and 968 alternateOf links — caught by the self-identification
// test below, which is the test doing its job.
const BASE = readDeclaration(join(ORIGIN_DIR, "../.."))!.canonicalUrl!;
const REPO = repoRootFor(join(ORIGIN_DIR, "../.."));
const EXPORT = await buildExport();
/**
 * The CHECKOUT-scope graph — every layer stacked on this one, under this
 * document's name. Not published since bean `4ak5` item 2 (owner ruling
 * 2026-10-05, option B): it is what the tombstones are measured against, and
 * the only graph still holding a package whose manifest name differs from its
 * directory, which the package-id witness below needs.
 */
const EXPORT_CHECKOUT = await buildExport({ baseUrl: BASE, scope: "checkout" });

/*
 * THE SPLIT — bean `4ak5` item 2, owner ruling 2026-10-05 (option B).
 *
 * `cat-harness.jsonld` is built in layer scope: cat-harness's own declared
 * directories only. Measured the day it landed, the checkout-scope document
 * it replaced carried 825 nodes of five other layers under
 * `cat-harness.jsonld#…` fragments. Each such `@id` keeps a tombstone for ONE
 * release, forwarding to the same node in its owner's published document —
 * GitHub Pages cannot redirect a fragment. Remove the tombstone tests with
 * `tombstonesFor`.
 */
const OWNER_EXPORTS = new Map<string, Set<string>>();
/** The same builds, whole, by layer root — for the schema-link tests below. */
const OWNER_DOCS = new Map<string, Awaited<ReturnType<typeof buildExport>>>();
for (const r of layerRootsIn(REPO)) {
  if (resolve(r) === resolve(join(ORIGIN_DIR, "../.."))) continue;
  const own = declaresOwnCanonical(readDeclaration(r));
  const e = await buildExport({ instanceRoot: r, ...(own ? {} : { baseUrl: BASE }) });
  OWNER_EXPORTS.set(String(e["@id"]), new Set((e["@graph"] as Array<{ "@id": string }>).map((n) => n["@id"])));
  OWNER_DOCS.set(resolve(r), e);
}

describe("kg export", () => {

  test("internal links resolve, bar the known data defects", () => {
    // 4 on this branch, every one a manifest naming something nobody wrote
    // (bean `nup0`) — data, not export failures, so they are reported in the
    // document rather than thrown. The number may only go DOWN.
    expect(EXPORT.danglingLinks.length).toBeLessThanOrEqual(4);
    for (const d of EXPORT.danglingLinks) {
      expect(["declaresSkill", "providesCapability"]).toContain(d.edge);
    }
  });
});

describe("a package's id is declared, not derived from its path", () => {

  // Over the CHECKOUT graph, where the witness below lives (bean `4ak5`).
  const membersOf = (pkgIri: string): string[] =>
    EXPORT_CHECKOUT["@graph"]
      .filter((n) => {
        const links = (n as { inPackage?: Array<string | { "@id": string }> }).inPackage ?? [];
        return links.some((l) => (typeof l === "string" ? l : l["@id"]) === pkgIri);
      })
      // `<kind>/<id>`, the tail of a subject path (#603) — or of a fragment,
      // the form before it.
      .map((n) => String(n["@id"]).replace(/^.*[#/]([^/#]+\/[^/#]+)$/, "$1"));

  // WITNESS RETARGETED TWICE, and the second time is the lesson landing.
  //
  // These three guard `packageIdFor`'s rule — an id comes from the manifest's
  // `name`, never from the directory basename — against the real corpus. The
  // witness was `bootstrap` until the `pve3` ruling removed it from this
  // graph, then `bootstrap-render` (directory `tools/`) until bean `n350`
  // consolidated that package into `bootstrap/skills/` on 2026-09-23.
  //
  // It is now `who-iris`: directory `who-iris/skills/`, basename `skills`,
  // manifest `who-iris`. (It was `large-datasets` until bean `j7ql` dissolved
  // that layer into cat-harness on 2026-10-01, where its package sits at
  // `cat-harness/skills/library/large-datasets/` and the basename IS the name;
  // before that `kg-navigation`, until bean `byql` folded it into
  // `cat-harness/skills/kg/kg-navigation/` for the same reason.) Same shape,
  // and a witness the root graph carries for its own reasons rather than by a
  // declaration made for one package. The members are READ from its manifest
  // rather than listed, so adding a skill there is not a test edit.
  //
  // Read from the CHECKOUT-scope graph since bean `4ak5` item 2: who-iris is
  // its own layer, so the published graph holds a tombstone where its
  // package was (asserted below), and no package of cat-harness's own has a
  // manifest name that differs from its directory. The rule is
  // `packageIdFor`'s, which runs the same in either scope.
  const WITNESS = "who-iris";
  const checkoutPackages = (): Array<Record<string, unknown>> =>
    (EXPORT_CHECKOUT["@graph"] as Array<Record<string, unknown>>).filter((n) => n["@type"] === termIri("SkillPackage"));
  // A subject path since #603: `<doc dir>/package/<name>`.
  const witness = () => checkoutPackages().find((x) => String(x["@id"]).endsWith(`/package/${WITNESS}`));

  test("a package is named by its manifest, not by its directory", () => {
    const p = witness();
    expect(p, `packages present: ${checkoutPackages().map((x) => x["name"]).join(", ")}`).toBeDefined();
    expect(p!["name"]).toBe(WITNESS);
    expect(String(p!["path"])).toContain("who-iris/skills");
    // And the basename is NOT what it is called — the assertion the rule is
    // actually about, which naming the package alone does not make.
    expect(p!["name"]).not.toBe("skills");
  });

  test("its members are that package's own skills and nothing else", () => {
    // Against the manifest, because what the collision produced was a member
    // from ANOTHER package — a count would have gone on passing while one
    // name was swapped for another.
    const manifest = JSON.parse(
      readFileSync(join(ORIGIN_DIR, "../../..", "who-iris", "skills", "package-manifest.json"), "utf8"),
    ) as { skills: string[] };
    expect(membersOf(String(witness()!["@id"])).sort()).toEqual(manifest.skills.map((k) => `skill/${k}`).sort());
  });

  test("`corpus-grep` is NOT among them — the contamination the merge caused", () => {
    // The sharpest assertion here, because it is the one that was false and
    // that every other signal called healthy. `corpus-grep` is folio-core's.
    expect(membersOf(String(witness()!["@id"]))).not.toContain("skill/corpus-grep");
  });
});
