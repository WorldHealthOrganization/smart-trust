import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { scriptTable } from "../schemas/sdlc/script-table.ts";
import { actionPinning, blocks, PINNED_CHECK_COMMANDS, pinnedCommandFor, runCheck, SECURITY_CHECKS, securityGate, unpinnedActions, type GateResult } from "../scripts/security-gate.ts";

function repo(workflow?: string, scripts: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "security-gate-"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ scripts }));
  if (workflow !== undefined) {
    mkdirSync(join(root, ".github", "workflows"), { recursive: true });
    writeFileSync(join(root, ".github", "workflows", "ci.yml"), workflow);
  }
  return root;
}

describe("security:gate", () => {
  test("a check that cannot be run is UNKNOWN, and unknown blocks", () => {
    const r = runCheck("check:does-not-exist", true, repo());
    expect(r.state).toBe("unknown");
    expect(blocks([r])).toHaveLength(1);
  });

  test("an advisory failure never blocks", () => {
    const r: GateResult = { check: "x", blocking: false, state: "fail", detail: "" };
    expect(blocks([r])).toHaveLength(0);
  });

  test("a failing blocking check refuses", () => {
    const root = repo(undefined, { "check:always-fails": "exit 3" });
    const r = runCheck("check:always-fails", true, root, { "check:always-fails": "exit 3" });
    expect(r.state).toBe("fail");
    expect(r.detail).not.toContain("pins");
    expect(blocks([r])).toHaveLength(1);
  });

  test("a check NOT APPLICABLE here (exit 78) is UNKNOWN with its reason, never a refusal, and still blocks", () => {
    const cmd = "echo 'no corpus here'; exit 78";
    const root = repo(undefined, { "check:not-here": cmd });
    const r = runCheck("check:not-here", true, root, { "check:not-here": cmd });
    expect(r.state).toBe("unknown");
    expect(r.detail).toBe("not applicable in this root — no corpus here");
    expect(blocks([r])).toHaveLength(1);
  });
});

describe("each gate check is pinned to its command (roast 1ygp L4.5)", () => {
  test("repointing a check to `true` makes the gate REFUSE, without running it", () => {
    const root = repo(undefined, { "check:secret-leaks": "true" });
    const r = runCheck("check:secret-leaks", true, root);
    expect(r.state).toBe("fail");
    expect(r.detail).toContain("pins");
    expect(r.detail).toContain(PINNED_CHECK_COMMANDS["check:secret-leaks"]!);
    expect(blocks([r])).toHaveLength(1);
  });

  test("a command that wraps the pinned one but does something else is refused too", () => {
    const pin = PINNED_CHECK_COMMANDS["check:bun-pin"]!;
    const root = repo(undefined, { "check:bun-pin": `${pin} || true` });
    expect(runCheck("check:bun-pin", true, root).state).toBe("fail");
  });

  test("a check with no pin is refused, and an absent one stays UNKNOWN", () => {
    const root = repo(undefined, { "check:new": "true" });
    expect(runCheck("check:new", true, root).state).toBe("fail");
    expect(runCheck("check:absent", true, root).state).toBe("unknown");
  });

  test("every gate check has a pin, and every pin matches this checkout's manifests", () => {
    const table = scriptTable(resolve(import.meta.dir, "..", ".."));
    expect(table.size).toBeGreaterThan(0);
    for (const c of SECURITY_CHECKS) {
      expect(PINNED_CHECK_COMMANDS[c.script]).toBeDefined();
      const entry = table.get(c.script);
      if (entry) {
        expect(entry.command).toBe(pinnedCommandFor(c.script, entry, PINNED_CHECK_COMMANDS)!);
      }
    }
    expect(Object.keys(PINNED_CHECK_COMMANDS).sort()).toEqual(SECURITY_CHECKS.map((c) => c.script).sort());
  });
});

describe("pinned means a SHA and its # <ref> (roast 1ygp L4.6)", () => {
  test("a SHA with no # <ref> comment is unpinned-unlabelled and BLOCKS", () => {
    const sha = "0123456789abcdef0123456789abcdef01234567";
    const r = unpinnedActions(repo(`      - uses: actions/checkout@${sha}\n`))!;
    expect(r.unpinned).toHaveLength(1);
    expect(r.unpinned[0]).toContain("unpinned-unlabelled");
    const [published] = actionPinning(repo(`      - uses: actions/checkout@${sha}\n`));
    expect(published!.state).toBe("fail");
    expect(blocks([published!])).toHaveLength(1);
  });

  test("a flow-mapping uses: is seen, and blocks when unpinned", () => {
    const r = unpinnedActions(repo("      - {uses: owner/x@main, with: {a: 1}}\n"))!;
    expect(r.total).toBe(1);
    expect(r.unpinned[0]).toContain("owner/x@main");
  });

  test("a docker:// image by tag is reported, advisory only; a digest passes", () => {
    const digest = "sha256:" + "e".repeat(64);
    const results = actionPinning(repo(`      - uses: docker://alpine:latest\n      - uses: docker://alpine@${digest}\n`));
    const docker = results.find((x) => x.check === "docker-image-digest-pinning")!;
    expect(docker.state).toBe("fail");
    expect(docker.blocking).toBe(false);
    expect(docker.detail).toContain("docker://alpine:latest");
    expect(docker.detail).not.toContain(digest);
    expect(blocks(results)).toHaveLength(0);
  });

  test("only a full 40-hex SHA counts as pinned; local and docker refs are not third-party", () => {
    const wf = [
      "    steps:",
      "      - uses: actions/checkout@v4",
      "      - uses: actions/setup-node@0123456789abcdef0123456789abcdef01234567 # v4",
      "      - uses: owner/short@0123456",
      "      - uses: ./.github/actions/local",
      "      - uses: docker://alpine:3",
    ].join("\n");
    const r = unpinnedActions(repo(wf))!;
    expect(r.total).toBe(3);
    expect(r.unpinned.map((u) => u.split(" ")[1])).toEqual(["actions/checkout@v4", "owner/short@0123456"]);
    expect(actionPinning(repo(wf))[0]!.state).toBe("fail");
  });

  test("no workflows directory is unknown, not pass", () => {
    expect(actionPinning(repo())[0]!.state).toBe("unknown");
  });
});

describe("action pinning follows the owner's staging ruling", () => {
  test("an unpinned action BLOCKS outside staging and is advisory in a staging-only workflow", () => {
    const root = repo("    steps:\n      - uses: actions/checkout@v4\n");
    writeFileSync(join(root, ".github", "workflows", "feature-staging.yml"), "    steps:\n      - uses: actions/checkout@v4\n");
    const [published, staging] = actionPinning(root);
    expect(published!.blocking).toBe(true);
    expect(published!.state).toBe("fail");
    expect(staging!.blocking).toBe(false);
    expect(staging!.state).toBe("fail");
    expect(blocks([published!, staging!])).toHaveLength(1);
  });

  test("first-party reusable workflows are not third-party", () => {
    const root = repo(
      "    uses: litlfred/folio-assistant/.github/workflows/publish.yml@main\n" +
        "    uses: litlfred/cat-harness-tools/.github/workflows/layer-cancel-on-close.yml@main\n",
    );
    expect(unpinnedActions(root)!.total).toBe(0);
  });
});

describe("a staging workflow that holds a write token is NOT exempt (owner 2026-10-07, roast 1ygp L4.1)", () => {
  test("an unpinned action in it blocks", () => {
    const root = mkdtempSync(join(tmpdir(), "sg-write-"));
    mkdirSync(join(root, ".github", "workflows"), { recursive: true });
    writeFileSync(join(root, ".github", "workflows", "feature-staging.yml"), "permissions:\n  contents: write\njobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n");
    const [published] = actionPinning(root);
    expect(published!.blocking).toBe(true);
    expect(published!.state).toBe("fail");
  });
});

describe("checks moved into a layer's checkoutScripts are still run (#2448)", () => {
  test("a layer script is found and run, not reported unknown", () => {
    // check:secret-leaks lives in cat-harness-tools/package.json checkoutScripts since #2448.
    const r = runCheck("check:secret-leaks", true);
    expect(r.state).not.toBe("unknown");
  });
});

describe("layer checkout support (bean cat-tools-q8gk)", () => {
  test("check:materialized-fixity resolves from whichever layer declares it", () => {
    expect(pinnedCommandFor("check:materialized-fixity", "folio-assistant-core")).toBe(
      "bun run folio-assistant-core/scripts/check-materialized-fixity.ts",
    );
    expect(pinnedCommandFor("check:materialized-fixity", "custom-content-layer")).toBe(
      "bun run custom-content-layer/scripts/check-materialized-fixity.ts",
    );
    expect(pinnedCommandFor("check:materialized-fixity", undefined)).toBe(
      "bun run scripts/check-materialized-fixity.ts",
    );
  });

  // securityGate spawns every SECURITY_CHECKS script as its own process over
  // the whole layer, so bun's 5 s default is less than a loaded runner needs
  // (it timed out at 5016 ms on folio-assistant-core#760); 60 s as id-lookup.
  test("from a layer checkout, each check either runs or reports a named unknown without a stack trace", () => {
    const layerRoot = resolve(import.meta.dir, "..");
    const results = securityGate(layerRoot);
    for (const r of results) {
      expect(["pass", "unknown"]).toContain(r.state);
      expect(r.detail).not.toContain("ENOENT");
      expect(r.detail).not.toContain("Cannot find module");
      expect(r.detail).not.toMatch(/\bat\s+\S+\s+\(/);
    }
  }, 60_000);
});
