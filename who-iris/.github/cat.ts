#!/usr/bin/env bun
/**
 * `bun run cat <name> [args…]` on a checkout whose layers are not mounted yet.
 *
 * The root's `cat` script is `bun .github/cat.ts`. The runner it hands over
 * to, `cat-harness-tools/scripts/run-script.ts`, is itself one of the mounts,
 * so on a fresh clone it is not on disk. This file breaks that loop: when the
 * runner is missing it runs `.github/mount-from-lock.sh` (which fetches the
 * replayer at the commit `index.lock.json` pins and verifies every tree
 * digest), then runs the runner with the same arguments. A root with a
 * `package.json` and no `node_modules/` gets one `bun install` first. When
 * both are already there it only hands over, so the cost is two `existsSync`.
 *
 * Written into each downstream root by `instantiate-harness.ts` from
 * `cat-harness-tools/templates/root-bootstrap/`. Imports only `node:*`.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const runner = join(root, "cat-harness-tools", "scripts", "run-script.ts");

if (!existsSync(runner)) {
  console.error("cat: the layers are not mounted yet; mounting them from index.lock.json first");
  // stdout goes to stderr too, so a caller that reads `bun run cat …` output sees only the script's.
  const m = spawnSync("bash", [join(root, ".github", "mount-from-lock.sh"), "--root", root], { cwd: root, stdio: ["ignore", 2, 2] });
  if (m.status !== 0 || !existsSync(runner)) {
    console.error(`cat: mounting failed (exit ${m.status ?? m.signal}); run \`bash .github/mount-from-lock.sh\` to see why`);
    process.exit(m.status || 2);
  }
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
