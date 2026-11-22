/**
 * `translate-bpmn` in a root without the content it translates: not
 * applicable (78, `lib/not-applicable.ts`), never exit 2.
 *
 * A root with no diagram, or one that translates into no locale, has nothing
 * to extract or check, and no run can change that. It exited 2 ("could not
 * determine") until 2026-11-19, the class a FHIR IG judged with no base found in
 * `translate-user-scenarios:check`. A root that HAS diagrams and locales is
 * still judged as before (the regen and page tests cover that half).
 *
 * @module scripts/tests/translate-bpmn-not-applicable
 */
import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI = join(import.meta.dir, "..", "translate-bpmn.ts");
const BPMN =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="d" targetNamespace="urn:x">\n` +
  `  <bpmn:process id="p" name="A process"><bpmn:task id="t" name="Do the thing"/></bpmn:process>\n` +
  `</bpmn:definitions>\n`;

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

function root(): string {
  const r = mkdtempSync(join(tmpdir(), "translate-bpmn-na-"));
  made.push(r);
  writeFileSync(join(r, "acme.json"), JSON.stringify({ name: "acme", directories: [{ id: "processes", path: "processes/", graphTypologies: ["processes"] }] }));
  mkdirSync(join(r, "processes"));
  return r;
}

const run = (r: string, ...a: string[]) => spawnSync("bun", [CLI, "--instance", r, ...a], { encoding: "utf-8" });

describe("translate-bpmn where there is nothing to translate", () => {
  test("no diagram in any declared directory: 78, for --check and --extract", () => {
    const r = root();
    for (const mode of ["--check", "--extract"]) {
      const out = run(r, mode);
      expect(out.status).toBe(78);
      expect(out.stdout).toContain("no .bpmn file");
    }
  });

  test("a diagram, but no locale the root translates into: 78", () => {
    const r = root();
    writeFileSync(join(r, "processes", "p.bpmn"), BPMN);
    const out = run(r, "--check");
    expect(out.status).toBe(78);
    expect(out.stdout).toContain("no locale");
  });

  test("a bad invocation is still 2", () => {
    expect(run(root()).status).toBe(2);
  });
});
