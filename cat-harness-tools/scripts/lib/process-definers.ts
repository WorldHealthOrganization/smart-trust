/**
 * process-definers — which `.bpmn` a call or sibling link means when more than
 * one diagram in the checkout defines the called process id.
 *
 * @module scripts/lib/process-definers
 * @graphNode none — a pure helper of `render-bpmn.ts`
 *
 * A composed checkout holds several layers, and two of them may each define a
 * process with the same id (2026-11-13: a content layer's
 * `content-lifecycle.bpmn` and an upstream IG's `SGAuthoring.DAKLifecycle.bpmn`
 * both defined `Process_Publication`). A single id → file map is last-wins, so
 * whichever file was read last took every link, a referrer's own sibling link
 * was dropped, and its committed drawing read as stale.
 *
 * The rule, deterministic and independent of read order: a link from a
 * referring diagram resolves to the definer NEAREST it by path — the one whose
 * directory shares the most leading path segments with the referrer's
 * directory, so the same directory wins over any other. Ties (two definers
 * equally near, e.g. both in another layer) fall back to the lexicographically
 * first path, so the answer never depends on the order the files were found.
 */
import { dirname, sep } from "node:path";

/** Every definer of each process id: id → absolute paths, sorted. */
export function processDefiners(defs: Iterable<[file: string, ids: string[]]>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [file, ids] of defs) {
    for (const id of ids) {
      const list = out.get(id) ?? [];
      if (!list.includes(file)) list.push(file);
      out.set(id, list);
    }
  }
  for (const list of out.values()) list.sort();
  return out;
}

/** How many leading directory segments `a` and `b` share. */
function sharedSegments(a: string, b: string): number {
  const x = a.split(sep);
  const y = b.split(sep);
  let n = 0;
  while (n < x.length && n < y.length && x[n] === y[n]) n++;
  return n;
}

/** The definer of `id` a link from `referrer` means, or undefined when none. */
export function nearestDefiner(definers: Map<string, string[]>, id: string, referrer: string): string | undefined {
  const list = definers.get(id);
  if (!list || list.length === 0) return undefined;
  const here = dirname(referrer);
  let best = list[0]!;
  let bestScore = -1;
  for (const f of list) {
    // `list` is sorted, so a strict `>` keeps the lexicographically first on a tie.
    const score = f === referrer ? Infinity : sharedSegments(dirname(f), here);
    if (score > bestScore) {
      best = f;
      bestScore = score;
    }
  }
  return best;
}

/** The id → file map as seen from `referrer`: each id resolved to its nearest definer. */
export function definersFrom(definers: Map<string, string[]>, referrer: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const id of definers.keys()) out.set(id, nearestDefiner(definers, id, referrer)!);
  return out;
}
