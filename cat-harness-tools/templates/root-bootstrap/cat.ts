#!/usr/bin/env bun
/**
 * `bun run cat <name> [args…]` on a checkout whose layers are not mounted yet.
 *
 * The root's `cat` script is `bun .github/cat.ts`. The runner it hands over
 * to, `cat-harness-tools/scripts/run-script.ts`, is itself one of the mounts,
 * so on a fresh clone it is not on disk. This file breaks that loop: when the
 * runner is missing it runs `.github/mount-from-lock.sh` (which fetches the
 * replayer at the commit `index.lock.json` pins and verifies every tree
 * digest), then runs the runner with the same arguments. When the runner is
 * there but `index.lock.json` has moved since the last full replay (a re-pin
 * came in with `git pull`), it replays first too. A root with a
 * `package.json` and no `node_modules/` gets one `bun install` first. When
 * all is current it only hands over: two `existsSync`, one `git rev-parse`
 * and one hash of the lock.
 *
 * Written into each downstream root by `instantiate-harness.ts` from
 * `cat-harness-tools/templates/root-bootstrap/`. Imports only `node:*`.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const runner = join(root, "cat-harness-tools", "scripts", "run-script.ts");
const lock = join(root, "index.lock.json");

/** Replay the lock; stdout goes to stderr, so a caller that reads `bun run cat …` output sees only the script's. */
const replay = () => spawnSync("bash", [join(root, ".github", "mount-from-lock.sh"), "--root", root], { cwd: root, stdio: ["ignore", 2, 2] });

/**
 * Has `index.lock.json` changed since the mounts on disk were laid down?
 * `mount-from-lock.sh` stamps the lock's hash in the git dir after each full
 * replay, so a re-pin pulled in by `git pull` reads as stale here and is
 * replayed, rather than run on the older layers it replaces (smart-ra#236:
 * an older index-config schema refused a key the new lock's layers accept).
 * Not a git checkout, no lock, or `CAT_NO_REMOUNT=1` (someone working inside a
 * mount): never stale.
 */
function lockMoved(): boolean {
  if (process.env.CAT_NO_REMOUNT === "1" || !existsSync(lock)) return false;
  const g = spawnSync("git", ["rev-parse", "--git-path", "cat-mounted-lock"], { cwd: root, encoding: "utf-8" });
  if (g.status !== 0) return false;
  const stamp = resolve(root, g.stdout.trim());
  const now = createHash("sha256").update(readFileSync(lock)).digest("hex");
  return !existsSync(stamp) || readFileSync(stamp, "utf-8").trim() !== now;
}

if (!existsSync(runner)) {
  console.error("cat: the layers are not mounted yet; mounting them from index.lock.json first");
  const m = replay();
  if (m.status !== 0 || !existsSync(runner)) {
    console.error(`cat: mounting failed (exit ${m.status ?? m.signal}); run \`bash .github/mount-from-lock.sh\` to see why`);
    process.exit(m.status || 2);
  }
} else if (lockMoved()) {
  console.error("cat: index.lock.json changed since the layers were mounted here; re-mounting them from it first");
  const m = replay();
  // A mount someone edited is refused, never overwritten: say so and run on what is there.
  if (m.status !== 0) console.error(`cat: re-mounting did not finish (exit ${m.status ?? m.signal}); running on the layers already on disk. Run \`bash .github/mount-from-lock.sh\` to see why, or set CAT_NO_REMOUNT=1 to skip this check`);
}

// The root's own dependencies (its workspaces and libraries), once: the same
// `[ -d node_modules ] || bun install --frozen-lockfile` the session-start hooks run.
if (existsSync(join(root, "package.json")) && !existsSync(join(root, "node_modules"))) {
  const frozen = existsSync(join(root, "bun.lock")) ? ["--frozen-lockfile"] : [];
  const i = spawnSync(process.execPath, ["install", ...frozen], { cwd: root, stdio: ["ignore", 2, 2] });
  if (i.status !== 0) {
    console.error(`cat: \`bun install\` at the root failed (exit ${i.status ?? i.signal})`);
    process.exit(i.status || 2);
  }
}

const r = spawnSync(process.execPath, [runner, ...process.argv.slice(2)], { cwd: root, stdio: "inherit" });
process.exit(r.status ?? 1);
