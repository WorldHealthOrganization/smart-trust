/**
 * `<base>/fsh-guts.jsonld` — the trashcan reachable by name.
 *
 * Owner, 2026-09-19: *"jsonld accessible via `<base-url>/fsh-guts.jsonld`"*,
 * and on the activity log that lives inside that tree: *"dont get
 * published"*.
 *
 * Bean `folio-assistant-t0i3`.
 *
 * @module scripts/tests/fsh-guts-export.test
 *
 * The tests here that read the aggregate repository's own root (the
 * root-declared `fsh-guts` trashcan and `.github/workflows/docs-site.yml`)
 * live in `test/fsh-guts-export-repo-root.test.ts`
 * (bean `ho66`): standing alone, cat-harness has no such root to read.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { readFshGutsNode } from "../../schemas/kg/fsh-guts.ts";
import { buildFshGutsExport, fshGutsDirs } from "../fsh-guts-export.ts";
import { fshGutsDirectory } from "../../schemas/kg/fsh-guts.ts";
import { buildExport } from "../kg-export.js";
import { repoRootFor } from "../../schemas/kg/cat-harness.js";
import { writeDeclaration } from "../../test/support/instance-fixture.js";
import { HARNESS_ROOT } from "../lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);

/**
 * The main graph, built ONCE at module scope.
 *
 * Bean `sff8`. This was `await buildExport()` inside the test body and measured
 * **4.77 s of a 5000 ms default budget** — 95 %, the highest exposure in the
 * repository after the four that have already timed out. `check:test-budgets` named
 * it rather than a red run finding it, which is the whole point of that tool.
 *
 * Same remedy as `activity-log`, `kg-export` and `skill-coverage`: module scope
 * belongs to no test's timeout. Not a raised budget, which `sff8` rules out because
 * a number decays as the corpus grows.
 */
const MAIN_EXPORT = await buildExport();

/**
 * A throwaway layer that declares a trashcan.
 *
 * A REPOSITORY holding a layer, which is the live shape: `fsh-guts/` is
 * declared `scope: "repository"`, so the directory sits beside the layer
 * rather than inside it. The fixture makes its own repository directory
 * instead of letting `repoRootFor` reach `/tmp` — that was shared, so every
 * fixture in this file wrote into one trashcan and the isolation each `try`
 * block believed it had was not there.
 */
function instance(declare = true): string {
  const repo = mkdtempSync(join(tmpdir(), "fsh-guts-export-"));
  const root = join(repo, "inst");
  mkdirSync(root, { recursive: true });
  mkdirSync(join(repo, "fsh-guts"), { recursive: true });
  writeDeclaration(root, JSON.stringify({
      name: "t",
      stub: "t",
      canonicalUrl: "https://example.invalid/t",
      directories: declare
        ? [
            {
              id: "fsh-guts",
              path: "fsh-guts/",
              scope: "repository",
              description: "trashcan",
              graphTypologies: ["fsh-guts"],
            },
          ]
        : [],
    }));
  return root;
}

function node(over: Record<string, string> = {}): string {
  const fm = { $schema: "folio-fsh-guts/v1", title: "A discarded thing", kind: "proposal", ...over };
  return `---\n${Object.entries(fm)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n")}\n---\n\n# body\n`;
}

describe("the real corpus", () => {
  const doc = buildFshGutsExport(ROOT);

  test("nothing was skipped for a reason that means a defect", () => {
    // A file declaring another schema is data. A file declaring THIS one and
    // failing it is a broken node, and would otherwise vanish silently.
    const broken = doc.skipped.filter((s) => s.reason.includes("does not satisfy"));
    expect(broken.map((s) => `${s.path}: ${s.reason}`)).toEqual([]);
  });

  test("the @id names where it is actually served", () => {
    // The declared Subgraph node's own path (#603), whose page and `.jsonld`
    // kg-export writes beside the instance document — under the host's own
    // directory, like every layer's (#603 decision 1b, owner 2026-10-23).
    expect(doc["@id"]).toBe("https://litlfred.github.io/folio-assistant/cat-harness/directory/fsh-guts");
    expect(buildFshGutsExport(ROOT, "https://example.invalid/preview")["@id"]).toBe(
      "https://example.invalid/preview/cat-harness/directory/fsh-guts",
    );
  });

  // Bean 9c7h: ONE resolution for every reader and writer, so the move to
  // `cat/cat-harness/fsh-guts` changes one function, not each caller.
  test("a writer gets the one declared trashcan, and is refused when there is none", () => {
    const declared = instance(true);
    expect(fshGutsDirectory(declared)).toBe(fshGutsDirs(declared)[0].absPath);
    const bare = instance(false);
    expect(() => fshGutsDirectory(bare)).toThrow(/no `fsh-guts` directory is declared/);
  });
});

describe("reachable BY NAME, and by no edge", () => {
  test("the main graph still does not mention fsh-guts at all", () => {
    // The converse of the strip test, and the property this whole document
    // depends on: it exists so the content stays reachable DELIBERATELY. If
    // the main graph ever linked here, a crawler would arrive and the strip
    // would have been undone by the thing built on top of it.
    const main = MAIN_EXPORT;
    expect(JSON.stringify(main)).not.toContain("fsh-guts");
  });

  test("and this document is a separate one, not a subgraph", () => {
    const doc = buildFshGutsExport(ROOT);
    expect(doc["@id"]).not.toBe("https://litlfred.github.io/folio-assistant/folio-assistant.jsonld");
  });
});

describe("logs are excluded by DECLARATION, not by the gitignore", () => {
  test("a log entry sitting in the tree is not in the document", () => {
    // The gitignore keeps logs out of a CI checkout, which is a property of
    // the build and not of this exporter — it would stop being true the
    // moment somebody exported from a working tree. This is the actual
    // guarantee.
    const root = instance();
    const logs = join(repoRootFor(root), "fsh-guts", "logs");
    mkdirSync(logs, { recursive: true });
    writeFileSync(join(repoRootFor(root), "fsh-guts", "kept.md"), node({ title: "Kept" }));
    writeFileSync(
      join(logs, "entry.json"),
      JSON.stringify({ $schema: "folio-log/v1", id: "x", summary: "a secret-ish trace" }),
    );

    const doc = buildFshGutsExport(root);
    expect(doc.nodeCount).toBe(1);
    expect(JSON.stringify(doc["@graph"])).not.toContain("secret-ish");
  });

  test("the skip reason names what the file actually declares", () => {
    // It excluded a log entry while reporting "declares no $schema", which
    // is FALSE — a log entry declares emphatically, just in JSON rather than
    // YAML front matter. The outcome was right and the reason would have
    // sent the next reader looking for a tag that is there.
    const r = readFshGutsNode(JSON.stringify({ $schema: "folio-log/v1", id: "x" }));
    expect(r.node).toBeUndefined();
    const reason = "reason" in r ? r.reason : "";
    expect(reason).toContain("folio-log/v1");
    expect(reason).not.toContain("declares no $schema");
  });

  test("a file that genuinely declares nothing says so", () => {
    const r = readFshGutsNode("# just a note somebody dropped in\n");
    expect("reason" in r ? r.reason : "").toContain("declares no $schema");
  });
});

describe("what was not included is reported", () => {
  test("a node declaring this schema but failing it is a defect, not a skip", () => {
    const root = instance();
    writeFileSync(join(repoRootFor(root), "fsh-guts", "broken.md"), "---\n$schema: folio-fsh-guts/v1\nkind: x\n---\n");
    const doc = buildFshGutsExport(root);
    expect(doc.nodeCount).toBe(0);
    expect(doc.skipped[0]!.reason).toContain("does not satisfy");
  });

  test("an instance with no declared trashcan is distinguishable from an empty one", () => {
    // Third state. `nodeCount: 0` alone cannot tell them apart, and the two
    // want different responses.
    expect(buildFshGutsExport(instance(false)).scans).toEqual([]);
    expect(buildFshGutsExport(instance()).scans).toEqual(["fsh-guts"]);
    expect(buildFshGutsExport(instance()).nodeCount).toBe(0);
  });
});

describe("the site build publishes it, with the media-type alias", () => {
  const wfPath = [
    join(repoRootFor(ROOT), ".github/workflows/docs-site.yml"),
    join(repoRootFor(ROOT), "..", "..", ".github/workflows/docs-site.yml"),
  ].find(existsSync);
  const wf = wfPath ? readFileSync(wfPath, "utf8") : "";

  test("the document is written into the site", () => {
    expect(wf).toContain("scripts/fsh-guts-export.ts");
    expect(wf).toContain('"./_site/fsh-guts.jsonld"');
  });

  test("and the .json alias, since Pages serves .jsonld as octet-stream", () => {
    // Every other rendering here carries the alias for this reason; one that
    // did not would download instead of render, and nothing else would say
    // so.
    expect(wf).toContain('cp "./_site/fsh-guts.jsonld" "./_site/fsh-guts.json"');
  });
});

describe("the folded block scalar the corpus actually uses", () => {
  test("`summary: >-` is read as prose, not as the literal `>-`", () => {
    // The reason the front-matter reader was extracted rather than copied:
    // the memory parser has no block-scalar support and would have set
    // summary to ">-", dropping every summary in the trashcan silently.
    const r = readFshGutsNode(
      "---\n$schema: folio-fsh-guts/v1\ntitle: T\nkind: proposal\nsummary: >-\n  one line\n  and another\n---\n",
    );
    expect(r.node?.summary).toBe("one line and another");
  });
});

describe("a kind's own fields survive, because `kind` is open", () => {
  // The schema invites any `kind` and then stripped whatever made that kind
  // distinct. `bean` is the evidence it was being paid for one field at a
  // time: its own comment records the symptom — reads fine in the source,
  // absent from the exported node. `staging-preview` (bean `6pfo`) carries a
  // NESTED block, which no amount of declaring scalars would have held.

  test("an extra field survives the read instead of being stripped", () => {
    const r = readFshGutsNode(
      JSON.stringify({
        $schema: "folio-fsh-guts/v1",
        title: "Staging preview — x",
        kind: "staging-preview",
        staging: { slug: "x", branch: "b", commit: "c", builtAt: "2026-09-20T00:00:00Z" },
      }),
    );
    expect(r.node).toBeDefined();
    const staging = (r.node as Record<string, unknown> | undefined)?.["staging"] as
      | Record<string, unknown>
      | undefined;
    expect(staging?.["slug"]).toBe("x");
  });

  test("and reaches the exported document, under `data`", () => {
    const root = instance();
    writeFileSync(
      join(repoRootFor(root), "fsh-guts", "preview.json"),
      JSON.stringify({
        $schema: "folio-fsh-guts/v1",
        title: "Staging preview — x",
        kind: "staging-preview",
        staging: { slug: "x", liveness: "live" },
      }),
    );
    const doc = buildFshGutsExport(root);
    expect(doc.nodeCount).toBe(1);
    const n = doc["@graph"][0] as Record<string, unknown>;
    expect((n["data"] as Record<string, unknown>)["staging"]).toEqual({ slug: "x", liveness: "live" });
  });

  test("an ordinary node gains no empty `data` — the document is unchanged for it", () => {
    const root = instance();
    writeFileSync(join(repoRootFor(root), "fsh-guts", "kept.md"), node({ title: "Kept" }));
    const n = buildFshGutsExport(root)["@graph"][0] as Record<string, unknown>;
    expect("data" in n).toBe(false);
  });

  test("a common field is emitted once, under its term and not also in `data`", () => {
    const root = instance();
    writeFileSync(join(repoRootFor(root), "fsh-guts", "kept.md"), node({ title: "Kept", bean: "abcd" }));
    const n = buildFshGutsExport(root)["@graph"][0] as Record<string, unknown>;
    expect(n["bean"]).toBe("abcd");
    expect("data" in n).toBe(false);
  });
});

describe("a JSON node of THIS graph is read, and a log still is not", () => {
  test("the JSON carrier works, because front matter is flat", () => {
    // Measured: `schemas/kg/front-matter.ts` parses to Record<string, string |
    // string[]>, so a nested `staging:` block comes back as []. A record a
    // workflow writes and a tool reads cannot use that carrier.
    const r = readFshGutsNode(
      JSON.stringify({ $schema: "folio-fsh-guts/v1", title: "T", kind: "staging-preview" }),
    );
    expect(r.node?.title).toBe("T");
    expect(r.node?.kind).toBe("staging-preview");
  });

  test("its body is empty rather than invented — a JSON node's content IS its fields", () => {
    const r = readFshGutsNode(JSON.stringify({ $schema: "folio-fsh-guts/v1", title: "T", kind: "k" }));
    expect("body" in r ? r.body : undefined).toBe("");
  });

  test("READING JSON DID NOT LET LOGS IN — the guarantee this change had to keep", () => {
    // The whole risk of teaching the exporter to read JSON: `fsh-guts/logs/`
    // sits inside the tree it walks. Exclusion is still by DECLARATION, so a
    // log entry falls through exactly as before.
    const root = instance();
    const logs = join(repoRootFor(root), "fsh-guts", "logs");
    mkdirSync(logs, { recursive: true });
    writeFileSync(
      join(logs, "entry.json"),
      JSON.stringify({ $schema: "folio-log/v1", id: "x", summary: "a secret-ish trace" }),
    );
    writeFileSync(
      join(repoRootFor(root), "fsh-guts", "preview.json"),
      JSON.stringify({ $schema: "folio-fsh-guts/v1", title: "P", kind: "staging-preview" }),
    );

    const doc = buildFshGutsExport(root);
    expect(doc.nodeCount).toBe(1);
    expect(JSON.stringify(doc["@graph"])).not.toContain("secret-ish");
  });

  test("a JSON file declaring this schema but failing it is a defect, not a clean skip", () => {
    const r = readFshGutsNode(JSON.stringify({ $schema: "folio-fsh-guts/v1", kind: "k" }));
    expect(r.node).toBeUndefined();
    expect("reason" in r ? r.reason : "").toContain("does not satisfy it");
  });
});
