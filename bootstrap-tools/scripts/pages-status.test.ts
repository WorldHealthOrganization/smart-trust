import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Probe } from "./init.ts";
import { pagesStatus, publicationRoot, pushStatus } from "./pages-status.ts";
import { stageSite, subgraphSelection } from "./site.ts";

const probeWith = (status: (url: string) => number | undefined): Probe => ({ gh: () => undefined, httpStatus: async (u) => status(u) });

describe("pages-status — the push's status and its message", () => {
  const top = mkdtempSync(join(tmpdir(), "pages-status-"));
  const root = join(top, "demo");
  mkdirSync(join(root, "schemas"), { recursive: true });
  mkdirSync(join(root, "skills"), { recursive: true });
  writeFileSync(
    join(root, "demo.json"),
    JSON.stringify({
      name: "demo",
      version: "1.0.0",
      iriBase: "https://x.example/demo/",
      directories: [
        { id: "schemas", path: "schemas/", graphTypologies: ["schemas"] },
        { id: "skills", path: "skills/", graphTypologies: ["skills"] },
      ],
    }),
  );
  writeFileSync(join(root, "README.md"), "# Demo\n");
  writeFileSync(join(root, "schemas", "a.schema.json"), JSON.stringify({ $id: "https://x.example/demo/1.0.0/schemas/a.schema.json" }));
  writeFileSync(join(root, "skills", "s.md"), "# s\n");
  spawnSync("git", ["init", "-q"], { cwd: root });

  test("publicationRootPrecedence", () => {
    expect(publicationRoot({ iriBase: "https://a.example/x" }, undefined)).toBe("https://a.example/x/");
    expect(publicationRoot({ iriBase: "https://a.example/x/" }, "https://staging.example/pr-1")).toBe("https://staging.example/pr-1/");
    expect(publicationRoot({ repository: "Owner/repo" })).toBe("https://owner.github.io/repo/");
    expect(publicationRoot({})).toBeUndefined();
  });

  test("failureOutranksUnknown", () => {
    expect(pushStatus(["done", "done"])).toBe("pushed");
    expect(pushStatus(["done", "could-not-determine"])).toBe("could-not-determine");
    expect(pushStatus(["could-not-determine", "not-done"])).toBe("not-pushed");
  });

  test("allAnsweringIsPushed", async () => {
    const r = (await pagesStatus(root, { sha: "1a2b3c4d5e", probe: probeWith(() => 200) }))!;
    expect(r.status).toBe("pushed");
    expect(r.target).toBe("github-pages");
    expect(r.qa.documents).toEqual({ answering: 1, total: 1, missing: [], unchecked: [] });
    expect(r.message).toStartWith("pushed 1a2b3c4 to https://x.example/demo/ — QA: staged ok");
  });

  test("missingReadmeNotPushed", async () => {
    const r = (await pagesStatus(root, { sha: "abc", probe: probeWith((u) => (u.endsWith("README.html") ? 404 : 200)) }))!;
    expect(r.status).toBe("not-pushed");
    expect(r.qa.readme).toEqual({ state: "not-done", http: 404 });
    expect(r.message).toContain("README.html 404");
  });

  test("http404NotPushed403Unknown", async () => {
    const missing = (await pagesStatus(root, { sha: "abc", probe: probeWith((u) => (u.endsWith(".json") ? 404 : 200)) }))!;
    expect(missing.status).toBe("not-pushed");
    expect(missing.message).toContain("missing: https://x.example/demo/1.0.0/schemas/a.schema.json");
    const blind = (await pagesStatus(root, { sha: "abc", probe: probeWith(() => 403) }))!;
    expect(blind.status).toBe("could-not-determine");
  });

  test("subgraphListFiltersDirectories", async () => {
    const sel = subgraphSelection({ directories: [{ id: "skills", path: "skills/" }] }, ["skills", "nope"]);
    expect(sel.unknown).toEqual(["nope"]);
    expect(sel.keep!("README.md")).toBe(true);
    expect(sel.keep!("skills/s.md")).toBe(true);
    expect(sel.keep!("schemas/a.schema.json")).toBe(false);
    const out = join(top, "_skills-only");
    const staged = stageSite(root, out, { subgraphs: ["skills"] });
    expect(staged.problems).toEqual([]);
    expect(existsSync(join(out, "skills", "s.md"))).toBe(true);
    expect(existsSync(join(out, "schemas", "a.schema.json"))).toBe(false);
    const r = (await pagesStatus(root, { sha: "abc", subgraphs: ["nope"], probe: probeWith(() => 200) }))!;
    expect(r.status).toBe("not-pushed");
    expect(r.message).toContain("--subgraph nope");
  });
});
