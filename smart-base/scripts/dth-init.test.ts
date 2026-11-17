/**
 * dth init — the wiring every DTH copied by hand (bean cysv, stage 2).
 */
import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { apply, mergePackage, plan } from "./dth-init";

const PINS = [
  { name: "dth-old", source: { local: { at: "." } } },
  { name: "who-iris", source: { remote: { repository: "litlfred/who-iris", ref: "abc", trust: { consent: { by: "x" } } } } },
];
const OPTS = { name: "dth-xx", title: "Digital transformation handbook for testing", isbn: "9789240000000", pins: PINS };

describe("dth init", () => {
  it("namesSharedCoreChecks", () => {
    const pkg = JSON.parse(plan(OPTS).find((f) => f.path === "package.json")!.content);
    expect(pkg.scripts["check:l1-coverage"]).toContain("folio-assistant-core/scripts/folio-l1-coverage.ts --document dth-xx --l1 who-iris/library/9789240000000-eng --check");
    expect(pkg.scripts["check:dth-glossary"]).toContain("folio-assistant-core/scripts/glossary-validate.ts --instance dth-xx");
    expect(Object.values(pkg.scripts).some((s) => String(s).includes("scripts/folio/") || String(s).includes("scripts/glossary/"))).toBe(false);
  });

  it("mountsRemotePinsAndOwnInstance", () => {
    const cfg = JSON.parse(plan(OPTS).find((f) => f.path === "index.config.json")!.content);
    expect(cfg.instances.map((i: { name: string }) => i.name)).toEqual(["dth-xx", "who-iris"]);
    expect(cfg.instances[1].source.remote.trust).toEqual({ consent: { by: "x" } });
  });

  it("fillsEveryTemplatePlaceholder", () => {
    for (const f of plan(OPTS)) expect(f.content.match(/(?<!\$)\{\{\w+\}\}/)).toBeNull();
    expect(plan(OPTS).some((f) => f.path === ".gitignore")).toBe(true);
  });

  it("writesSheetLinkOnlyWithSheet", () => {
    expect(plan(OPTS).some((f) => f.path.startsWith("review/"))).toBe(false);
    expect(plan({ ...OPTS, sheet: "S" }).some((f) => f.path === "review/drafting/sheet-sync.json")).toBe(true);
  });

  it("keepsExistingFilesMergesPackageJson", () => {
    const dir = mkdtempSync(join(tmpdir(), "dth-init-"));
    writeFileSync(join(dir, "AGENTS.md"), "mine\n");
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "dth-xx", scripts: { "seed:folio": "python3 seed.py", cat: "old" } }));
    const r = apply(dir, plan(OPTS));
    expect(r.find((x) => x.path === "AGENTS.md")!.action).toBe("skip");
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toBe("mine\n");
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    expect(pkg.scripts["seed:folio"]).toBe("python3 seed.py");
    expect(pkg.scripts.cat).toBe("bun cat-harness-tools/scripts/run-script.ts");
    apply(dir, plan(OPTS), { force: true });
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toContain("dth init");
  });

  it("keepsOwnDependencyVersions", () => {
    const m = JSON.parse(mergePackage(JSON.stringify({ dependencies: { zod: "^4.6.5" } }), plan(OPTS).find((f) => f.path === "package.json")!.content));
    expect(m.dependencies.zod).toBe("^4.6.5");
  });
});
