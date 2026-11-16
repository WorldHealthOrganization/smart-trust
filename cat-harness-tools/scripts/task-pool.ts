/**
 * A bounded worker pool for gate and regen runs, so `bun run cat regen` and
 * `bun run cat gates` use every core instead of one `bun` process at a time.
 *
 * @module scripts/task-pool
 * @graphNode none — a scheduling helper for `gates.ts` and `regen-after-merge.ts`
 *
 * ## The one rule that makes concurrency safe here: OUTPUTS, declared
 *
 * Two tasks may run at the same time only when neither can write where the
 * other reads or writes. That is decided from DECLARED paths
 * (`task-io.ts`), never guessed:
 *
 * - a task with `outputs: undefined` (nothing declared) **conflicts with
 *   everything**, so it runs alone;
 * - two declared tasks conflict when one's outputs overlap the other's outputs
 *   or declared inputs ({@link pathsOverlap}).
 *
 * Conflicting tasks also keep their ORIGINAL ORDER: a task is never started
 * ahead of an earlier task it conflicts with. So an undeclared task is a
 * barrier, and the run is serial wherever a declaration is missing.
 *
 * `regen` adds one more rule on top, {@link ReadWriteGate}: its checks are the
 * readers and its writers are serialized against everything, because a writer
 * has no output declaration to be scheduled by.
 *
 * ## Output stays in the original order
 *
 * Results are reported through {@link orderedEmitter}, which holds a finished
 * task's output until every task before it has been printed. The log of a
 * parallel run therefore reads exactly like the serial one, and two runs of the
 * same tree print the same lines in the same order.
 */
import { availableParallelism, cpus } from "node:os";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";

/** The default pool size: one core left for the person (and the other sessions) on the box. */
export function defaultJobs(): number {
  let n: number;
  try {
    n = availableParallelism();
  } catch {
    // input-site: inert #aefe5702 — the default worker count; it changes scheduling, never an answer
    n = cpus().length;
  }
  return Math.max(1, n - 1);
}

/**
 * `--jobs N` / `--jobs=N` / `-j N` from an argv, else the default.
 *
 * A malformed value THROWS rather than falling back: `--jobs abc` silently
 * meaning "the default" would be a flag that appears to work and does not.
 */
export function jobsFromArgv(argv: readonly string[], fallback = defaultJobs()): number {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    let v: string | undefined;
    if (a === "--jobs" || a === "-j") v = argv[i + 1];
    else if (a.startsWith("--jobs=")) v = a.slice("--jobs=".length);
    else continue;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1) throw new Error(`--jobs needs a positive integer, got ${JSON.stringify(v)}`);
    return n;
  }
  return fallback;
}

/** The part of a glob before its first wildcard — the directory it can touch. */
export function staticPrefix(glob: string): string {
  const norm = glob.replace(/^\.\//, "");
  const i = norm.search(/[*?[{]/);
  return i < 0 ? norm : norm.slice(0, i);
}

/**
 * Whether two declared path lists can name a common file.
 *
 * CONSERVATIVE on purpose: two globs are compared by their static prefixes, so
 * `docs/a/*.md` and `docs/**` overlap, and so do `docs/a.md` and `docs/a.md.bak`
 * (one prefix is a prefix of the other). A false "overlap" costs some
 * parallelism; a false "disjoint" would let two writers race, so the error is
 * only ever allowed in the first direction.
 */
export function pathsOverlap(a: readonly string[], b: readonly string[]): boolean {
  for (const x of a) {
    const px = staticPrefix(x);
    for (const y of b) {
      const py = staticPrefix(y);
      if (px.startsWith(py) || py.startsWith(px)) return true;
    }
  }
  return false;
}

/** What the pool needs to know about a task to decide what may run beside it. */
export interface PoolTask<T> {
  /** For messages and tests only. */
  id: string;
  /** Paths the task may write. `undefined` = not declared: the task runs alone. */
  outputs: readonly string[] | undefined;
  /** Paths the task reads, when declared. Used only to keep a reader off a concurrent writer. */
  inputs?: readonly string[] | undefined;
  run: () => Promise<T>;
}

/** Whether `a` and `b` must not run at the same time. Symmetric. */
export function conflicts(
  a: Pick<PoolTask<unknown>, "outputs" | "inputs">,
  b: Pick<PoolTask<unknown>, "outputs" | "inputs">,
): boolean {
  if (a.outputs === undefined || b.outputs === undefined) return true;
  if (pathsOverlap(a.outputs, b.outputs)) return true;
  if (b.inputs !== undefined && pathsOverlap(a.outputs, b.inputs)) return true;
  if (a.inputs !== undefined && pathsOverlap(b.outputs, a.inputs)) return true;
  return false;
}

/**
 * Run `tasks` with at most `jobs` at once, honouring {@link conflicts} and the
 * original order among conflicting tasks. Resolves to the results IN INPUT
 * ORDER. `onDone(i, result)` fires in COMPLETION order — pair it with
 * {@link orderedEmitter} to print in input order.
 *
 * A task that throws rejects the whole run once the tasks already started have
 * settled; nothing new is started after the throw.
 */
export async function runPool<T>(
  tasks: readonly PoolTask<T>[],
  jobs: number,
  onDone?: (index: number, result: T) => void,
): Promise<T[]> {
  const n = tasks.length;
  const results = new Array<T>(n);
  const started = new Array<boolean>(n).fill(false);
  const running = new Set<number>();
  let finished = 0;
  let failure: { error: unknown } | undefined;
  const limit = Math.max(1, Math.floor(jobs));

  return new Promise<T[]>((resolve, reject) => {
    const settleIfDone = (): boolean => {
      if (failure !== undefined && running.size === 0) {
        reject(failure.error);
        return true;
      }
      if (finished === n) {
        resolve(results);
        return true;
      }
      return false;
    };

    const canStart = (i: number): boolean => {
      for (const r of running) if (conflicts(tasks[i]!, tasks[r]!)) return false;
      // Never overtake an earlier task this one conflicts with.
      for (let j = 0; j < i; j++) {
        if (!started[j] && conflicts(tasks[i]!, tasks[j]!)) return false;
      }
      return true;
    };

    const pump = (): void => {
      if (settleIfDone()) return;
      if (failure !== undefined) return;
      for (let i = 0; i < n && running.size < limit; i++) {
        if (started[i] || !canStart(i)) continue;
        started[i] = true;
        running.add(i);
        tasks[i]!
          .run()
          .then(
            (r) => {
              results[i] = r;
              finished++;
              onDone?.(i, r);
            },
            (e: unknown) => {
              failure ??= { error: e };
            },
          )
          .finally(() => {
            running.delete(i);
            pump();
          });
      }
    };
    pump();
  });
}

/**
 * Calls `emit(i, value)` strictly in index order, however the values arrive.
 *
 * `push(i, v)` stores `v` and flushes every consecutive index from the lowest
 * not yet emitted. So a fast task 5 waits silently until 0–4 have printed.
 */
export function orderedEmitter<T>(emit: (index: number, value: T) => void): {
  push: (index: number, value: T) => void;
  /** How many have been emitted so far. */
  emitted: () => number;
} {
  const held = new Map<number, T>();
  let next = 0;
  return {
    push(index, value) {
      held.set(index, value);
      while (held.has(next)) {
        const v = held.get(next)!;
        held.delete(next);
        emit(next, v);
        next++;
      }
    },
    emitted: () => next,
  };
}

/**
 * Readers share; a writer runs with nothing else — the lock `regen` puts
 * round its checks and writers.
 *
 * A check that declares it only reads takes the READ side, so any number run
 * together. A writer takes the WRITE side, which waits until no check is
 * reading and holds new readers back while it waits (writer preference, so a
 * steady stream of checks cannot starve a repair). When several writers wait,
 * the one with the LOWEST index goes first, so writers run in pair order and
 * a run is reproducible.
 */
export class ReadWriteGate {
  private readers = 0;
  private writing = false;
  private waitingWriters: { index: number; go: () => void }[] = [];
  private waitingReaders: (() => void)[] = [];

  async read<T>(fn: () => Promise<T>): Promise<T> {
    while (this.writing || this.waitingWriters.length > 0) {
      await new Promise<void>((go) => this.waitingReaders.push(go));
    }
    this.readers++;
    try {
      return await fn();
    } finally {
      this.readers--;
      this.wake();
    }
  }

  async write<T>(index: number, fn: () => Promise<T>): Promise<T> {
    await new Promise<void>((go) => {
      this.waitingWriters.push({ index, go });
      this.wake();
    });
    try {
      return await fn();
    } finally {
      this.writing = false;
      this.wake();
    }
  }

  private wake(): void {
    if (this.writing || this.readers > 0) return;
    if (this.waitingWriters.length > 0) {
      this.waitingWriters.sort((a, b) => a.index - b.index);
      const next = this.waitingWriters.shift()!;
      this.writing = true;
      next.go();
      return;
    }
    const readers = this.waitingReaders.splice(0);
    for (const go of readers) go();
  }
}

/** Run a command to completion, capturing stdout+stderr interleaved as they arrive. */
export async function runCaptured(
  argv: readonly string[],
  cwd: string,
  env?: Record<string, string | undefined>,
): Promise<{ code: number; output: string; ms: number }> {
  // input-site: inert #c1aef090 — a duration for the log
  const t0 = performance.now();
  // input-site: traced #9cbc2f4e — the gate/regen runner; a check that only imports it does not run commands
  inputSiteReached("task-pool: runCaptured spawns a command");
  const child = Bun.spawn([...argv], { cwd, stdout: "pipe", stderr: "pipe", ...(env ? { env } : {}) });
  const chunks: string[] = [];
  const pump = async (stream: ReadableStream<Uint8Array>): Promise<void> => {
    const decoder = new TextDecoder();
    for await (const chunk of stream) chunks.push(decoder.decode(chunk, { stream: true }));
  };
  await Promise.all([pump(child.stdout), pump(child.stderr)]);
  const code = await child.exited;
  // input-site: inert #81ea4375 — a duration for the log
  return { code, output: chunks.join(""), ms: performance.now() - t0 };
}
