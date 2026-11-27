/**
 * A word diff small enough to ship inside a static page.
 *
 * About forty lines instead of a diff-library dependency: the classic LCS over
 * word tokens, with the common prefix and suffix trimmed first, so a one-word
 * edit in a long paragraph costs almost nothing.
 *
 * It is ONE self-contained function on purpose: `gen-review-page` embeds it in
 * the page with `wordDiff.toString()`, so the function the tests exercise is
 * byte for byte the one the reviewer's browser runs.
 *
 * Tokens keep their whitespace, so joining the tokens of either side gives
 * that side back exactly.
 *
 * Too large a table (more than `limit` cells after trimming) returns `null`,
 * and the caller SAYS the block is too long for a word diff rather than
 * freezing the tab.
 */
export type DiffOp = { op: "same" | "ins" | "del"; text: string };

export function wordDiff(a: string, b: string, limit = 4_000_000): DiffOp[] | null {
  const tok = (s: string) => s.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) || [];
  const x = tok(a);
  const y = tok(b);
  let pre = 0;
  while (pre < x.length && pre < y.length && x[pre] === y[pre]) pre++;
  let suf = 0;
  while (suf < x.length - pre && suf < y.length - pre && x[x.length - 1 - suf] === y[y.length - 1 - suf]) suf++;
  const xs = x.slice(pre, x.length - suf);
  const ys = y.slice(pre, y.length - suf);
  const n = xs.length;
  const m = ys.length;
  if ((n + 1) * (m + 1) > limit) return null;
  const w = m + 1;
  const dp = new Int32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i * w + j] = xs[i] === ys[j] ? dp[(i + 1) * w + j + 1]! + 1 : Math.max(dp[(i + 1) * w + j]!, dp[i * w + j + 1]!);
  const out: DiffOp[] = [];
  const push = (op: DiffOp["op"], t: string) => {
    const last = out[out.length - 1];
    if (last && last.op === op) last.text += t;
    else out.push({ op, text: t });
  };
  if (pre) push("same", x.slice(0, pre).join(""));
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (xs[i] === ys[j]) { push("same", xs[i]!); i++; j++; }
    else if (dp[(i + 1) * w + j]! >= dp[i * w + j + 1]!) { push("del", xs[i]!); i++; }
    else { push("ins", ys[j]!); j++; }
  }
  while (i < n) push("del", xs[i++]!);
  while (j < m) push("ins", ys[j++]!);
  if (suf) push("same", x.slice(x.length - suf).join(""));
  return out;
}
