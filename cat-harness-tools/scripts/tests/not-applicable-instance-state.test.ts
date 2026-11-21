/**
 * Platform state in an instance's joined checkout is NOT APPLICABLE, not red
 * (cat-harness-tools#1701, smart-ips-pilgrimage#13).
 *
 * A content instance's CI checks the instance out as the root and mounts every
 * platform layer beside it. cat-harness declares checkout-level state for every
 * checkout (`beans/`, `todos/`, `uploads/`, the health results, ...), and the
 * instance's remote carries none of those branches, so `state:mount` records
 * each one absent. `check:declared-dirs` reported every one "unmounted" and
 * `check:harness-state` reported six families "could not determine": 55 of
 * the 56 red gates on pilgrimage's main were of this shape.
 *
 * Falsifiers: with no absence record (the mount never ran, or the remote does
 * carry the branch), the same entry is still a finding; a root that declares
 * the directory itself is judged as before.
 *
 * @module scripts/tests/not-applicable-instance-state
 */
import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { MOUNT_MARKER_SCHEMA, markerPath } from "../branch-store.ts";
import { auditInstance, notApplicable, tipPresence } from "../check-declared-dirs.ts";
import { excuseAbsent, FAMILY_CONTAINERS, type Family } from "../check-harness-state.ts";
import { mountState } from "../state-mount.ts";

const NOGPG = ["-c", "commit.gpgsign=false", "-c", "user.name=t", "-c", "user.email=t@t"];
const SHA = "0".repeat(40);

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", [...NOGPG, ...args], { cwd, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} → ${r.status}\n${r.stderr}`);
  return r.stdout;
}

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
  notApplicable.splice(0);
});

/**
 * An instance checkout (`work`, its own root instance `inst`) with a mounted
 * platform layer `plat` that declares repository-scoped `beans/` on a branch
 * the checkout's origin does not carry, and a repository-scoped `uploads/`
 * that is not on disk.
 */
function instanceCheckout() {
  const base = mkdtempSync(join(tmpdir(), "na-instance-state-"));
  made.push(base);
  const origin = join(base, "origin.git");
  git(base, "init", "-q", "--bare", "-b", "main", origin);
  const work = join(base, "work");
  mkdirSync(work);
  git(work, "init", "-q", "-b", "main");
  writeFileSync(join(work, "README.md"), "instance\n");
  writeFileSync(join(work, "inst.json"), JSON.stringify({ $schema: "cat-harness-declaration/1.0.0", name: "inst", directories: [] }));
  git(work, "add", "-A");
  git(work, "commit", "-q", "-m", "root");
  git(work, "remote", "add", "origin", `file://${origin}`);
  mkdirSync(join(work, "plat"));
  writeFileSync(
    join(work, "plat", "plat.json"),
    JSON.stringify({
      $schema: "cat-harness-declaration/1.0.0",
      name: "plat",
      directories: [
        { id: "beans", path: "beans/", scope: "repository", graphTypologies: ["beans"], source: { kind: "branch", branch: "cat/plat/beans", keyedBy: "tip" } },
        { id: "uploads", path: "uploads/", scope: "repository", graphTypologies: ["uploads"] },
      ],
    }),
  );
  writeFileSync(
    join(work, "index.lock.json"),
    JSON.stringify({
      $schema: "cat-harness-mount-lock/v1",
      mounts: [{ harness: "plat", repository: "test/plat", ref: SHA }],
      instances: [
        {
          instance: "plat",
          repository: "test/plat",
          sha: SHA,
          upstreamRoot: "",
          path: "plat",
          via: "plat",
          pinnedBy: "declared",
          declaration: { file: "plat.json", sha256: "0".repeat(64) },
          directories: [],
        },
      ],
      unmounted: [],
    }),
  );
  const store = { urlFor: () => `file://${join(base, "plat.git")}` };
  return { work, plat: join(work, "plat"), store };
}

describe("check:declared-dirs in an instance's joined checkout", () => {
  test("state the mount recorded absent is not applicable, and says why", () => {
    const f = instanceCheckout();
    mountState({ repoRoot: f.work, store: f.store });
    const findings = auditInstance(f.plat, f.work, [f.work, f.plat]);
    expect(findings.filter((x) => x.id === "beans")).toEqual([]);
    const beans = notApplicable.find((n) => n.id === "beans");
    expect(beans?.reason).toContain("not by this root");
  });

  test("without an absence record the same entry is still unmounted", () => {
    const f = instanceCheckout();
    const findings = auditInstance(f.plat, f.work, [f.work, f.plat]);
    expect(findings.find((x) => x.id === "beans")?.kind).toBe("unmounted");
    expect(notApplicable.find((n) => n.id === "beans")).toBeUndefined();
  });

  test("checkout-level state a mounted layer declares and nobody created is not applicable", () => {
    const f = instanceCheckout();
    const findings = auditInstance(f.plat, f.work, [f.work, f.plat]);
    expect(findings.find((x) => x.id === "uploads")).toBeUndefined();
    expect(notApplicable.find((n) => n.id === "uploads")?.reason).toContain("not by this root");
  });

  test("the root's own repository-scoped directory that is missing is still a finding", () => {
    const f = instanceCheckout();
    writeFileSync(
      join(f.work, "inst.json"),
      JSON.stringify({ $schema: "cat-harness-declaration/1.0.0", name: "inst", directories: [{ id: "uploads", path: "uploads/", scope: "repository", graphTypologies: ["uploads"] }] }),
    );
    const findings = auditInstance(f.work, f.work, [f.work, f.plat]);
    expect(findings.find((x) => x.id === "uploads")?.kind).toBe("absent");
  });

  test("an id several OTHER mounts share is not 'could not determine' for this path", () => {
    const f = instanceCheckout();
    for (const who of ["a", "b"]) {
      const p = markerPath(f.work, `${who}.health`);
      mkdirSync(dirname(p), { recursive: true });
      mkdirSync(join(f.work, who, "health"), { recursive: true });
      writeFileSync(
        p,
        JSON.stringify({ $schema: MOUNT_MARKER_SCHEMA, id: "health", key: `${who}.health`, path: `${who}/health`, into: `${who}/health`, branch: `cat/${who}/health`, tip: SHA, files: {} }),
      );
    }
    const t = tipPresence({ id: "health", branch: "cat/plat/health", keyedBy: "tip" }, join(f.work, "test", "health", "results"), f.work);
    expect(t.state).toBe("unmounted");
    if (t.state !== "mounted") expect(t.detail).not.toContain("could not determine");
  });
});

describe("check:harness-state families over an absent container", () => {
  const blind = (id: string): Family => ({ id, summary: "s", examined: 0, findings: [], unreadable: "could not determine" });

  test("a blind family whose container is recorded absent becomes not applicable", () => {
    const [f] = excuseAbsent([blind("merge-queue-entry-is-named-for-its-pr")], (g) => (g.includes("beans") ? "beans is absent here" : undefined));
    expect(f!.unreadable).toBeUndefined();
    expect(f!.notApplicable).toBe("beans is absent here");
  });

  test("with no absence record it stays blind", () => {
    const [f] = excuseAbsent([blind("merge-queue-entry-is-named-for-its-pr")], () => undefined);
    expect(f!.unreadable).toBe("could not determine");
    expect(f!.notApplicable).toBeUndefined();
  });

  test("a family with no declared container is never excused", () => {
    const [f] = excuseAbsent([blind("interaction-profile-is-read")], () => "anything");
    expect(FAMILY_CONTAINERS["interaction-profile-is-read"]).toBeUndefined();
    expect(f!.unreadable).toBe("could not determine");
  });
});
