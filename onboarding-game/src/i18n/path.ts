/**
 * Transcript-style paths into the scenario: `soi.choices.email.text`, `letter.checklist.items[3].text`,
 * `soi.docs[0].lines[1]`, `certs.checks[reuse].fix`. The first segment is a moment id.
 * Arrays are addressed by index, or by `id` (choices) or `flag` (checks).
 * Shared by the runtime overlay and scripts/import-fr.mjs.
 */
export function parsePath(path: string): string[] {
  return [...path.matchAll(/[^.[\]]+/g)].map(m => m[0]);
}

type Obj = Record<string, unknown> | unknown[];

function step(cur: unknown, tok: string): unknown {
  if (cur == null) return undefined;
  if (Array.isArray(cur)) {
    if (/^\d+$/.test(tok)) return cur[Number(tok)];
    return cur.find(x => x && typeof x === 'object' && ((x as { id?: string }).id === tok || (x as { flag?: string }).flag === tok));
  }
  return typeof cur === 'object' ? (cur as Record<string, unknown>)[tok] : undefined;
}

/** The value at a path below one moment (segments after the moment id), or undefined. */
export function getIn(root: unknown, segs: string[]): unknown {
  let cur = root;
  for (const s of segs) cur = step(cur, s);
  return cur;
}

/** Replace a string at a path below one moment. Returns false when the path does not exist. */
export function setIn(root: unknown, segs: string[], value: string): boolean {
  const parent = getIn(root, segs.slice(0, -1)) as Obj | undefined;
  const last = segs[segs.length - 1];
  if (!parent || typeof parent !== 'object') return false;
  if (Array.isArray(parent)) {
    const i = /^\d+$/.test(last) ? Number(last) : parent.findIndex(x => (x as { id?: string; flag?: string })?.id === last || (x as { flag?: string })?.flag === last);
    if (i < 0 || typeof parent[i] !== 'string') return false;
    parent[i] = value;
    return true;
  }
  if (typeof (parent as Record<string, unknown>)[last] !== 'string') return false;
  (parent as Record<string, unknown>)[last] = value;
  return true;
}
