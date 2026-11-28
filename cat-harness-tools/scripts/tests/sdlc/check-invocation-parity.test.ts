/**
 * A preview must run the generators the deploy runs, with the same instance
 * arguments.
 *
 * The literals below are workflow source text on purpose: this file feeds
 * fixture text to the matcher, so rewriting them to reference a constant would
 * leave every detection test passing while asserting nothing — the failure
 * `check-declaration-filename.test.ts` already paid for (bean `jijc`).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { checkInvocationParity, EXEMPT, formatReport, invocations, isDeploy, withoutComments } from "../../check-invocation-parity.js";

const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..", "..");
const wf = (n: string) => readFileSync(join(REPO_ROOT, ".github", "workflows", n), "utf-8");

describe("invocations", () => {
  test("a bootstrap-tools script is its own obligation, and `--root` is its instance", () => {
    const got = invocations(
      "          bun run bootstrap-tools/scripts/export-graph.ts --root ./no-such-instance --out b.jsonld\n" +
        "          bun run cat-harness/scripts/kg-export.ts --out a.jsonld\n",
    );
    expect(got).toEqual([
      { script: "bootstrap-tools/export-graph", instance: "./no-such-instance" },
      { script: "kg-export" },
    ]);
  });

  test("`kg-export` and `kg-export --instance X` are DIFFERENT obligations", () => {
    // The whole of `3jhq`: staging ran the exporter, just not for the foreign
    // layer. Collapsing the two is what let that pass unnoticed.
    const yml = [
      "          bun run cat-harness/scripts/kg-export.ts --out a.jsonld",
      "          bun run cat-harness/scripts/kg-export.ts --instance ./no-such-instance --out b.jsonld",
    ].join("\n");
    const got = invocations(yml);
    expect(got).toHaveLength(2);
    expect(got.map((i) => i.instance)).toEqual([undefined, "./no-such-instance"]);
  });

  test("a check the deploy runs BY SCRIPT NAME is an obligation too (63es)", () => {
    // `check:escaped-markup` ran only in the deploy, invoked by name, so the
    // path matcher never saw it — and a <slide> line that broke every publish
    // from #1615 on stayed green on each PR's preview (#1726).
    const yml = "        run: bun run check:no-such-check ./_site\n          bun run cat-harness/scripts/kg-export.ts --out a.jsonld\n";
    expect(invocations(yml)).toEqual([{ script: "check:no-such-check" }, { script: "kg-export" }]);
  });

  test("a named check mentioned only in a COMMENT is not an obligation", () => {
    expect(invocations("        # run bun run check:no-such-check here\n        echo hi")).toEqual([]);
  });

  test("the real deploy's built-site checks are obligations the real preview meets", () => {
    const deploy = invocations(wf("docs-site.yml")).map((i) => i.script);
    const preview = new Set(invocations(wf("feature-staging.yml")).map((i) => i.script));
    for (const c of ["check:escaped-markup", "check:maintained-artefacts"]) {
      expect(deploy).toContain(c);
      expect(preview.has(c)).toBe(true);
    }
  });

  test("a repeated invocation is counted once", () => {
    const yml = "bun run cat-harness/scripts/ns-export.ts --layer a\nbun run cat-harness/scripts/ns-export.ts --layer b";
    expect(invocations(yml)).toEqual([{ script: "ns-export" }]);
  });

  test("a generator named only in a COMMENT is not an invocation", () => {
    // `code-quality-gates.yml` names `kg-export.ts` twice in prose. An earlier
    // design read those as invocations and reported 50 findings against a
    // workflow that publishes nothing.
    const yml = "          # see cat-harness/scripts/kg-export.ts for why\n          echo hi";
    expect(invocations(yml)).toEqual([]);
    expect(withoutComments(yml)).not.toContain("kg-export");
  });

  test("the real deploy workflow's set includes the foreign-instance export", () => {
    // The witness. A matcher proven only against fixtures is proven against
    // its author's idea of the file.
    //
    // `./bootstrap`, not `./cat-bootstrap`: #771 renamed the directory an hour
    // after #790 added this assertion, and neither branch carried the other's
    // change. Both were green on their own head and main went red on the
    // merge -- which is this witness doing precisely its job.
    //
    // THIS LINE IS THE ONLY ONE THAT READS THE REAL FILE. The fixtures above
    // are synthetic YAML testing that the parser returns WHATEVER instance
    // string it is given, so their name is arbitrary and no directory has to
    // exist for it -- and a fixture naming a directory that does NOT exist is
    // the stronger test, because it cannot pass by the name happening to
    // resolve.
    //
    // They said `cat-bootstrap`, and the same blanket rename took them along
    // with this assertion, quietly weakening them to name a real directory
    // while this comment went on claiming they did not (bean `u2gv`). They now
    // say `./no-such-instance`: a name no rename will ever match, which is the
    // property that was actually wanted. Naming a real-looking directory in a
    // fixture is what made it renameable in the first place.
    const got = invocations(wf("docs-site.yml"));
    //
    // Since 2026-09-30 (bean `xsqm`) that export is bootstrap-tools'
    // `export-graph.ts --root ./bootstrap`, not `kg-export --instance`.
    expect(got.some((i) => i.script === "bootstrap-tools/export-graph" && i.instance === "./bootstrap")).toBe(true);
  });
});

describe("isDeploy", () => {
  test("no `--base-url` on the graph export means it publishes at the canonical base", () => {
    expect(isDeploy('bun run cat-harness/scripts/kg-export.ts --out "./_site/x.jsonld"')).toBe(true);
  });

  test("a `--base-url` means a preview naming itself", () => {
    expect(isDeploy('bun run cat-harness/scripts/kg-export.ts --base-url "$BASE" --out "./_site/x.jsonld"')).toBe(false);
  });

  test("the real pair classifies without either being named in the check", () => {
    // Neither workflow is written down in `check-invocation-parity.ts`; a
    // third site workflow would be classified the moment it exists.
    expect(isDeploy(wf("docs-site.yml"))).toBe(true);
    expect(isDeploy(wf("feature-staging.yml"))).toBe(false);
  });
});

describe("EXEMPT", () => {
  test("every exemption carries a reason", () => {
    // An exemption without one is indistinguishable from an oversight.
    for (const e of EXEMPT) expect(e.reason.length).toBeGreaterThan(20);
  });

  test("each exempt generator really is one the deploy runs", () => {
    // The live half of the stale-exemption rule: an entry for something the
    // deploy no longer runs excuses nothing and hides the next difference.
    const deployScripts = new Set(invocations(wf("docs-site.yml")).map((i) => i.script));
    for (const e of EXEMPT) expect(deployScripts.has(e.script)).toBe(true);
  });
});

describe("formatReport", () => {
  test("no preview is reported as examining nothing, NOT as a pass", () => {
    const out = formatReport({ deploy: "docs-site.yml", peers: [], staleExemptions: [] });
    expect(out).toContain("EXAMINED NOTHING");
    expect(out).not.toContain("✓");
  });

  test("no identifiable deploy is could-not-determine, NOT a pass", () => {
    const out = formatReport({ peers: [], staleExemptions: [], unreadable: "none publishes at the canonical base" });
    expect(out).toContain("COULD NOT DETERMINE");
    expect(out).toContain("not a pass");
    expect(out).not.toContain("✓");
  });

  test("a stale exemption is a finding in its own right", () => {
    const out = formatReport({
      deploy: "docs-site.yml",
      peers: [{ workflow: "feature-staging.yml", missing: [] }],
      staleExemptions: ["gone-export"],
    });
    expect(out).toContain("EXEMPTION IS STALE");
    expect(out).toContain("gone-export");
  });

  test("a missing invocation names the instance argument, not just the script", () => {
    const out = formatReport({
      deploy: "docs-site.yml",
      peers: [{ workflow: "feature-staging.yml", missing: [{ script: "kg-export", instance: "./no-such-instance" }] }],
      staleExemptions: [],
    });
    expect(out).toContain("kg-export --instance ./no-such-instance");
  });

  test("a clean run prints the exemptions with their reasons", () => {
    // So the hand-maintained part is visible on every green run rather than
    // only when it fails — an allow-list nobody sees is one nobody prunes.
    const out = formatReport({
      deploy: "docs-site.yml",
      peers: [{ workflow: "feature-staging.yml", missing: [] }],
      staleExemptions: [],
    });
    expect(out).toContain("exempt, each with its reason");
    expect(out).toContain("fsh-guts-export");
  });
});

// cat-harness-tools#1701: a content instance's root (smart-ips-pilgrimage) has
// workflows, none of which builds a site and exports the graph. That is a
// determined "nothing to compare here", reported as not applicable; a root
// that HAS a graph-exporting site workflow but no identifiable deploy is still
// could-not-determine.
describe("checkInvocationParity over a workflows directory", () => {
  const withWorkflows = (files: Record<string, string>, fn: (dir: string) => void) => {
    const dir = mkdtempSync(join(tmpdir(), "invocation-parity-"));
    try {
      mkdirSync(dir, { recursive: true });
      for (const [n, t] of Object.entries(files)) writeFileSync(join(dir, n), t);
      fn(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  test("no workflow builds a site and exports the graph: not applicable, not a pass", () => {
    withWorkflows(
      {
        "harness-pr-checks.yml": "jobs:\n  checks:\n    uses: litlfred/cat-harness-tools/.github/workflows/layer-pr-checks.yml@abc\n",
        "translations.yml": "    steps:\n      - run: bun input/scripts/translation-pot.ts --check\n",
      },
      (dir) => {
        const r = checkInvocationParity(dir);
        expect(r.notApplicable).toContain("2 workflow(s)");
        expect(r.unreadable).toBeUndefined();
        expect(r.peers).toEqual([]);
      },
    );
  });

  test("a graph-exporting site workflow with no deploy is still could-not-determine", () => {
    withWorkflows(
      { "staging.yml": "      - run: bun run cat-harness-tools/scripts/kg-export.ts --base-url https://x.invalid/ --out ./_site/kg.jsonld\n" },
      (dir) => {
        const r = checkInvocationParity(dir);
        expect(r.notApplicable).toBeUndefined();
        expect(r.unreadable).toContain("deploy cannot be identified");
      },
    );
  });
});
