/**
 * ensure-software — a missing program is got, not routed around (owner,
 * 2026-10-09: "update skills and tools on finding software", "also add apt").
 *
 * Driven through an injected machine, so no test runs an installer or reaches
 * the network; the real ladder was run once by hand (beans via its GitHub
 * release, sha256-verified).
 *
 * @module scripts/tests/ensure-software.test
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ensureSoftware, readSoftware, select, type Machine, type SoftwareEntry } from "../ensure-software.ts";

/** A machine whose installed set changes only when a command the test allows succeeds. */
function machine(o: {
  have?: string[];
  root?: boolean;
  apt?: boolean;
  aptNeedsUpdate?: boolean;
  aptGives?: string[];
  pipManaged?: boolean;
  pipGives?: string[];
  asset?: Uint8Array;
}): Machine & { calls: string[] } {
  const have = new Set(o.have ?? []);
  let updated = false;
  const calls: string[] = [];
  const binDir = mkdtempSync(join(tmpdir(), "ensure-bin-"));
  return {
    calls,
    platform: "linux-x64",
    binDir,
    async fetch() {
      return o.asset ? { ok: true, status: 200, bytes: o.asset } : { ok: false, status: 403 };
    },
    run(cmd, args) {
      const line = [cmd, ...args].join(" ");
      calls.push(line);
      if (cmd === "sh" && args[1]?.startsWith("command -v ")) {
        const what = args[1].slice("command -v ".length);
        if (what === "apt-get") return { status: o.apt === false ? 1 : 0, out: "" };
        return { status: have.has(what) ? 0 : 1, out: "" };
      }
      if (cmd === "python3" && args[0] === "-c") return { status: have.has(args[1]!.replace("import ", "")) ? 0 : 1, out: "" };
      if (cmd === "id") return { status: 0, out: o.root === false ? "1000\n" : "0\n" };
      if (cmd === "sudo") return { status: 1, out: "" };
      if (cmd === "apt-get" && args[0] === "update") {
        updated = true;
        return { status: 0, out: "" };
      }
      if (cmd === "apt-get" && args[0] === "install") {
        if (o.aptNeedsUpdate && !updated) return { status: 100, out: "E: Unable to locate package" };
        for (const g of o.aptGives ?? []) have.add(g);
        return { status: 0, out: "" };
      }
      if (cmd === "python3" && args[1] === "pip") {
        if (o.pipManaged && !args.includes("--break-system-packages")) return { status: 1, out: "error: externally-managed-environment" };
        for (const g of o.pipGives ?? []) have.add(g);
        return { status: 0, out: "" };
      }
      if (cmd === "tar") return { status: 1, out: "not a tar" };
      return { status: 127, out: `unexpected: ${line}` };
    },
  };
}

const tesseract: SoftwareEntry = { name: "tesseract", provides: { command: "tesseract" }, apt: ["tesseract-ocr"] };
const pymupdf: SoftwareEntry = { name: "pymupdf", provides: { python: "pymupdf" }, pip: "pymupdf" };

describe("the ladder", () => {
  test("present is present: nothing is installed", async () => {
    const m = machine({ have: ["tesseract"] });
    expect(await ensureSoftware([tesseract], { machine: m })).toEqual([{ name: "tesseract", state: "present", attempts: [] }]);
    expect(m.calls.some((c) => c.startsWith("apt-get"))).toBe(false);
  });

  test("apt installs, after one `apt-get update` when the package lists are stale", async () => {
    const m = machine({ aptNeedsUpdate: true, aptGives: ["tesseract"] });
    const [r] = await ensureSoftware([tesseract], { machine: m });
    expect(r!.state).toBe("apt");
    expect(m.calls).toContain("apt-get update -q");
  });

  test("not root and no sudo: apt is reported as not offered, never skipped silently", async () => {
    const [r] = await ensureSoftware([tesseract], { machine: machine({ root: false }) });
    expect(r!.state).toBe("missing");
    expect(r!.attempts[0]).toMatchObject({ rung: "apt", outcome: "not-offered" });
    expect(r!.attempts.map((a) => a.rung)).toEqual(["apt", "pip", "github"]);
  });

  test("pip retries with --break-system-packages on an externally managed interpreter", async () => {
    const m = machine({ pipManaged: true, pipGives: ["pymupdf"] });
    const [r] = await ensureSoftware([pymupdf], { machine: m });
    expect(r!.state).toBe("pip");
    expect(m.calls.some((c) => c.includes("--break-system-packages"))).toBe(true);
  });

  test("--check reports and installs nothing", async () => {
    const m = machine({ aptGives: ["tesseract"] });
    expect((await ensureSoftware([tesseract], { machine: m, checkOnly: true }))[0]!.state).toBe("missing");
    expect(m.calls.some((c) => c.startsWith("apt-get"))).toBe(false);
  });
});

describe("a GitHub release is installed only when its checksum matches", () => {
  const bytes = new TextEncoder().encode("#!/bin/sh\necho hi\n");
  const entry = (sha256: string): SoftwareEntry => ({
    name: "tool",
    provides: { command: "tool" },
    github: { repo: "o/tool", tag: "v1", bin: "tool", assets: { "linux-x64": { asset: "tool", sha256 } } },
  });

  test("a matching sha256 installs the binary into the bin dir", async () => {
    const m = machine({ asset: bytes });
    try {
      const [r] = await ensureSoftware([entry(createHash("sha256").update(bytes).digest("hex"))], { machine: m });
      expect(r!.state).toBe("github");
    } finally {
      rmSync(m.binDir, { recursive: true, force: true });
    }
  });

  test("a mismatched sha256 installs nothing", async () => {
    const m = machine({ asset: bytes });
    try {
      const [r] = await ensureSoftware([entry("0".repeat(64))], { machine: m });
      expect(r!.state).toBe("missing");
      expect(r!.attempts.at(-1)!.detail).toContain("not installed");
    } finally {
      rmSync(m.binDir, { recursive: true, force: true });
    }
  });

  test("no asset for this platform, or a 403, is said as such", async () => {
    const m = machine({});
    const [r] = await ensureSoftware([entry("0".repeat(64))], { machine: m });
    expect(r!.attempts.at(-1)!.detail).toContain("403");
  });
});

describe("the declared table", () => {
  test("every entry has a way to get it, and every GitHub asset is pinned and checksummed", () => {
    const all = readSoftware();
    expect(all.length).toBeGreaterThan(0);
    for (const e of all) {
      expect(Boolean(e.apt?.length || e.pip || e.github)).toBe(true);
      for (const a of Object.values(e.github?.assets ?? {})) expect(a.sha256).toMatch(/^[0-9a-f]{64}$/);
      if (e.github) expect(e.github.tag).not.toBe("latest");
    }
  });

  test("--for picks what a script needs; an unknown name is returned, never dropped", () => {
    const all = readSoftware();
    expect(select(all, [], "cat-harness/scripts/pdf-ocr.py").picked.map((e) => e.name).sort()).toEqual(["pdftoppm", "tesseract"]);
    expect(select(all, ["tesseract", "nope"]).unknown).toEqual(["nope"]);
  });
});
