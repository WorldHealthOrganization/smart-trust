/**
 * `check:instance-graph` gates the DECLARATION as well as the graph: every
 * layer declares `needs`, and every layer has its own absolute harness
 * IRI. Issue #1548, owner 2026-09-30: *"QA gates on harness declaration of
 * dependences. harness instancess need IRI for harness."*
 *
 * The IRI is resolved through an injected function here, so these tests judge
 * the gate's rules without a publication base; the real gate injects
 * `kg-export`'s own `exportIdentity`, and the last block tests that too.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

import { collect, isClean } from "../../check-instance-graph.js";
import { exportIdentity } from "../../kg-export.js";
import { repoRootFor } from "../../../schemas/kg/cat-harness.js";
import { writeDeclaration } from "../../../test/support/instance-fixture.js";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

/** A repository of instances, one subdirectory each; `needs` omitted when undefined. */
function repo(instances: Array<{ name: string; needs?: string[] }>): string {
  const root = mkdtempSync(join(tmpdir(), "decl-gate-"));
  made.push(root);
  for (const i of instances) {
    const dir = join(root, i.name);
    mkdirSync(join(dir, "skills"), { recursive: true });
    writeDeclaration(dir, {
      name: i.name,
      directories: [{ id: `${i.name}-skills`, path: "skills/", graphTypologies: ["skills"] }],
      ...(i.needs === undefined ? {} : { needs: i.needs }),
    });
  }
  return root;
}

const kinds = (r: ReturnType<typeof collect>) => r.problems.map((p) => p.problem.kind).sort();
const iriByName = (root: string) => `https://example.org/${basename(root)}.jsonld`;

describe("every instance declares `needs`", () => {
  test("an instance with no `needs` is a finding", () => {
    const r = collect(repo([{ name: "floor", needs: [] }, { name: "silent" }]));
    expect(kinds(r)).toEqual(["undeclared-needs"]);
    expect(r.problems[0]!.instance).toBe("silent");
    expect(isClean(r)).toBe(false);
  });

  test("`[]` declares the floor and passes", () => {
    const r = collect(repo([{ name: "floor", needs: [] }, { name: "upper", needs: ["floor"] }]));
    expect(r.problems).toEqual([]);
    expect(isClean(r)).toBe(true);
  });
});

describe("every instance has its own absolute harness IRI", () => {
  const two = () => repo([{ name: "a", needs: [] }, { name: "b", needs: ["a"] }]);

  test("distinct absolute IRIs pass, and are reported", () => {
    const r = collect(two(), iriByName);
    expect(r.problems).toEqual([]);
    expect(Object.values(r.iris).sort()).toEqual(["https://example.org/a.jsonld", "https://example.org/b.jsonld"]);
  });

  test("no IRI, or a relative one, is a finding", () => {
    const r = collect(two(), (root) => (basename(root) === "a" ? undefined : "b/b.jsonld"));
    expect(kinds(r)).toEqual(["no-iri", "no-iri"]);
  });

  test("two instances sharing one IRI is a finding", () => {
    const r = collect(two(), () => "https://example.org/same.jsonld");
    expect(kinds(r)).toEqual(["duplicate-iri"]);
  });
});

describe("the exporter's IRI rule (the one the real gate injects)", () => {
  const REPO = repoRootFor(resolve(import.meta.dir, "../../.."));

  test("an instance with its own canonicalUrl sits at <canonicalUrl>/<stub>.jsonld — no doubled segment", () => {
    // Measured 2026-09-30 before the fix:
    // …/folio-assistant/fhir-harness/fhir-harness/fhir-harness.jsonld
    expect(exportIdentity({ instanceRoot: join(REPO, "fhir-harness") }).canonicalIri).toBe(
      "https://litlfred.github.io/folio-assistant/fhir-harness/fhir-harness.jsonld",
    );
  });

  test("an instance with no canonicalUrl of its own still publishes under the host's segment", () => {
    expect(exportIdentity({ instanceRoot: join(REPO, "bootstrap") }).canonicalIri).toBe(
      "https://litlfred.github.io/folio-assistant/bootstrap/bootstrap.jsonld",
    );
  });

  test("the real repository passes the whole gate", async () => {
    const r = collect(REPO, (root) => exportIdentity({ instanceRoot: root }).canonicalIri);
    expect(r.problems).toEqual([]);
    expect(Object.keys(r.iris).length).toBe(r.instances);
  });
});
