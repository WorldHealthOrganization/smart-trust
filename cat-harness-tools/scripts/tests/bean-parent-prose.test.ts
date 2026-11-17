/**
 * `check:bean-parent-prose` — does a bean's body name a parent its front matter
 * does not carry?
 *
 * Bean `tlj9`. `4ccr`'s body said *"It belongs to the rendered-surface stream,
 * `folio-assistant-10uc`"* while its front matter carried no `parent`, so every
 * consumer that walks `parent` omitted the epic and its 23 open descendants from
 * GOAL 2 — 24 open items including `ob3m`, the navbar findings that prompted the
 * session which found it.
 *
 * ## What these tests hold
 *
 * **The scope is justified by a RATIO, and the ratio is asserted.** Bean bodies
 * cross-reference each other constantly, so a loose detector would fire across a
 * fifth of the store. The report prints `N of M` placement claims against id
 * mentions, and a test fails if the placement count ever approaches the mention
 * count — that is the signal the phrase set has stopped discriminating, and the
 * response is to narrow it rather than accept the findings.
 *
 * **Quotations are not claims.** `tlj9`'s own body quotes `4ccr`'s sentence as
 * evidence. Without the blockquote skip the bean that reports the defect reports
 * itself, and the candidate set is 2 rather than 1. A test pins the skip.
 *
 * **An empty domain is not a clean sweep.** With `4ccr`'s prose corrected there
 * are zero placement claims, so the check compares nothing. It still exits 0 —
 * no bean asserting a placement is a fine state — but it must SAY so, the same
 * distinction `check:instance-themes` draws.
 *
 * **One reader of the store.** It uses `readBeans`, whose `beansIn` is
 * deliberately non-recursive so `beans/defs/archive/` (631 terminal beans with
 * its own declaration and reader) does not fold into the count. A hand-rolled
 * directory walk here would have swept them in — and `check-bean-parents.ts`'s
 * own import comment records that every other script had grown its own parser
 * before that was consolidated.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO = resolve(import.meta.dir, "..", "..", "..");
const SCRIPT = join("cat-harness-tools", "scripts", "check-bean-parent-prose.ts");
const SOURCE = join(REPO, "cat-harness-tools", "scripts", "check-bean-parent-prose.ts");

function run(...args: string[]): { status: number; out: string } {
  const r = spawnSync("bun", ["run", SCRIPT, ...args], { cwd: REPO, encoding: "utf-8" });
  return { status: r.status ?? -1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

/** `N of M` for a printed row. */
function ratio(out: string, label: RegExp): [number, number] {
  const m = out.match(new RegExp(`${label.source}\\s+(\\d+) of (\\d+)`));
  expect(m).not.toBeNull();
  return [Number(m![1]), Number(m![2])];
}

describe("the store is clean as committed", () => {
  test("`--check` passes", () => {
    const { status, out } = run("--check");
    expect(out).toContain("beans read");
    expect(status).toBe(0);
  });
});

describe("the scope is justified by a measured ratio", () => {
  test("placement claims are a tiny fraction of id mentions", () => {
    const { out } = run();
    const [claims, mentions] = ratio(out, /\.\.\.in a PLACEMENT phrase/);
    expect(mentions).toBeGreaterThan(100); // bodies really do cross-reference
    // The whole argument for this phrase set. If placement claims ever reach a
    // tenth of all mentions the set has stopped discriminating and its findings
    // should not be trusted — narrow the phrases, do not accept the noise.
    expect(claims * 10).toBeLessThan(mentions + 10);
  });

  test("the bodies-with-ids row carries its denominator", () => {
    const [withIds, beans] = ratio(run().out, /\.\.\.naming any bean id/);
    expect(beans).toBeGreaterThan(withIds);
    expect(withIds).toBeGreaterThan(0);
  });
});

describe("an empty domain says so", () => {
  test("zero placement claims is reported as a determined empty, not a pass", () => {
    const { out, status } = run();
    const [claims] = ratio(out, /\.\.\.in a PLACEMENT phrase/);
    if (claims === 0) {
      expect(out).toContain("determined empty rather than a clean sweep");
      expect(out).not.toContain("✓ no drift");
    } else {
      expect(out).toContain("✓ no drift");
    }
    expect(status).toBe(0);
  });
});

describe("quotations are not claims", () => {
  test("blockquote and fenced lines are dropped before matching", () => {
    // The live case is `tlj9`, which quotes `4ccr`'s sentence. Asserted on the
    // source rather than by planting, because the plant would have to edit a
    // bean and this is the invariant, not the layer.
    const src = readFileSync(SOURCE, "utf-8");
    expect(src).toContain("assertedProse");
    expect(src).toMatch(/\/\^\\s\*>\//); // the blockquote guard
    expect(src).toMatch(/\/\^\\s\*```\//); // the fence guard
  });
});

describe("one reader of the store", () => {
  test("it uses `readBeans` rather than walking the directory", () => {
    const src = readFileSync(SOURCE, "utf-8");
    expect(src).toMatch(/import \{ readBeans \} from "\.\/beans\.ts"/);
    // A directory walk here would sweep in `beans/defs/archive/`, which has its
    // own declaration and its own reader.
    expect(src).not.toContain("readdirSync");
  });

  test("a store it cannot open refuses rather than reporting no drift", () => {
    const src = readFileSync(SOURCE, "utf-8");
    expect(src).toContain("no bean-defs node declared");
    expect(src).toContain("rather than reporting no drift");
  });
});
