/**
 * The living deck's alignment claims, re-checked against the KG — bean `scfh`.
 *
 * `docs/concepts/harnessed-kg-overview.md` says, slide by slide, where the 2026-09-30 snapshot
 * agrees with the knowledge graph and where it does not. Those sentences are
 * the part of the page that goes stale silently: the deck they came from went
 * stale exactly that way, which is why the owner asked for a living one. So each
 * claim the page makes about the KG is asserted here. When one fails, the KG
 * moved: update the slide's note in `docs/source/concepts-harnessed-kg-overview/` and this test
 * together. Do not relax the assertion alone.
 *
 * @module test/harnessed-kg-overview
 *
 * Moved here from `cat-harness/scripts/tests/harnessed-kg-overview.test.ts` to
 * the checkout's own test home `test/` (bean `7zz1`, owner ruling 2026-10-06
 * "Top-level instance"): every test in it checks a claim of the living deck
 * against the whole checkout — core's diagrams, smart-base's index, the root
 * `beans/`, which only the whole checkout holds. Standing alone, cat-harness
 * has none of it, and `check:cat-harness-standalone` collects every test in
 * that layer. Paths are composed from ORIGIN_DIR, the directory it was written
 * in, so nothing it reads changed.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "../support/site-fs.ts";
import { join, relative, resolve } from "node:path";
import { harnessPath } from "../../scripts/lib/harness-layout.ts";

import { siteDirFor } from "../../schemas/kg/cat-harness.ts";
import { ActorDefSchema } from "../../schemas/process/role-graph.ts";
import { ownKgRoots, workflowFile } from "../../scripts/known-skills.ts";
import { builtAtPublishOf } from "../../scripts/mount-from-lock.ts";
import { siteNotBuilt } from "../support/checkout.ts";

/** The directory this test was written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move to the checkout's test home (bean `7zz1`). */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");


const H = resolve(ORIGIN_DIR, "../..");
const REPO = resolve(H, "..");
const DECK = join(H, "docs/source/concepts-harnessed-kg-overview");
/** The published site root, from the declaration — never a literal. */
const SITE = join(H, siteDirFor(H));
const read = (p: string) => readFileSync(p, "utf-8");

/**
 * A skill's file, found under the layer's declared knowledge-graph roots
 * rather than at a literal path — skills move between topic directories
 * (`role-model` left `skills/folio-core/` for `skills/process/process-core/`).
 */
function skillFile(name: string): string {
  const hits: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === `${name}.md`) hits.push(p);
    }
  };
  for (const r of ownKgRoots(H)) if (existsSync(r)) walk(r);
  expect(hits, `skill ${name} under the declared kg roots`).toHaveLength(1);
  return hits[0]!;
}

describe("living deck: every claim about the KG still holds", () => {
  // Slide 1's claim (the layers page lists all five SMART layers) moved to
  // smart-base/scripts/who-smart-content-types.test.ts with the section it
  // reads, which is now smart-base's (bean p9bu).

  test("slide 6 — the lifecycle process has the five lanes, the work-plan store and the skills shown", () => {
    const x = read(workflowFile(H, "content-lifecycle.bpmn"));
    // The work plan is a data store, not a lane (core#487, Q-BR-3 A), and a
    // task names its skill in its extension elements, not in brackets in its
    // name (Q-RED-3 B). slide-06.md says the same; change both together.
    expect([...x.matchAll(/<bpmn:lane [^>]*name=/g)]).toHaveLength(5);
    expect(x).toMatch(/<bpmn:dataStoreReference [^>]*dataStoreRef="work-plan"/);
    for (const skill of ["content-plan", "todo-manager", "content-author", "content-test",
      "content-publish", "content-feedback", "content-retire"]) expect(x).toContain(`skill ref="${skill}"`);
  });

  test("slide 8 — the generated UML has the Voice Profile class the snapshot lacks", () => {
    expect(read(join(SITE, "assets/img/uml/harness-schemas.svg"))).toContain("VoiceProfileSchema");
  });

  test("slide 2 — the CDN decision is recorded, MADR-shaped, with at least two real options", () => {
    // In the store or its archive view: a settled decision is archived with
    // its bean, and an archived bean is still part of the store (cat-harness-tools#1248).
    const dirs = [join(REPO, "beans/defs"), join(REPO, "beans/defs/archive")].filter((d) => existsSync(d));
    const found = dirs
      .map((d) => ({ d, f: readdirSync(d).find((f) => f.startsWith("folio-assistant-l9v6")) }))
      .find((x) => x.f !== undefined);
    expect(found, "bean l9v6 (the CDN decision record) is missing").toBeDefined();
    const body = read(join(found!.d, found!.f!));
    const opts = body.split("## Considered options")[1]!.split("\n## ")[0]!.match(/^- /gm) ?? [];
    expect(opts.length).toBeGreaterThanOrEqual(2);
    expect(body).toContain("## Decision outcome");
  });

  // Slide 3's two claims (ten DAK components; the squares figure is current)
  // moved to smart-base/scripts/gen-dak-components-figure.test.ts with the
  // generator and the DAK vocabulary (bean 1335). Core no longer imports
  // either, so a core test asserting them would be core importing a harness.

  // The index is built from SMART Base's source at publish (fhir-harness#124),
  // not ingested once from the published site, so it holds the logical models
  // the source has now. The slide's 25 are the published set of 2026-09-30;
  // the claim that still holds is that the index carries at least those.
  test("slide 4 — the SMART Base index holds at least the 25 logical models the slide shows", () => {
    const ix = JSON.parse(read(join(REPO, "smart-base/fhir-artifact-index/index.json"))) as {
      artifacts: { resourceType: string; category?: string }[];
    };
    const models = ix.artifacts.filter((a) => a.resourceType === "StructureDefinition" && a.category === "Structures: Logical Models");
    expect(models.length).toBeGreaterThanOrEqual(25);
  });

  test("slide 10 — the taxonomy still uses smart-kg as its example, and says it is its own repository", () => {
    const t = read(join(SITE, "concepts/architecture/repo-taxonomy.md"));
    expect(t).toContain("`smart-kg` and `smart-kg-tools` is the worked example");
    // Either wording: the docs-QA pass wrote "is its own repository", and
    // cat-harness d9a8bb40 kept "is already its own repository".
    expect(t).toMatch(/`smart-kg` is (already )?its own repository/);
    // Its stub left this checkout for that reason (bean `wg7r`).
    expect(existsSync(join(REPO, "smart-kg"))).toBe(false);
  });

  test("slide 13 — three taskable actor kinds, plus `external`, and the skill says so", () => {
    const kinds = (ActorDefSchema.shape.kind as unknown as { options: string[] }).options;
    expect([...kinds].sort()).toEqual(["agent", "external", "person", "system"]);
    const skill = read(skillFile("role-model"));
    expect(skill).toContain("An actor is one of three kinds — human, agentic, mechanical");
    expect(skill).toMatch(/`external` is the fourth/);
  });

  // Written through `relative_url`: the page publishes under
  // `docs/cat-harness/concepts/` (bean `kc7k`), where a relative path would not reach `assets/`.
  const deckAssets = (): string[] => {
    const md = readdirSync(DECK).filter((f) => f.endsWith(".md")).map((f) => read(join(DECK, f))).join("\n");
    return [...md.matchAll(/\]\(\{\{ '\/(assets\/[^']+)' \| relative_url \}\}\)/g)].map((m) => m[1]!);
  };
  // Of those, the ones the publish build writes and `.gitignore` keeps out of
  // a clone — the declaration's `builtAtPublish` (bean w1gy F18). A committed
  // asset that is missing still fails below; only these can skip.
  const built = builtAtPublishOf(H);
  const publishBuilt = deckAssets()
    .map((a) => join(SITE, a))
    .filter((abs) => {
      const rel = relative(H, abs).split("\\").join("/");
      return built.some((e) => rel === e || (e.endsWith("/") && rel.startsWith(e)));
    });
  test.skipIf(publishBuilt.length > 0 && siteNotBuilt("the deck's drawings the publish build writes (gitignored)", ...publishBuilt))(
    "every generated asset the deck shows exists",
    () => {
      const assets = deckAssets();
      expect(assets.length).toBeGreaterThan(0);
      for (const a of assets) expect(existsSync(join(SITE, a)), a).toBe(true);
    },
  );

  test("every deck picture the page shows exists, and is the library entry's own image", () => {
    const md = readdirSync(DECK).filter((f) => f.endsWith(".md")).map((f) => read(join(DECK, f))).join("\n");
    const shown = [...new Set([...md.matchAll(/'\/(assets\/img\/kg-deck\/[^']+)' \| relative_url/g)].map((m) => m[1]!))];
    expect(shown.length).toBeGreaterThan(0);
    const entry = harnessPath("library/corpus/content/kg-folio-asst-2026-09-30", H);
    const raw = JSON.parse(read(join(entry, "images.json"))) as unknown;
    const recs = (Array.isArray(raw) ? raw : (raw as { images: unknown[] }).images) as Array<{ file: string }>;
    const held = new Set(recs.map((r) => resolve(entry, r.file)));
    for (const a of shown) {
      expect(existsSync(join(SITE, a)), a).toBe(true);
      expect(held.has(join(SITE, a)), `${a} is not an image of the library entry`).toBe(true);
    }
  });
});
