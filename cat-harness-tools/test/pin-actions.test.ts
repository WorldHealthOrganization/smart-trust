import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseDockerUses, parseUses, pinWorkflows, resolveRef, rewriteUses, stagingExempt, verifyRefs } from "../scripts/pin-actions.ts";

const A = "a".repeat(40), B = "b".repeat(40), C = "c".repeat(40);
const refs = (repo: string) =>
  repo === "owner/annotated"
    ? `${A}\trefs/tags/v5\n${B}\trefs/tags/v5^{}\n`
    : repo === "owner/branchy"
      ? `${C}\trefs/heads/release/v1\n`
      : "";

describe("pin-actions", () => {
  test("an annotated tag pins to its PEELED commit, never the tag object", () => {
    expect(resolveRef("owner/annotated", "v5", (r) => refs(r))).toEqual({ sha: B });
  });

  test("a branch ref resolves to its head", () => {
    expect(resolveRef("owner/branchy", "release/v1", (r) => refs(r))).toEqual({ sha: C });
  });

  test("an unknown ref is REFUSED, not guessed", () => {
    expect("refused" in resolveRef("owner/none", "v9", (r) => refs(r))).toBe(true);
  });

  test("rewrites to @<sha> # <ref>, skips staging-only workflows, and is idempotent", () => {
    const root = mkdtempSync(join(tmpdir(), "pin-actions-"));
    const wf = join(root, ".github", "workflows");
    mkdirSync(wf, { recursive: true });
    writeFileSync(join(wf, "ci.yml"), "    steps:\n      - uses: owner/annotated@v5\n      - uses: ./.github/actions/local\n");
    writeFileSync(join(wf, "feature-staging.yml"), "      - uses: owner/annotated@v5\n");
    const ls = (r: string) => refs(r);
    pinWorkflows(root, { lsRemote: ls });
    expect(readFileSync(join(wf, "ci.yml"), "utf-8")).toContain(`uses: owner/annotated@${B} # v5`);
    expect(readFileSync(join(wf, "feature-staging.yml"), "utf-8")).toContain("owner/annotated@v5");
    expect(pinWorkflows(root, { lsRemote: ls })).toEqual([]);
    expect(parseUses(`      - uses: owner/annotated@${B} # v5`)!.pinned).toBe(true);
  });
});

describe("parseUses: the stricter pin rule (roast 1ygp L4.6)", () => {
  test("a SHA needs a # <ref> to count as pinned", () => {
    expect(parseUses(`      - uses: owner/x@${B} # v5`)).toMatchObject({ status: "pinned", pinned: true, label: "v5" });
    expect(parseUses(`      - uses: owner/x@${B}`)).toMatchObject({ status: "unpinned-unlabelled", pinned: false });
    expect(parseUses(`      - uses: owner/x@${B} #`)).toMatchObject({ status: "unpinned-unlabelled" });
    expect(parseUses("      - uses: owner/x@v5 # v5")).toMatchObject({ status: "unpinned" });
    expect(parseUses(`      - uses: "owner/x@${B}" # v5`)).toMatchObject({ status: "pinned", action: "owner/x" });
  });

  test("the flow-mapping form is parsed", () => {
    expect(parseUses("      - {uses: owner/x@main, with: {a: 1}}")).toMatchObject({ action: "owner/x", ref: "main", flow: true, pinned: false });
    expect(parseUses(`      - { name: n, "uses": owner/x@${B} } # v1`)).toMatchObject({ status: "pinned", label: "v1", flow: true });
    expect(parseUses("      - {name: no uses here}")).toBeUndefined();
  });

  test("local and docker references are not actions; docker digests are read", () => {
    expect(parseUses("      - uses: ./.github/actions/local")).toBeUndefined();
    expect(parseUses("      - uses: docker://alpine:3")).toBeUndefined();
    expect(parseDockerUses("      - uses: docker://alpine:latest")).toEqual({ image: "alpine:latest" });
    expect(parseDockerUses(`      - {uses: docker://alpine@sha256:${"e".repeat(64)}}`)).toEqual({ image: "alpine", digest: `sha256:${"e".repeat(64)}` });
    expect(parseDockerUses("      - uses: owner/x@v1")).toBeUndefined();
  });

  test("a flow-mapping line is rewritten in place with the ref as its comment", () => {
    expect(rewriteUses("      - {uses: owner/x@v5, with: {a: 1}} # old", "owner/x", B, "v5")).toBe(`      - {uses: owner/x@${B}, with: {a: 1}} # v5`);
    expect(rewriteUses("      - uses: owner/x@v5", "owner/x", B, "v5")).toBe(`      - uses: owner/x@${B} # v5`);
  });

  test("pinWorkflows refuses an unlabelled SHA rather than guessing its ref, and pins flow mappings", () => {
    const root = mkdtempSync(join(tmpdir(), "pin-actions-"));
    const wf = join(root, ".github", "workflows");
    mkdirSync(wf, { recursive: true });
    writeFileSync(join(wf, "ci.yml"), `      - uses: owner/x@${A}\n      - {uses: owner/annotated@v5}\n`);
    const [r] = pinWorkflows(root, { lsRemote: refs });
    expect(r!.pinned).toBe(1);
    expect(r!.refused).toHaveLength(1);
    expect(r!.refused[0]).toContain("unpinned-unlabelled");
    expect(readFileSync(join(wf, "ci.yml"), "utf-8")).toContain(`{uses: owner/annotated@${B}} # v5`);
  });
});

describe("--verify-refs: a SHA is checked against its # <ref> only on request", () => {
  test("a matching SHA passes, a wrong one and an unresolvable ref are findings", () => {
    const root = mkdtempSync(join(tmpdir(), "pin-verify-"));
    const wf = join(root, ".github", "workflows");
    mkdirSync(wf, { recursive: true });
    writeFileSync(
      join(wf, "ci.yml"),
      [`      - uses: owner/annotated@${B} # v5`, `      - uses: owner/annotated@${A} # v5`, `      - uses: owner/none@${C} # v9`, "      - uses: owner/x@main"].join("\n"),
    );
    const r = verifyRefs(root, { lsRemote: refs });
    expect(r.checked).toBe(3);
    expect(r.mismatched).toHaveLength(2);
    expect(r.mismatched[0]).toContain(`v5 is ${B}`);
    expect(r.mismatched[1]).toContain("could not verify");
  });
});

describe("every workflow in this repository passes the stricter pin rule", () => {
  test("no unlabelled SHA and no flow-mapping action escapes", () => {
    const dir = join(import.meta.dir, "..", "..", ".github", "workflows");
    const bad: string[] = [];
    for (const f of readdirSync(dir).filter((n) => /\.ya?ml$/.test(n))) {
      readFileSync(join(dir, f), "utf-8").split("\n").forEach((line, i) => {
        const u = parseUses(line);
        if (u && !u.firstParty && !u.pinned) bad.push(`${f}:${i + 1} ${u.status}`);
      });
    }
    expect(bad).toEqual([]);
  });
});

describe("this layer's own workflows and composite actions are SHA-pinned (bean a1p9)", () => {
  // Rooted at this layer, not the checkout above it: the files a caller runs
  // with its write token are .github/workflows/*.yml and the composite
  // actions under .github/actions/, and both live here.
  test("every third-party uses: here carries a full SHA and a # <ref>", () => {
    const gh = join(import.meta.dir, "..", ".github");
    const files = readdirSync(join(gh, "workflows")).filter((n) => /\.ya?ml$/.test(n)).map((n) => join(gh, "workflows", n));
    for (const d of readdirSync(join(gh, "actions"))) {
      for (const n of ["action.yml", "action.yaml"]) if (existsSync(join(gh, "actions", d, n))) files.push(join(gh, "actions", d, n));
    }
    const bad: string[] = [];
    for (const f of files) {
      readFileSync(f, "utf-8").split("\n").forEach((line, i) => {
        const u = parseUses(line);
        if (u && !u.firstParty && !u.pinned) bad.push(`${f}:${i + 1} ${u.status}`);
      });
    }
    expect(files.length).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });
});

describe("stagingExempt: decided from what a workflow can do (owner 2026-10-07, roast 1ygp L4.1)", () => {
  test("a listed staging workflow with no write token and no pull_request_target is exempt", () => {
    expect(stagingExempt("feature-staging.yml", "on:\n  pull_request:\npermissions:\n  contents: read\n")).toBe(true);
  });
  test("a write permission anywhere removes the exemption", () => {
    expect(stagingExempt("feature-staging.yml", "permissions:\n  contents: write\n")).toBe(false);
    expect(stagingExempt("feature-staging.yml", "jobs:\n  a:\n    permissions:\n      pages: write\n")).toBe(false);
    expect(stagingExempt("feature-staging.yml", "permissions: write-all\n")).toBe(false);
  });
  test("a pull_request_target trigger removes it; a comment that mentions it does not", () => {
    expect(stagingExempt("folio-staging.yml", "on:\n  pull_request_target:\n    types: [opened]\n")).toBe(false);
    expect(stagingExempt("folio-staging.yml", "on:\n  pull_request:\n# unlike `pull_request_target:` this is safe\n")).toBe(true);
  });
  test("an unlisted file is never exempt, whatever its name says", () => {
    expect(stagingExempt("my-staging.yml", "on:\n  pull_request:\n")).toBe(false);
  });
});
