/**
 * A paper's glossary as `folio-glossary/v1` (bean `lqo9`, ruling 2: "Converge on SKOS").
 *
 * A fixture repository with TWO layers, each holding a paper named `alpha`:
 * the root layer and a sub-layer. The builder is run as a process (as a
 * paper's CI runs it), then core's `collect()` is asked what it sees.
 *
 * What must hold:
 * - the scheme validates as `folio-glossary/v1` and appears in `collect()`;
 * - status follows provenance: a definition block's term is `authored`, a
 *   term introduced in a theorem is `candidate`, a term with no `:defterm`
 *   paragraph is `could-not-extract` with its reason;
 * - IRIs are in the OWNING layer's namespace, the sub-layer's for its
 *   paper, so two papers with one name never collide;
 * - `glossary.json` keeps its shape (no new field), so a downstream
 *   `--check` does not fail on upgrade;
 * - `--check` fails on a stale scheme and passes on a current one.
 *
 * @module scripts/build-glossary-skos.test
 */
import { afterAll, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { GlossarySchema, schemeIri, termIri } from "../schemas/glossary.ts";
import { collect, instanceNs } from "./glossary-page.ts";
import { definingParagraph, localId } from "./build-glossary.ts";

const SCRIPT = resolve(import.meta.dir, "build-glossary.ts");
const TMP = mkdtempSync(join(tmpdir(), "paper-glossary-skos-"));
afterAll(() => rmSync(TMP, { recursive: true, force: true }));

function write(rel: string, body: string): void {
  const p = join(TMP, rel);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, body);
}

/** A layer declaring `folio/` and `glossary/`, with one paper `alpha` in it. */
function instance(dir: string, name: string): void {
  const at = (rel: string) => (dir ? `${dir}/${rel}` : rel);
  write(
    at(`${name}.json`),
    JSON.stringify({
      name,
      directories: [
        { id: "folio", path: "folio/", graphTypologies: ["folio"] },
        { id: "glossary", path: "glossary/", graphTypologies: ["glossary"] },
      ],
    }),
  );
  write(
    at("folio/alpha/alpha.ts"),
    `export default { title: "Alpha of ${name}", authors: ["A. Author"], chapters: [{ dir: "intro" }] };\n`,
  );
  write(
    at("folio/alpha/intro/intro.ts"),
    `export default { title: "Introduction", sections: [{ title: "Basics", blocks: ["def-foo", "thm-bar", "rem-qux"] }] };\n`,
  );
  write(
    at("folio/alpha/intro/def-foo.ts"),
    `export default { kind: "definition", label: "def:foo", defines: ["foo-bar"], lean: { decl: "Foo" } };\n`,
  );
  write(
    at("folio/alpha/intro/def-foo.md"),
    "Preamble paragraph.\n\nA :defterm[Foo bar]{#foo-bar} is a   set with a :refterm[baz].\n",
  );
  write(at("folio/alpha/intro/thm-bar.ts"), `export default { kind: "theorem", label: "thm:bar", defines: ["baz"] };\n`);
  write(at("folio/alpha/intro/thm-bar.md"), "Every set is a :defterm[baz] here.\n");
  // No .md at all: could-not-extract.
  write(at("folio/alpha/intro/rem-qux.ts"), `export default { kind: "remark", label: "rem:qux", defines: ["qux"] };\n`);
}

instance("", "rootfolio");
instance("subfolio", "subfolio");
// An authored glossary beside the root paper's, so the fixture holds both kinds.
write(
  "glossary/own.glossary.json",
  JSON.stringify({
    $schema: "folio-glossary/v1",
    id: "own",
    title: "Own terms",
    terms: [{ id: "foo-bar", prefLabel: "foo bar", definition: "An authored foo bar.", status: "authored" }],
  }),
);

function run(paperDir: string, check = false): { code: number | null; out: string } {
  const r = Bun.spawnSync(["bun", "run", SCRIPT, paperDir, ...(check ? ["--check"] : [])], { cwd: TMP });
  return { code: r.exitCode, out: new TextDecoder().decode(r.stdout) + new TextDecoder().decode(r.stderr) };
}

const rootRun = run(join(TMP, "folio/alpha"));
const subRun = run(join(TMP, "subfolio/folio/alpha"));

describe("paper glossary as SKOS", () => {
  it("builderRunsClean", () => {
    expect(rootRun.code).toBe(0);
    expect(subRun.code).toBe(0);
  });

  it("writesSchemeIntoGlossaryDir", () => {
    const raw = JSON.parse(readFileSync(join(TMP, "glossary/paper-alpha.glossary.json"), "utf-8"));
    const g = GlossarySchema.parse(raw);
    expect(g.id).toBe("paper-alpha");
    expect(g.terms.length).toBe(3);
  });

  it("statusByProvenance", () => {
    const g = GlossarySchema.parse(JSON.parse(readFileSync(join(TMP, "glossary/paper-alpha.glossary.json"), "utf-8")));
    const by = Object.fromEntries(g.terms.map((t) => [t.id, t]));
    expect(by["foo-bar"]!.status).toBe("authored");
    expect(by["foo-bar"]!.prefLabel).toBe("Foo bar");
    // Verbatim, directives replaced by their labels and whitespace folded.
    expect(by["foo-bar"]!.definition).toBe("A Foo bar is a set with a baz.");
    expect(by["foo-bar"]!.notation).toBe("foo-bar");
    expect(by["foo-bar"]!.source).toBe("folio/alpha/intro/def-foo.md#def:foo");
    expect(by["baz"]!.status).toBe("candidate");
    expect(by["baz"]!.definition).toBe("Every set is a baz here.");
    expect(by["qux"]!.status).toBe("could-not-extract");
    expect(by["qux"]!.definition).toBeUndefined();
    expect(by["qux"]!.reason).toContain("no .md body");
  });

  it("appearsInCollect", () => {
    const c = collect(TMP);
    expect(c.findings.invalid).toEqual([]);
    const papers = c.glossaries.filter((s) => s.glossary.id === "paper-alpha");
    expect(papers.map((s) => s.instance).sort()).toEqual(["rootfolio", "subfolio"]);
    for (const s of papers) expect(s.ns).toBe(instanceNs(s.instance));
    expect(papers.find((s) => s.instance === "subfolio")!.file).toBe("subfolio/glossary/paper-alpha.glossary.json");
  });

  it("noIriCollision", () => {
    const c = collect(TMP);
    const iris = c.glossaries.flatMap((s) => [
      schemeIri(s.ns, s.glossary),
      ...s.glossary.terms.map((t) => termIri(s.ns, s.glossary, t.id)),
    ]);
    // Vacuity floor: two papers of three terms, their two schemes, and the
    // authored scheme with its one term.
    expect(iris.length).toBeGreaterThanOrEqual(10);
    expect(new Set(iris).size).toBe(iris.length);
    // The same slug in the same-named paper of two layers is two concepts.
    const fooBar = iris.filter((i) => i.endsWith("/paper-alpha/foo-bar"));
    expect(fooBar.length).toBe(2);
  });

  it("glossaryJsonShapeKept", () => {
    const j = JSON.parse(readFileSync(join(TMP, "folio/alpha/glossary.json"), "utf-8"));
    expect(Object.keys(j).sort()).toEqual(["duplicates", "entries", "generated", "paper"]);
    expect(Object.keys(j.entries[0]).sort()).toEqual(["block", "chapter", "chapterTitle", "kind", "lean", "section", "slug"]);
  });

  it("checkPassesCurrentFailsStale", () => {
    expect(run(join(TMP, "folio/alpha"), true).code).toBe(0);
    const p = join(TMP, "glossary/paper-alpha.glossary.json");
    const good = readFileSync(p, "utf-8");
    writeFileSync(p, good.replace("A Foo bar is a set", "A Foo bar is a thing"));
    const stale = run(join(TMP, "folio/alpha"), true);
    writeFileSync(p, good);
    expect(stale.code).toBe(1);
    expect(stale.out).toContain("out of date");
  });

  it("refusesTakenSchemeId", () => {
    const p = join(TMP, "glossary/clash.glossary.json");
    writeFileSync(p, JSON.stringify({ $schema: "folio-glossary/v1", id: "paper-alpha", title: "clash", terms: [] }));
    const r = run(join(TMP, "folio/alpha"), true);
    rmSync(p);
    expect(r.code).toBe(1);
    expect(r.out).toContain('scheme id "paper-alpha" is already taken');
  });
});

describe("helpers", () => {
  it("localIdLowercases", () => {
    expect(localId("Foo Bar")).toBe("foo-bar");
    expect(localId("--x_y.z")).toBe("x_y.z");
  });
  it("definingParagraphFindsDefterm", () => {
    expect(definingParagraph("x\n\nA :defterm[Thing]{#thing-1} is.", "thing-1")?.text).toBe("A Thing is.");
    expect(definingParagraph("A :defterm[thing] is.", "thing")?.label).toBe("thing");
    expect(definingParagraph("A :refterm[thing] is.", "thing")).toBeUndefined();
  });
});

describe("an instance with no glossary directory", () => {
  it("noGlossaryDirStillWrites", () => {
    const bare = mkdtempSync(join(tmpdir(), "paper-glossary-bare-"));
    try {
      writeFileSync(
        join(bare, "bare.json"),
        JSON.stringify({ name: "bare", directories: [{ id: "folio", path: "folio/", graphTypologies: ["folio"] }] }),
      );
      mkdirSync(join(bare, "folio/p/intro"), { recursive: true });
      writeFileSync(join(bare, "folio/p/p.ts"), `export default { title: "P", authors: ["A"], chapters: [{ dir: "intro" }] };\n`);
      writeFileSync(join(bare, "folio/p/intro/intro.ts"), `export default { title: "I", sections: [{ title: "S", blocks: ["d"] }] };\n`);
      writeFileSync(join(bare, "folio/p/intro/d.ts"), `export default { kind: "definition", label: "def:d", defines: ["d"], lean: { decl: "D" } };\n`);
      const w = Bun.spawnSync(["bun", "run", SCRIPT, join(bare, "folio/p")], { cwd: bare });
      const out = new TextDecoder().decode(w.stdout);
      expect(w.exitCode).toBe(0);
      expect(out).toContain("SKOS scheme not written");
      expect(Bun.spawnSync(["bun", "run", SCRIPT, join(bare, "folio/p"), "--check"], { cwd: bare }).exitCode).toBe(0);
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });
});
