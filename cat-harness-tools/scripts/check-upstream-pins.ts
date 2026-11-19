#!/usr/bin/env bun
/**
 * Has a pinned upstream dependency fallen behind a release?
 *
 * ```sh
 * bun run cat check:upstream-pins              # table, exit 1 behind / 2 unknown
 * bun run cat check:upstream-pins --markdown   # the tracking issue's body, always exit 0
 * bun run cat check:upstream-pins --out <file> # write the markdown AND keep the exit code
 * ```
 *
 * Runs `git ls-remote --tags` per row: nothing is cloned and no token is
 * needed, so it behaves the same on a laptop and in CI.
 *
 * @module scripts/check-upstream-pins
 */
import { HARNESS_NAME, HARNESS_ROOT, TOOLS_ROOT } from "./lib/roots.ts";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  assessPin,
  exitCode,
  locatePins,
  missingFileVerdict,
  readPin,
  render,
  type LoadedRegistry,
  type PinDef,
  type PinVerdict,
} from "../src/upstream/pins.js";

const argv = process.argv.slice(2);
const markdown = argv.includes("--markdown");
const outIdx = argv.findIndex((a) => a === "--out" || a.startsWith("--out="));
const outFile =
  outIdx === -1
    ? undefined
    : argv[outIdx].startsWith("--out=")
      ? argv[outIdx].slice("--out=".length)
      : argv[outIdx + 1];
if (outIdx !== -1 && !outFile) {
  console.error("--out needs a file path");
  process.exit(2);
}

// Two registries, one per layer that holds a pinned file (folio-assistant#1481).
// The harness's is its declared `upstream/` directory (`cat-harness-upstream`).
// It sat at the repository root until 2026-10-06 (bean `ar1s`, phase 3). This
// layer's is its own `upstream/` (`cat-harness-tools-upstream`), for the pins
// whose files moved up here with bean `70lx`, such as `scripts/pdf-viewer.ts`.
// Each row's `pinnedIn` resolves against the root of the layer that declares
// it. A harness row cannot name a file up here: that is a wrong-direction
// reference.
const sources: { layer: string; root: string }[] = [
  { layer: HARNESS_NAME, root: HARNESS_ROOT },
  { layer: "cat-harness-tools", root: TOOLS_ROOT },
];
const registries: LoadedRegistry[] = [];
for (const { layer, root } of sources) {
  const registryPath = join(root, "upstream", "upstream-pins.json");
  if (!existsSync(registryPath)) {
    // Absent registry is `unknown`, not "nothing to watch". A declaration that
    // vanished looks identical to one that never existed, and this check is the
    // only thing standing between a pin and silent staleness.
    console.error(`upstream-pins.json not found at ${registryPath} — cannot tell whether any pin is stale.`);
    process.exit(2);
  }
  const pins: PinDef[] = JSON.parse(readFileSync(registryPath, "utf8")).pins ?? [];
  registries.push({ layer, root, pins });
}

/** Upstream's tag names, or `undefined` when the remote could not be read. */
function remoteTags(repo: string): string[] | undefined {
  try {
    const out = execFileSync("git", ["ls-remote", "--tags", "--refs", repo], {
      encoding: "utf8",
      timeout: 60_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return out
      .split("\n")
      .map((l) => l.split("refs/tags/")[1]?.trim())
      .filter((t): t is string => Boolean(t));
  } catch {
    return undefined;
  }
}

const verdicts: PinVerdict[] = locatePins(registries, join).map((located) => {
  if (!existsSync(located.file)) return missingFileVerdict(located);
  const pinned = readPin(readFileSync(located.file, "utf8"), located.pin.pattern);
  return assessPin(located.pin, pinned, remoteTags(located.pin.repo));
});

const report = render(verdicts);
if (outFile) writeFileSync(outFile, `${report}\n`);
console.log(report);

const code = exitCode(verdicts);
if (markdown) process.exit(0);
if (code === 2) {
  console.error("\nAt least one pin could NOT be determined. That is not `current`.");
}
process.exit(code);
