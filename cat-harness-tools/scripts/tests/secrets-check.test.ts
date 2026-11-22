/**
 * `secrets:check` (bean `folio-assistant-jzba`): names only, three states,
 * and could-not-determine never reads as clean.
 *
 * @module scripts/tests/secrets-check.test
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { exitCodeFor, judgeSecrets, readRepoFiles, secretRefs, type RepoEvidence } from "../secrets-check.ts";
import { secretsHealthCheck } from "../../test/health/checks.ts";
import { HealthCheckResultSchema } from "../../schemas/sdlc/health-report.ts";

const NOW = new Date("2026-10-11T00:00:00Z");
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function repo(files: Record<string, string>): string {
  const d = mkdtempSync(join(tmpdir(), "secrets-check-"));
  dirs.push(d);
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(join(d, p, ".."), { recursive: true });
    writeFileSync(join(d, p), body);
  }
  return d;
}

const ev = (over: Partial<RepoEvidence> = {}): RepoEvidence => ({
  repo: "o/r",
  used: new Map([["publish.yml", new Set(["PUBLISH_SITE_BOOTSTRAP"])]]),
  declared: new Map([["publish-site-bootstrap", { secret: "PUBLISH_SITE_BOOTSTRAP", without: "fail" }]]),
  present: new Set(["PUBLISH_SITE_BOOTSTRAP"]),
  registry: [{ secret: "PUBLISH_SITE_BOOTSTRAP", expiresOn: "2027-06-01" }],
  ...over,
});

describe("reading workflow references", () => {
  test("only `${{ secrets.NAME }}` counts — `secrets.token_hex` in a script does not", () => {
    const yml = [
      "env:",
      "  T: ${{ secrets.PUBLISH_SITE_BOOTSTRAP }}",
      "  U: ${{ github.event_name == 'push' && secrets.PUSH_BRANCH_TRIGGERING_CI || '' }}",
      "run: python3 -c 'import secrets; print(secrets.token_hex(8))'",
    ].join("\n");
    expect([...secretRefs(yml)].sort()).toEqual(["PUBLISH_SITE_BOOTSTRAP", "PUSH_BRANCH_TRIGGERING_CI"]);
  });

  test("files are read by name; no needs.json is UNDECLARED, not an empty declaration", () => {
    const d = repo({ ".github/workflows/a.yml": "x: ${{ secrets.NPM_TOKEN }}\n" });
    const files = readRepoFiles(d, "o/r");
    expect([...files.used.get("a.yml")!]).toEqual(["NPM_TOKEN"]);
    expect(files.declared).toBeUndefined();
    expect(files.registry).toBeUndefined();
  });
});

describe("three states", () => {
  test("a fully declared, present, unexpiring set is clean (exit 0)", () => {
    const r = judgeSecrets([ev()], NOW);
    expect(r.findings).toEqual([]);
    expect(r.undetermined).toEqual([]);
    expect(exitCodeFor(r)).toBe(0);
  });

  test("no needs.json is COULD NOT DETERMINE (exit 2), never clean", () => {
    const r = judgeSecrets([ev({ declared: undefined })], NOW);
    expect(r.undetermined.map((u) => u.part)).toEqual(["declared-needs"]);
    expect(exitCodeFor(r)).toBe(2);
  });

  test("unlisted names (a 403) are could-not-determine, and outrank a major finding", () => {
    const r = judgeSecrets([ev({ present: { reason: "HTTP 403" }, used: new Map([["a.yml", new Set(["PUBLISH_SITE_BOOTSTRAP", "UNDECLARED"])]]) })], NOW);
    expect(r.findings.map((f) => f.kind)).toContain("used-not-declared");
    expect(exitCodeFor(r)).toBe(2);
  });
});

describe("findings, named", () => {
  test("used-not-declared, declared-not-used, declared-not-present, present-not-declared", () => {
    const r = judgeSecrets(
      [
        ev({
          used: new Map([["a.yml", new Set(["UNDECLARED", "GITHUB_TOKEN"])]]),
          declared: new Map([["n", { secret: "PUBLISH_SITE_BOOTSTRAP", without: "fail" }]]),
          present: new Set(["ORPHAN"]),
          registry: [],
        }),
      ],
      NOW,
    );
    const by = (k: string) => r.findings.filter((f) => f.kind === k).map((f) => f.secret);
    expect(by("used-not-declared")).toEqual(["UNDECLARED"]);
    expect(by("declared-not-used")).toEqual(["PUBLISH_SITE_BOOTSTRAP"]);
    expect(by("declared-not-present")).toEqual(["PUBLISH_SITE_BOOTSTRAP"]);
    expect(by("present-not-declared")).toEqual(["ORPHAN"]);
    // GITHUB_TOKEN is GitHub's own and needs no supply.
    expect(r.findings.some((f) => f.secret === "GITHUB_TOKEN")).toBe(false);
    expect(exitCodeFor(r)).toBe(1);
  });

  test("a `degrade` need missing is minor; a `fail` need missing is major", () => {
    const minor = judgeSecrets([ev({ declared: new Map([["n", { secret: "PUBLISH_SITE_BOOTSTRAP", without: "degrade" }]]), present: new Set() })], NOW);
    expect(minor.findings.find((f) => f.kind === "declared-not-present")!.severity).toBe("minor");
    const major = judgeSecrets([ev({ present: new Set() })], NOW);
    expect(major.findings.find((f) => f.kind === "declared-not-present")!.severity).toBe("major");
  });

  test("a mechanism-named secret is advisory; the App's identity key is the stated exception", () => {
    const r = judgeSecrets([ev({ declared: undefined, used: new Map([["a.yml", new Set(["BOOTSTRAP_PAGES_TOKEN", "HARNESS_BOT_PRIVATE_KEY"])]]) })], NOW);
    const naming = r.findings.filter((f) => f.kind === "naming-rule");
    expect(naming.map((f) => f.secret)).toEqual(["BOOTSTRAP_PAGES_TOKEN"]);
    expect(naming[0]!.severity).toBe("advisory");
  });

  test("expiry: >30 days nothing, ≤30 minor, ≤7 major, past critical", () => {
    const at = (expiresOn: string) => judgeSecrets([ev({ registry: [{ secret: "PUBLISH_SITE_BOOTSTRAP", expiresOn }] })], NOW).findings.map((f) => f.severity);
    expect(at("2026-12-01")).toEqual([]);
    expect(at("2026-11-01")).toEqual(["minor"]);
    expect(at("2026-10-15")).toEqual(["major"]);
    expect(at("2026-10-01")).toEqual(["critical"]);
  });
});

describe("bun run health", () => {
  test("undeclared needs are a MAJOR finding there — not clean — and the result validates", () => {
    const d = repo({ ".github/workflows/a.yml": "x: ${{ secrets.NPM_TOKEN }}\n" });
    const r = secretsHealthCheck(NOW, [readRepoFiles(d, "o/r")]);
    expect(HealthCheckResultSchema.safeParse(r).success).toBe(true);
    expect(r.state).toBe("finding");
    expect(r.findings.find((f) => f.metric === "secret-needs-undetermined")!.severity).toBe("major");
    expect(r.findings.some((f) => /Declared needs: could not determine for o\/r/.test(f.summary))).toBe(true);
  });

  test("every threshold states its basis", () => {
    const r = secretsHealthCheck(NOW, []);
    for (const t of r.thresholds) expect(t.basis.length).toBeGreaterThan(20);
    expect(r.thresholds.map((t) => t.value)).toEqual([30, 7, 0, 0]);
  });
});
