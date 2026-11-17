/**
 * Run a build step from a test hook, bounded, and leave nothing running.
 *
 * A hook that spawns a writer (`bun run cat <writer>`) starts a TREE of
 * processes: `bun run` → `run-script.ts` → `bun run <script>` → the writer
 * and whatever it spawns. `spawnSync`'s own `timeout` kills only the direct
 * child, so on a timeout the rest of the tree is reparented and keeps running
 * and writing into the checkout after the hook, and the suite, have moved on
 * (measured 2026-10-15: `sh -c "sleep 30 & sleep 30"` under a 1.5 s timeout
 * left both sleeps alive). So the child is started as the leader of its own
 * process group, and on any exit by signal or timeout the whole group is
 * killed.
 *
 * The budget is the caller's hook budget less a margin, so the hook reports
 * the step's own failure rather than "(unnamed) a beforeAll hook timed out".
 */
import { spawnSync, type SpawnSyncOptionsWithStringEncoding, type SpawnSyncReturns } from "node:child_process";

/** Margin left for the hook itself after the step's budget. */
export const HOOK_MARGIN_MS = 5_000;

export function spawnBounded(argv: readonly string[], cwd: string, hookBudgetMs: number): SpawnSyncReturns<string> & { timedOut: boolean } {
  // `detached` is honoured by spawnSync at runtime (Node's and Bun's both pass
  // it to the spawn: the child gets its own process group, probed above) but
  // is absent from @types/node's SpawnSyncOptions, so it is added outside the
  // literal rather than cast away.
  const opts: SpawnSyncOptionsWithStringEncoding = {
    cwd,
    encoding: "utf8",
    timeout: Math.max(1_000, hookBudgetMs - HOOK_MARGIN_MS),
    killSignal: "SIGKILL",
  };
  Object.assign(opts, { detached: true });
  const r = spawnSync(argv[0]!, argv.slice(1), opts);
  const timedOut = (r.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT";
  if (r.pid !== undefined && r.pid > 0 && (timedOut || r.signal !== null)) {
    try {
      process.kill(-r.pid, "SIGKILL");
    } catch {
      // ESRCH: the group is already gone.
    }
  }
  return Object.assign(r, { timedOut });
}
