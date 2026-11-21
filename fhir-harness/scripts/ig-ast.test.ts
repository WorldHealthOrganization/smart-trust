/**
 * The consumer half of the IG AST (bean `a9tx`): read, check against the
 * IG's current inputs, diff two ASTs, and render the delta for just-the-docs.
 * Fixtures are hand-written ASTs in the `ig-ast/v1` shape the Java
 * `ast-export` library writes.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

import { astJsonLd, astValidity, buildKind, cachedStepLine, refuseIncremental, diffAst, igAstSchemaFiles, inputDigest, inputDigestAt, listAst, readAst, recordSourceInputs, renderDelta } from "./ig-ast";
import { igAstJsonSchemas } from "../schemas/ig-ast.ts";
import Ajv from "ajv";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});
const tmp = (p: string) => {
  const d = mkdtempSync(join(tmpdir(), p));
  made.push(d);
  return d;
};
const put = (root: string, rel: string, text: string) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
};

const X = "http://x/";
type R = { type: string; id: string; json: Record<string, unknown>; builtAt?: string };

function ast(rs: R[], edges: Array<[string, string, string, string | null]>, extra: Record<string, unknown> = {}): string {
  const dir = tmp("ast-");
  const resources = rs.map((r) => {
    const url = r.json.url as string | undefined;
    const version = (r.json.version as string | undefined) ?? null;
    const key = url ? (version ? `${url}|${version}` : url) : `${r.type}/${r.id}`;
    const file = `resources/${r.type}/${r.id}.json`;
    put(dir, file, JSON.stringify({ resourceType: r.type, id: r.id, ...r.json }, null, 2));
    return { key, canonical: url ?? null, version, resourceType: r.type, id: r.id, file, source: null, ...(r.builtAt ? { builtAt: r.builtAt } : {}) };
  });
  put(dir, "manifest.json", JSON.stringify({ $schema: "ig-ast/v1", authority: "cache", provisional: ["indices", "dependencies", "versions"], resources, ...extra }));
  put(
    dir,
    "dependencies.json",
    JSON.stringify({
      $schema: "ig-ast-dependencies/v1",
      dependencies: edges.map(([source, kind, target, v]) => ({ source, kind, target, targetVersion: v, resolved: null, origin: "ast-export" })),
    }),
  );
  return dir;
}

const libA = (extra: Record<string, unknown> = {}) => ({ type: "Library", id: "A", json: { url: X + "Library/A", version: "1.0.0", name: "A", ...extra } });
const libB = (v: string) => ({ type: "Library", id: "B", json: { url: X + "Library/B", version: v, name: "B" } });
const pd = { type: "PlanDefinition", id: "PD", json: { url: X + "PlanDefinition/PD", version: "1.0.0", library: [X + "Library/A"] } };
const pat = { type: "Patient", id: "p1", json: { active: true } };

describe("inputDigest — the same algorithm as the Java InputDigest", () => {
  test("goldenDigestVector", () => {
    const ig = tmp("golden-");
    put(ig, "sushi-config.yaml", "id: x\n");
    put(ig, "ig.ini", "[IG]\nig = fsh-generated/resources/ImplementationGuide-x.json\n");
    put(ig, "input/fsh/a.fsh", "Profile: A\n");
    put(ig, "input/pagecontent/index.md", "# Hi\n");
    put(ig, "output/x.html", "noise");
    expect(inputDigest(ig)).toBe("58871352384745e1d7fd68f7ea918b0e2febbd86cf36a9cb5f0c7ce9d13a82f1");
  });

  test("gitIgnoredNotInput", () => {
    const ig = tmp("gitdigest-");
    put(ig, "sushi-config.yaml", "id: x\n");
    put(ig, "input/fsh/a.fsh", "Profile: A\n");
    put(ig, ".gitignore", ".DS_Store\n");
    const git = (...a: string[]) => spawnSync("git", a, { cwd: ig, encoding: "utf-8" });
    git("init", "-q");
    git("-c", "user.email=t@t", "-c", "user.name=t", "add", ".");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "base");
    const clean = inputDigest(ig);

    put(ig, "input/.DS_Store", "finder noise");
    expect(inputDigest(ig)).toBe(clean);

    put(ig, "input/fsh/b.fsh", "Profile: B\n");
    expect(inputDigest(ig)).not.toBe(clean);
  });
});

describe("validity — compiledValidity on the manifest's inputs", () => {
  function igRepo() {
    const ig = tmp("ig-");
    put(ig, "sushi-config.yaml", "id: x\n");
    put(ig, "input/fsh/a.fsh", "Profile: A\n");
    const git = (...a: string[]) => spawnSync("git", a, { cwd: ig, encoding: "utf-8" });
    git("init", "-q");
    git("-c", "user.email=t@t", "-c", "user.name=t", "add", ".");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "base");
    return { ig, rev: git("rev-parse", "HEAD").stdout.trim() };
  }

  test("currentInputsValid", () => {
    const { ig, rev } = igRepo();
    const a = readAst(ast([pat], [], { inputs: { toolchain: "ig-publisher 2.3.4 / core 6.6.0", sourceRevision: rev, inputDigest: inputDigest(ig) } }));
    expect(astValidity(a, ig).verdict).toBe("valid");
  });

  test("editedInputStale", () => {
    const { ig, rev } = igRepo();
    const a = readAst(ast([pat], [], { inputs: { toolchain: "t", sourceRevision: rev, inputDigest: inputDigest(ig) } }));
    put(ig, "input/fsh/a.fsh", "Profile: A2\n");
    const v = astValidity(a, ig);
    expect(v.verdict).toBe("stale-inputs");
    expect(v.detail).toEqual({ verdict: "stale-inputs", differs: ["inputDigest"] });
  });

  test("laterCommitInputsDecide", () => {
    const { ig, rev } = igRepo();
    const a = readAst(ast([pat], [], { inputs: { toolchain: "t", sourceRevision: rev, inputDigest: inputDigest(ig) } }));
    const git = (...x: string[]) => spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...x], { cwd: ig, encoding: "utf-8" });
    put(ig, "README.md", "not an input\n");
    git("add", ".");
    git("commit", "-qm", "readme");
    expect(astValidity(a, ig).verdict).toBe("valid");
    put(ig, "input/fsh/a.fsh", "Profile: A2\n");
    git("add", ".");
    git("commit", "-qm", "input");
    expect(astValidity(a, ig).detail).toEqual({ verdict: "stale-inputs", differs: ["sourceRevision", "inputDigest"] });
  });

  test("nonAncestorRevisionStale", () => {
    const { ig } = igRepo();
    const a = readAst(ast([pat], [], { inputs: { toolchain: "t", sourceRevision: "f".repeat(40), inputDigest: inputDigest(ig) } }));
    expect(astValidity(a, ig).detail).toEqual({ verdict: "stale-inputs", differs: ["sourceRevision"] });
  });

  test("driftStalesWorkTreeNotCommit", () => {
    // smart-trust run 38609595363: the Publisher rendered images-source into
    // input/images, overwriting a tracked SVG and adding an untracked one.
    const { ig, rev } = igRepo();
    put(ig, "input/images/a.svg", "<svg>committed</svg>\n");
    const git = (...x: string[]) => spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...x], { cwd: ig, encoding: "utf-8" });
    git("add", ".");
    git("commit", "-qm", "image");
    const head = git("rev-parse", "HEAD").stdout.trim();
    const clean = inputDigest(ig);
    expect(inputDigestAt(ig, "HEAD")).toBe(clean);
    const a = readAst(ast([pat], [], { inputs: { toolchain: "t", sourceRevision: head, inputDigest: clean } }));
    put(ig, "input/images/a.svg", "<svg>re-rendered</svg>\n");
    put(ig, "input/images/b.svg", "<svg>new</svg>\n");
    expect(inputDigest(ig)).not.toBe(clean);
    expect(astValidity(a, ig).detail).toEqual({ verdict: "stale-inputs", differs: ["inputDigest"] });
    expect(inputDigestAt(ig, "HEAD")).toBe(clean);
    expect(astValidity(a, ig, undefined, { at: "HEAD" }).verdict).toBe("valid");
    // The commit is still the subject: a committed input change is stale at HEAD too.
    put(ig, "input/fsh/a.fsh", "Profile: A3\n");
    git("add", "input/fsh/a.fsh");
    git("commit", "-qm", "edit");
    expect(astValidity(a, ig, undefined, { at: "HEAD" }).detail).toEqual({ verdict: "stale-inputs", differs: ["sourceRevision", "inputDigest"] });
    // A revision that does not resolve states no digest: cannot-tell, never valid.
    expect(astValidity(a, ig, undefined, { at: "f".repeat(40) }).verdict).toBe("cannot-tell");
    expect(rev).not.toBe(head);
  });

  test("newerPublisherStale", () => {
    const { ig, rev } = igRepo();
    const a = readAst(ast([pat], [], { inputs: { toolchain: "ig-publisher 2.3.4 / core 6.6.0", sourceRevision: rev, inputDigest: inputDigest(ig) } }));
    expect(astValidity(a, ig, "ig-publisher 2.3.5 / core 6.6.1").detail).toEqual({ verdict: "stale-inputs", differs: ["toolchain"] });
  });

  test("noUsableInputsCannotTell", () => {
    const { ig } = igRepo();
    expect(astValidity(readAst(ast([pat], [])), ig).verdict).toBe("cannot-tell");
    const legacy = readAst(ast([pat], [], { inputs: { toolchain: "t", sourceRevision: "r", inputDigest: "sha256:" + "0".repeat(64) } }));
    expect(astValidity(legacy, ig).verdict).toBe("cannot-tell");
  });
});

describe("cachedStepLine — the fhir-ast cache's summary, in cached-step's format", () => {
  const base = { recorded: undefined, current: {} } as unknown as Omit<Parameters<typeof cachedStepLine>[0], "verdict" | "detail">;
  const KEY = "a".repeat(64);
  test("a valid AST restored as it was is a hit, keyed by the input digest", () => {
    const line = cachedStepLine({ ...base, verdict: "valid", detail: { verdict: "valid" } }, KEY);
    expect(line).toBe(`**cached-step \`ig-ast\`: hit** (exact) — built from the inputs this tree has. Key \`${KEY}\`.`);
  });
  test("a valid AST the refresh made from a delta is warm", () => {
    expect(cachedStepLine({ ...base, verdict: "valid", detail: { verdict: "valid" } }, KEY, { warm: true })).toStartWith("**cached-step `ig-ast`: warm** (exact) — a delta was applied");
  });
  test("stale and cannot-tell are misses that say why; warm never turns a miss into a hit", () => {
    expect(cachedStepLine({ ...base, verdict: "stale-inputs", detail: { verdict: "stale-inputs", differs: ["inputDigest"] } }, KEY, { warm: true })).toBe(
      `**cached-step \`ig-ast\`: miss** (exact) — stale: inputDigest differ. Key \`${KEY}\`.`,
    );
    expect(cachedStepLine({ ...base, verdict: "cannot-tell", detail: { verdict: "cannot-tell", why: "no manifest" } }, undefined)).toBe(
      "**cached-step `ig-ast`: miss** (exact) — cannot tell: no manifest. Key `unknown`.",
    );
  });
});

describe("source-inputs — an AST exported after a pre-export command", () => {
  function igRepo() {
    const ig = tmp("ig-");
    put(ig, "sushi-config.yaml", "id: x\n");
    put(ig, "input/fsh/a.fsh", "Profile: A\n");
    const git = (...a: string[]) => spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...a], { cwd: ig, encoding: "utf-8" });
    git("init", "-q");
    git("add", ".");
    git("commit", "-qm", "base");
    return { ig, git, rev: git("rev-parse", "HEAD").stdout.trim() };
  }

  test("preparedTreeRecordsSource", () => {
    const { ig, git, rev } = igRepo();
    const source = inputDigest(ig);
    // The pre-export command: rewrites a tracked input and adds an untracked one.
    put(ig, "sushi-config.yaml", "id: x\npages: {}\n");
    put(ig, "input/pagecontent/generated.md", "placeholder\n");
    const prepared = inputDigest(ig);
    expect(prepared).not.toBe(source);
    const dir = ast([pat], [], { inputs: { toolchain: "t", sourceRevision: rev, inputDigest: prepared } });
    // ...the export, then the tree put back as the workflow does.
    git("checkout", "-q", "HEAD", "--", "sushi-config.yaml", "input");
    git("clean", "-fdq", "--", "sushi-config.yaml", "input");
    expect(inputDigest(ig)).toBe(source);
    expect(astValidity(readAst(dir), ig).verdict).toBe("stale-inputs");

    expect(recordSourceInputs(dir, source, "bash overlay/pre.sh")).toEqual({ prepared, source });
    const m = readAst(dir).manifest as Record<string, unknown>;
    expect(m.preExport).toEqual({ command: "bash overlay/pre.sh", preparedInputDigest: prepared });
    expect(astValidity(readAst(dir), ig).verdict).toBe("valid");
  });

  test("refusesDishonestRecord", () => {
    const { rev } = igRepo();
    const none = ast([pat], []);
    expect(() => recordSourceInputs(none, "a".repeat(64), "cmd")).toThrow(/records no inputs.inputDigest/);
    const dir = ast([pat], [], { inputs: { toolchain: "t", sourceRevision: rev, inputDigest: "b".repeat(64) } });
    expect(() => recordSourceInputs(dir, "not-a-digest", "cmd")).toThrow(/not a sha256/);
    expect(() => recordSourceInputs(dir, "a".repeat(64), " ")).toThrow(/no pre-export command/);
    recordSourceInputs(dir, "a".repeat(64), "cmd");
    expect(() => recordSourceInputs(dir, "c".repeat(64), "cmd")).toThrow(/already records a preExport/);
  });

  test("cliPrintsSameDigest", () => {
    const { ig } = igRepo();
    const r = spawnSync("bun", ["run", join(import.meta.dir, "ig-ast.ts"), "digest", "--ig", ig], { encoding: "utf-8" });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe(inputDigest(ig));
  });
});

describe("diff — list and view what changed between two ASTs", () => {
  const base = () =>
    readAst(ast([libA(), libB("1.0.0"), pd, pat], [
      [X + "Library/A|1.0.0", "relatedArtifact.depends-on", X + "Library/B", "1.0.0"],
      [X + "PlanDefinition/PD|1.0.0", "library", X + "Library/A", null],
    ]));
  const head = () =>
    readAst(
      ast(
        [
          libA({ relatedArtifact: [{ type: "depends-on", resource: X + "Library/B|1.1.0" }] }),
          libB("1.1.0"),
          { type: "Measure", id: "M", json: { url: X + "Measure/M", library: [X + "Library/A"] }, builtAt: "h".repeat(40) },
          pat,
        ],
        [
          [X + "Library/A|1.0.0", "relatedArtifact.depends-on", X + "Library/B", "1.1.0"],
          [X + "Measure/M", "library", X + "Library/A", null],
        ],
        { mixed: true },
      ),
    );

  test("diffEveryStatus", () => {
    const d = diffAst(base(), head());
    expect(d.counts).toEqual({ added: 1, removed: 1, changed: 1, versionChanged: 1, unchanged: 1 });
    const by = Object.fromEntries(d.resources.map((r) => [r.id, r]));
    expect(by.B!.status).toBe("versionChanged");
    expect([by.B!.baseVersion, by.B!.headVersion]).toEqual(["1.0.0", "1.1.0"]);
    expect(by.PD!.status).toBe("removed");
    expect(by.M!.status).toBe("added");
    expect(by.A!.changes).toEqual([{ path: "Library.relatedArtifact", op: "added", head: [{ type: "depends-on", resource: X + "Library/B|1.1.0" }] }]);
  });

  test("diffEdgesAndProvenance", () => {
    const d = diffAst(base(), head());
    expect(d.edges.added.map((e) => e.source)).toEqual([X + "Library/A|1.0.0", X + "Measure/M"]);
    expect(d.edges.removed.map((e) => e.source)).toEqual([X + "Library/A|1.0.0", X + "PlanDefinition/PD|1.0.0"]);
    expect(d.head.mixed).toBe(true);
    expect(d.authority).toBe("cache");
  });

  test("identicalEmptyDelta", () => {
    const d = diffAst(base(), base());
    expect(d.resources).toEqual([]);
    expect(d.counts.unchanged).toBe(4);
  });

  test("listByTypeAndOrigin", () => {
    const l = listAst(head());
    expect(l.byType).toEqual({ Library: 2, Measure: 1, Patient: 1 });
    expect(l.mixed).toBe(true);
    expect(l.builtAt["h".repeat(40)]).toBe(1);
  });
});

describe("render — just-the-docs pages for the delta", () => {
  const page = (pages: string[], prefix: string) => pages.find((p) => p.split("/").pop()!.startsWith(prefix))!;

  test("renderIndexAndPages", () => {
    const b = readAst(ast([libA(), libB("1.0.0")], []));
    const h = readAst(ast([libA({ description: "uses {{ site.data.fhir.ig.version }} | and a pipe" }), libB("1.1.0")], []));
    const site = tmp("site-");
    const pages = renderDelta(diffAst(b, h), site, { title: "AST delta" });
    expect(pages.length).toBe(3);
    for (const p of pages) {
      const t = readFileSync(p, "utf-8");
      expect(t).toContain("Provisional — built from a cached AST");
      expect(t).toContain("{% raw %}");
    }
    const aPage = page(pages, "Library-A-");
    const a = readFileSync(aPage, "utf-8");
    expect(a).toMatch(/^---\ntitle: "Library\/A"\nparent: "AST delta"\n---/);
    expect(a).toContain("\\| and a pipe");
    const idx = readFileSync(join(site, "index.md"), "utf-8");
    expect(idx).toContain(`[\`http://x/Library/A\\|1.0.0\`](${aPage.split("/").pop()})`);
    expect(idx).toContain("1.0.0 → 1.1.0");
  });

  test("endrawCannotEscape", () => {
    const b = readAst(ast([libA()], []));
    const h = readAst(ast([libA({ description: "x {% endraw %}{% include evil.html %}{{ site.secret }}" })], []));
    const pages = renderDelta(diffAst(b, h), tmp("site-"));
    const t = readFileSync(page(pages, "Library-A-"), "utf-8");
    const body = t.slice(t.indexOf("{% raw %}") + 9, t.lastIndexOf("{% endraw %}"));
    expect(body).not.toMatch(/\{%|\{\{|%\}|\}\}/);
    expect(body).toContain("endraw");
  });

  test("sameTypeIdTwoPages", () => {
    const b = readAst(ast([libA()], []));
    const twin = { type: "Library", id: "A", json: { url: X + "Other/A", version: "9.9.9", name: "A2" } };
    const h = readAst(ast([libA({ description: "changed" }), twin], []));
    const d = diffAst(b, h);
    const pages = renderDelta({ ...d, resources: [...d.resources, { ...d.resources[0]!, key: X + "Other/A|9.9.9", status: "changed" }] }, tmp("site-"));
    expect(new Set(pages).size).toBe(pages.length);
    expect(pages.filter((p) => p.split("/").pop()!.startsWith("Library-A-")).length).toBe(2);
  });
});

describe("an incomplete AST is cannot-tell, never a clean diff", () => {
  test("missingDependenciesRefused", () => {
    const dir = ast([pat], []);
    rmSync(join(dir, "dependencies.json"));
    expect(() => readAst(dir)).toThrow(/dependencies.json is missing/);
  });

  test("missingPayloadFailsDiff", () => {
    const b = ast([libA()], []);
    const h = ast([libA()], []);
    rmSync(join(b, "resources/Library/A.json"));
    rmSync(join(h, "resources/Library/A.json"));
    expect(() => diffAst(readAst(b), readAst(h))).toThrow(/missing/);
  });
});

describe("the formats, declared once — JSON Schema and JSON-LD for downstream (bean l0lq)", () => {
  test("validatesGeneratedSchemas", () => {
    const dir = ast([libA(), libB("1.1.0"), pd], [[X + "PlanDefinition/PD|1.0.0", "library", X + "Library/A", null]]);
    // draft-07: what the installed validator (and most Java ones) read.
    const ajv = new Ajv();
    const schemas = igAstJsonSchemas() as Record<string, object>;
    expect(ajv.validate(schemas["ig-ast.schema.json"]!, JSON.parse(readFileSync(join(dir, "manifest.json"), "utf-8")))).toBe(true);
    expect(ajv.validate(schemas["ig-ast-dependencies.schema.json"]!, JSON.parse(readFileSync(join(dir, "dependencies.json"), "utf-8")))).toBe(true);
    // ...and refuses what the reader refuses.
    expect(ajv.validate(schemas["ig-ast.schema.json"]!, { $schema: "ig-ast/v1", authority: "full", provisional: [], resources: [] })).toBe(false);
  });

  test("refusesNonCacheManifest", () => {
    const dir = ast([libA()], [], { authority: "full" });
    expect(() => readAst(dir)).toThrow(/authority/);
  });

  test("jsonLdIdentities", () => {
    const dir = ast([libA(), pat], [[X + "Library/A|1.0.0", "relatedArtifact", X + "Library/B", "1.1.0"]]);
    const doc = astJsonLd(readAst(dir)) as { "@context": object; "@graph": Array<Record<string, unknown>>; authority: string };
    expect(doc["@context"]).toBeDefined();
    expect(doc.authority).toBe("cache");
    const a = doc["@graph"].find((n) => n.key === X + "Library/A|1.0.0")!;
    expect(a["@id"]).toBe(X + "Library/A");
    expect(a.resourceType).toBe("fhir:Library");
    expect(a.dependsOn).toEqual([{ kind: "relatedArtifact", target: X + "Library/B", origin: "ast-export" }]);
    expect(doc["@graph"].find((n) => n.key === "Patient/p1")!["@id"]).toBe("urn:fhir:Patient/p1");
  });

  test("committedSchemasGenerated", () => {
    for (const [name, text] of Object.entries(igAstSchemaFiles())) {
      expect(readFileSync(join(import.meta.dir, "..", "schemas", name), "utf-8")).toBe(text);
    }
  });
});

describe("build kind — a release is cut from a full build (phase P4, bean h3tx)", () => {
  const m = (extra: Record<string, unknown>) => ({ manifest: { resources: [], ...extra } }) as unknown as Parameters<typeof buildKind>[0];

  test("ordinaryRunFull", () => {
    expect(buildKind(m({}))).toBe("full");
    expect(refuseIncremental(m({}))).toBeUndefined();
  });

  test("mergedIsIncremental", () => {
    const inc = m({ mixed: true, incremental: { base: "aaaaaaaa1", head: "bbbbbbbb2", rebuilt: 84, kept: 664 } });
    expect(buildKind(inc)).toBe("incremental");
    const why = refuseIncremental(inc)!;
    expect(why).toContain("incremental build (base aaaaaaa, head bbbbbbb: 84 rebuilt, 664 kept)");
    expect(why).toContain("full build");
  });

  test("cliRequireFull", () => {
    const d = mkdtempSync(join(tmpdir(), "igast-kind-"));
    const write = (dir: string, extra: Record<string, unknown>) => {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "manifest.json"), JSON.stringify({ $schema: "ig-ast/v1", authority: "cache", provisional: [], resources: [], ...extra }));
      writeFileSync(join(dir, "dependencies.json"), JSON.stringify({ $schema: "ig-ast-dependencies/v1", dependencies: [] }));
    };
    write(join(d, "full"), {});
    write(join(d, "inc"), { mixed: true, incremental: { base: "a", head: "b", rebuilt: 1, kept: 2, removed: 0 } });
    const run = (dir: string) => spawnSync("bun", [join(import.meta.dir, "ig-ast.ts"), "build-kind", dir, "--require-full"], { encoding: "utf-8" });
    const f = run(join(d, "full"));
    expect(f.stdout.trim()).toBe("full");
    expect(f.status).toBe(0);
    const i = run(join(d, "inc"));
    expect(i.stdout.trim()).toBe("incremental");
    expect(i.status).toBe(1);
    rmSync(d, { recursive: true, force: true });
  });
});
