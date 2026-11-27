/**
 * state-push round trips through a REAL remote: mount, edit on disk, splice.
 * The thing under test is that a push of the whole tree would have LOST a
 * sibling's write and this does not, so both writers have to be real. Since
 * bean `nij4` the splice is branch-store's `pushMount`; these pin it through
 * the `state:push` command — including the bytes, modes and symlinks the old
 * text-reading implementation lost.
 *
 * @module scripts/tests/state-push
 */
import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, lstatSync, rmSync, readFileSync, readlinkSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { mountState } from "../state-mount.js";
import { pushState, report, unknownArgs } from "../state-push.js";
import { BRANCH, cleanup, git, MANIFEST, PDF, richSeed, stateFixture } from "./state-fixture.js";

afterEach(cleanup);

function mounted(seed?: Parameters<typeof stateFixture>[1]) {
  const f = stateFixture("state-push-t-", seed);
  const co = f.checkout("a");
  const m = mountState({ repoRoot: co.root, store: co.store });
  if (m.state !== "mounted") throw new Error(`mount failed: ${m.reason}`);
  return { f, ...co, push: (extra = {}) => pushState({ repoRoot: co.root, store: co.store, ...extra }) };
}

describe("what the mount holds becomes a splice", () => {
  test("no mount is reported, not mistaken for nothing to push", () => {
    const { root, store } = stateFixture("state-push-t-").checkout("a");
    const r = pushState({ repoRoot: root, store });
    expect(r.state).toBe("no-mount");
    expect(report(r)).toContain("state:mount");
  });

  test("nothing to push is not an error", () => {
    expect(mounted().push().state).toBe("nothing");
  });

  test("a dry run names each change and sends nothing", () => {
    const { f, root, push } = mounted();
    const before = f.tip();
    writeFileSync(join(root, "todos/a.md"), "A2\n");
    writeFileSync(join(root, "todos/new.md"), "N\n");
    unlinkSync(join(root, "todos/keep.md"));
    const r = push({ dryRun: true });
    expect(r.state).toBe("would-push");
    const text = report(r);
    expect(text).toContain("`todos/a.md` — update");
    expect(text).toContain("`todos/new.md` — create");
    expect(text).toContain("`todos/keep.md` — delete");
    expect(f.tip()).toBe(before);
  });

  test("an edit lands, and a sibling's write to ANOTHER file survives it", () => {
    const { f, root, push } = mounted();
    expect(f.sibling("s", root).write([{ path: "todos/sib.md", content: "S\n", expect: null }], "sibling").state).toBe("pushed");
    writeFileSync(join(root, "todos/a.md"), "A2\n");
    const r = push();
    expect(r.state).toBe("pushed");
    expect(f.remoteFile("todos/a.md")?.toString()).toBe("A2\n");
    // The lost update a whole-tree push would have caused:
    expect(f.remoteFile("todos/sib.md")?.toString()).toBe("S\n");
    expect(f.remoteFile("manifest.json")).toBeDefined();
  });

  test("a sibling's edit to the SAME file is a conflict, nothing is pushed, and the edit is kept", () => {
    const { f, root, push } = mounted();
    const blob = git(f.bare, "rev-parse", `refs/heads/${BRANCH}:todos/a.md`).trim();
    expect(f.sibling("s", root).write([{ path: "todos/a.md", content: "SIBLING\n", expect: blob }], "sibling").state).toBe("pushed");
    writeFileSync(join(root, "todos/a.md"), "MINE\n");
    const r = push();
    // Nothing settled, so the run fails (exit 1); the graph names why.
    expect(r.state).toBe("failed");
    expect(r.graphs[0]?.state).toBe("conflict");
    expect(f.remoteFile("todos/a.md")?.toString()).toBe("SIBLING\n");
    expect(readFileSync(join(root, "todos/a.md"), "utf-8")).toBe("MINE\n");
    expect(report(r)).toContain("todos/a.md");
  });

  test("a mount whose declaration was removed is still pushed — its edits are not stranded", () => {
    const { f, root, push } = mounted();
    unlinkSync(join(root, "t.json"));
    writeFileSync(join(root, "todos/a.md"), "A3\n");
    expect(push().state).toBe("pushed");
    expect(f.remoteFile("todos/a.md")?.toString()).toBe("A3\n");
  });
});

describe("an emptied mount is not pushed as a deletion (bean sp0e)", () => {
  test("a mount whose files are all gone is refused, and the branch keeps them", () => {
    const { f, root, push } = mounted();
    const before = f.tip();
    rmSync(join(root, "todos"), { recursive: true, force: true });
    const r = push();
    expect(r.state).not.toBe("pushed");
    expect(r.graphs.find((g) => g.path.startsWith("todos"))?.state).toBe("refused");
    expect(report(r)).toContain("--allow-empty");
    expect(f.tip()).toBe(before);
  });

  test("--allow-empty deletes the graph when that is meant", () => {
    const { f, root, push } = mounted();
    const before = f.tip();
    rmSync(join(root, "todos"), { recursive: true, force: true });
    expect(push({ allowEmpty: true }).state).toBe("pushed");
    expect(f.tip()).not.toBe(before);
  });

  test("deleting SOME files is an ordinary edit and still pushes", () => {
    const { root, push } = mounted();
    unlinkSync(join(root, "todos/keep.md"));
    expect(push().state).toBe("pushed");
  });

  test("the flag is understood", () => {
    expect(unknownArgs(["--allow-empty"])).toEqual([]);
  });

  test("deleting more than 50% of a mount's files without replacement is refused unless --allow-mass-delete is passed (bean 1ple)", () => {
    const { f, root, push } = mounted({
      "manifest.json": MANIFEST,
      "todos/a.md": "A\n",
      "todos/b.md": "B\n",
      "todos/c.md": "C\n",
      "todos/d.md": "D\n",
    });
    const before = f.tip();
    // Delete 3 of 4 files (75%).
    unlinkSync(join(root, "todos/a.md"));
    unlinkSync(join(root, "todos/b.md"));
    unlinkSync(join(root, "todos/c.md"));

    const refused = push();
    expect(refused.state).not.toBe("pushed");
    expect(refused.graphs[0]?.state).toBe("refused");
    expect(report(refused)).toContain("--allow-mass-delete");
    expect(f.tip()).toBe(before);

    const allowed = push({ allowMassDelete: true });
    expect(allowed.state).toBe("pushed");
    expect(f.tip()).not.toBe(before);
    expect(unknownArgs(["--allow-mass-delete"])).toEqual([]);
  });
});

describe("bytes, modes and symlinks round-trip through the commands", () => {
  test("a binary arrives unchanged on the mount", () => {
    const { root } = mounted(richSeed());
    expect(readFileSync(join(root, "todos/doc.pdf")).equals(PDF)).toBe(true);
  });

  test("a new binary, an executable bit and a symlink are pushed as git records them, and mount back the same", () => {
    const { f, root, push } = mounted(richSeed());
    const bin = Buffer.from([0x00, 0xff, 0x80, 0xfe, 0x0a]);
    writeFileSync(join(root, "todos/new.bin"), bin);
    writeFileSync(join(root, "todos/run.sh"), "#!/bin/sh\n");
    chmodSync(join(root, "todos/run.sh"), 0o755);
    symlinkSync("a.md", join(root, "todos/link.md"));
    expect(push().state).toBe("pushed");

    expect(f.remoteFile("todos/new.bin")?.equals(bin)).toBe(true);
    expect(f.remoteMode("todos/run.sh")).toBe("100755");
    expect(f.remoteMode("todos/link.md")).toBe("120000");
    expect(f.remoteFile("todos/link.md")?.toString()).toBe("a.md");

    // A second container reads back exactly what was pushed.
    const b = f.checkout("b");
    expect(mountState({ repoRoot: b.root, store: b.store }).state).toBe("mounted");
    expect(readFileSync(join(b.root, "todos/new.bin")).equals(bin)).toBe(true);
    expect(statSync(join(b.root, "todos/run.sh")).mode & 0o111).not.toBe(0);
    expect(lstatSync(join(b.root, "todos/link.md")).isSymbolicLink()).toBe(true);
    expect(readlinkSync(join(b.root, "todos/link.md"))).toBe("a.md");
    expect(readFileSync(join(b.root, "todos/doc.pdf")).equals(PDF)).toBe(true);
  });
});

describe("arguments it does not understand stop it before it pushes", () => {
  // 2026-10-09: `state:push --help` pushed the whole fsh-guts mount, because
  // `--help` was ignored rather than refused.
  test("an unknown flag is refused", () => {
    expect(unknownArgs(["--help"])).toEqual(["--help"]);
    expect(unknownArgs(["--id", "fsh-guts", "--force"])).toEqual(["--force"]);
  });
  test("the flags it knows pass, with their values", () => {
    expect(unknownArgs(["--id", "fsh-guts", "-m", "a message", "--dry-run", "--json"])).toEqual([]);
    expect(unknownArgs([])).toEqual([]);
  });
  test("a valued flag with no value is refused, not read as the next flag", () => {
    expect(unknownArgs(["-m"])).toEqual(["-m (needs a value)"]);
    expect(unknownArgs(["--id", "--dry-run"])).toEqual(["--id (needs a value)"]);
  });
});
