/**
 * The IG readers read only what `contentTypes.ig.include` declares.
 *
 * Calibrated: making `igReadScope` return the legacy scope for a declared
 * repository fails every "declared" test below, and dropping the `warned`
 * set fails "warns once".
 */
import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { copyDeclared, igReadScope, legacyWarning, onlyDeclared, resetLegacyWarnings } from "./ig-read-scope.ts";
import { buildFshGraph } from "./fsh-cone.ts";
import { contextsFrom, fhirVersionsOf } from "./build-ig-indexes.ts";
import { copyIgSource, igTitle } from "./ig-repo-site.ts";
import { buildMenu } from "./ingest-ig-menu.ts";
import { igApiHubPageOf } from "./ig-api-hub.ts";
import { stageIgSite } from "./build-ig-site.ts";

const dirs: string[] = [];
function tmp(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(d);
  return d;
}
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
beforeEach(() => resetLegacyWarnings());

/** An IG checkout with FSH, CQL, a page, a context and a stray file; `include` declares it when given. */
function ig(include?: string[]): string {
  const d = tmp("ig-read-scope-");
  const put = (rel: string, text: string): void => {
    mkdirSync(dirname(join(d, rel)), { recursive: true });
    writeFileSync(join(d, rel), text);
  };
  put("sushi-config.yaml", "id: ex.ig\ncanonical: http://example.org/ig\ntitle: Example IG\nfhirVersion: 4.0.1\n");
  put("input/fsh/profiles.fsh", "Profile: ExPatient\nParent: Patient\nId: ex-patient\n");
  put("input/cql/ExLib.cql", 'library ExLib version \'1\'\n');
  put("input/pagecontent/index.md", "# Home\n\n{{API_HUB}}\n");
  put("input/images/ctx.jsonld", JSON.stringify({ "@context": {} }));
  put("input/ignoreWarnings.txt", "nothing\n");
  put("notes/private.md", "not IG content\n");
  if (include) put("index.config.json", JSON.stringify({ contentTypes: { ig: { include } } }));
  return d;
}

const DECLARED = ["sushi-config.yaml", "input/fsh/", "input/pagecontent/"];

describe("igReadScope", () => {
  it("declaresOnlyIncludeList", () => {
    const s = igReadScope(ig(DECLARED));
    expect(s.legacy).toBe(false);
    expect(s.declares("sushi-config.yaml")).toBe(true);
    expect(s.declares("input/fsh/profiles.fsh")).toBe(true);
    expect(s.declares("input/cql/ExLib.cql")).toBe(false);
    expect(s.declares("notes/private.md")).toBe(false);
    expect(s.reaches("input")).toBe(true);
    expect(s.reaches("input/cql")).toBe(false);
    expect(() => s.path("input/ignoreWarnings.txt")).toThrow(/not declared in contentTypes\.ig\.include/);
  });

  it("refusesSectionDeclaringNothing", () => {
    expect(() => igReadScope(ig([]))).toThrow(/declares nothing usable/);
  });

  it("legacyWarnsOnce", () => {
    const d = ig();
    const said: string[] = [];
    const s = igReadScope(d, { warn: (m) => said.push(m) });
    igReadScope(d, { warn: (m) => said.push(m) });
    expect(s.legacy).toBe(true);
    expect(s.declares("notes/private.md")).toBe(true);
    expect(said).toEqual([legacyWarning(s.root)]);
    expect(said[0]).toContain("declares no contentTypes.ig");
  });
});

describe("copyDeclared and onlyDeclared", () => {
  it("copyDeclaredOnly", () => {
    const s = igReadScope(ig(DECLARED));
    expect(onlyDeclared(s)).toBe(false);
    const to = tmp("ig-read-scope-copy-");
    expect(copyDeclared(s, to)).toEqual(["index.config.json", ...DECLARED]);
    expect(existsSync(join(to, "input/fsh/profiles.fsh"))).toBe(true);
    expect(existsSync(join(to, "input/cql"))).toBe(false);
    expect(existsSync(join(to, "notes"))).toBe(false);
    expect(onlyDeclared(igReadScope(to))).toBe(true);
  });
});

describe("the IG readers, gated", () => {
  it("fshConeSkipsUndeclaredCql", () => {
    const g = buildFshGraph(ig(DECLARED));
    expect([...g.nodes.keys()]).toContain("ExPatient");
    expect([...g.nodes.keys()].some((k) => k.startsWith("cql:"))).toBe(false);
  });

  it("fshConeReadsLegacy", () => {
    const g = buildFshGraph(ig());
    expect([...g.nodes.keys()]).toContain("cql:ExLib");
  });

  it("indexesReadDeclaredOnly", () => {
    const d = ig(DECLARED);
    expect(contextsFrom(d, tmp("ig-read-scope-out-"), undefined)).toEqual([]);
    expect(fhirVersionsOf(d)).toEqual(["4.0.1"]);
    expect(fhirVersionsOf(ig(["input/fsh/"]))).toEqual([]);
    expect(contextsFrom(ig([...DECLARED, "input/images/"]), tmp("ig-read-scope-out-"), undefined)).toHaveLength(1);
  });

  it("repoSiteCopiesDeclared", () => {
    const src = tmp("ig-read-scope-src-");
    expect(copyIgSource(ig(DECLARED), src)).toEqual(["index.config.json", ...DECLARED]);
    expect(existsSync(join(src, "notes"))).toBe(false);
    expect(igTitle(ig(DECLARED))).toBe("Example IG");
    expect(igTitle(ig(["input/fsh/"]))).toBeUndefined();
  });

  it("menuRefusesUndeclaredSushi", () => {
    expect(() => buildMenu(ig(["input/fsh/"]), "2026-10-30")).toThrow(/not declared in contentTypes\.ig\.include/);
  });

  it("apiHubDeclaredPagesOnly", () => {
    expect(igApiHubPageOf(ig(DECLARED), "{{API_HUB}}")).toBe("index.html");
    expect(igApiHubPageOf(ig(["sushi-config.yaml"]), "{{API_HUB}}")).not.toBe("index.html");
  });

  it("siteStagesDeclaredPages", () => {
    const d = ig(["sushi-config.yaml", "input/pagecontent/index.md"]);
    writeFileSync(join(d, "input/pagecontent/other.md"), "# Other\n");
    const r = stageIgSite(d, join(tmp("ig-read-scope-site-"), "site"));
    expect(r.pages).toEqual(["index.md"]);
    expect(existsSync(join(d, "input/pagecontent/other.md"))).toBe(true);
    const legacy = ig();
    writeFileSync(join(legacy, "input/pagecontent/other.md"), "# Other\n");
    expect(stageIgSite(legacy, join(tmp("ig-read-scope-site-"), "site")).pages).toEqual(["index.md", "other.md"]);
  });
});
