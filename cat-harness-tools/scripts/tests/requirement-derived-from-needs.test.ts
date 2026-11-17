/**
 * A requirement's `derivedFrom` resolves against this layer AND everything
 * it `needs` — the rule `resolution-across-needs.test.ts` pins for skills and
 * roles, one node kind over (bean `w1gy`, owner option A, 2026-10-30).
 *
 * ## The defect this pins
 *
 * `requirement-derived-from-resolves` checked each `derivedFrom` against the
 * audited layer's OWN requirements only. fhir-harness#233 moved
 * `skills/requirements/fhir-validation.json` into fhir-harness, and it derives
 * from `req:content-lifecycle`, which cat-harness — four layers down its
 * `needs` — declares. Measured on `kg:audit --instance ./fhir-harness` before
 * the fix: `requirement-derived-from-resolves` **fail (1)** on
 * `req:fhir-validation`; after it, **pass**.
 *
 * ## Both directions, on a constructed pair
 *
 * A synthetic `top` that `needs` a synthetic `base`, so the verdict cannot
 * drift with the corpus: a parent `base` declares resolves, and a parent that
 * no layer declares is still a failure. The second case is what keeps the
 * widening from becoming "anything goes".
 *
 * @module scripts/tests/requirement-derived-from-needs
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { HARNESS_ROOT } from "../lib/roots.ts";

const REPO = resolve(dirname(HARNESS_ROOT));

type Criterion = { result?: string; findings?: { where?: string; detail?: string }[] };

let dir: string;

/** A minimal layer declaration, with `needs` given. */
function instance(name: string, needs: string[], requirements: Record<string, string[]>): void {
  const root = join(dir, name);
  mkdirSync(join(root, "skills", "requirements"), { recursive: true });
  writeFileSync(
    join(root, `${name}.json`),
    JSON.stringify(
      {
        name,
        version: "0.0.1",
        title: `Synthetic ${name}`,
        description: "A requirement-derivation fixture.",
        needs,
        directories: [{ id: "skills", path: "skills/", graphTypologies: ["skills"] }],
      },
      null,
      2,
    ),
  );
  for (const [id, derivedFrom] of Object.entries(requirements)) {
    writeFileSync(
      join(root, "skills", "requirements", `${id.replace(/^req:/, "")}.json`),
      JSON.stringify({ id, title: id, description: "Fixture requirement.", derivedFrom }, null, 2),
    );
  }
}

/** `requirement-derived-from-resolves` for each requirement `top` audits. */
async function verdicts(): Promise<Map<string, Criterion>> {
  const p = Bun.spawn(
    ["bun", "run", "cat-harness-tools/scripts/kg-audit.ts", "--instance", join(dir, "top"), "--check", "--json"],
    { cwd: REPO, stdout: "pipe", stderr: "pipe" },
  );
  const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
  await p.exited;
  let reports: { subject?: { kind?: string; id?: string }; criteria?: Record<string, Criterion> }[];
  try {
    reports = (JSON.parse(out) as { reports?: typeof reports }).reports ?? [];
  } catch {
    throw new Error(`the audit produced no JSON report:\n${err.slice(0, 800)}`);
  }
  const out2 = new Map<string, Criterion>();
  for (const r of reports) {
    if (r.subject?.kind !== "requirement" || !r.subject.id) continue;
    out2.set(r.subject.id, r.criteria?.["requirement-derived-from-resolves"] ?? {});
  }
  return out2;
}

describe("requirement `derivedFrom` resolves across the `needs` chain", () => {
  let got: Map<string, Criterion>;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "derived-from-needs-"));
    // `kg-audit.ts` reads a `package.json` at the checkout root, as the
    // third-state case in `resolution-across-needs.test.ts` records.
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "synth-repo", scripts: {} }));
    instance("base", [], { "req:base-parent": [] });
    instance("top", ["base"], {
      "req:from-below": ["req:base-parent"],
      "req:from-nowhere": ["req:held-by-no-layer"],
    });
    got = await verdicts();
  }, 120_000);

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("only `top`'s own requirements are subjects", () => {
    expect([...got.keys()].sort()).toEqual(["req:from-below", "req:from-nowhere"]);
  });

  test("a parent a needed layer declares resolves", () => {
    const c = got.get("req:from-below");
    expect(c?.result, JSON.stringify(c)).toBe("pass");
  });

  test("a parent no layer declares is still reported", () => {
    const c = got.get("req:from-nowhere");
    expect(c?.result, JSON.stringify(c)).toBe("fail");
    expect(c?.findings?.[0]?.detail ?? "").toContain('"req:held-by-no-layer"');
    expect(c?.findings?.[0]?.detail ?? "").toContain("anything it `needs`");
  });
});
