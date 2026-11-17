/**
 * The workshop's gap report (`scripts/journeys/assets/gap-report.js`): the
 * pure summary the discussion page draws from the gap strip's answers in
 * this browser. Owner, 2026-11-06: gaps by urgency (blocks now, then 12
 * months, then can wait), then by module; counts per moment and per module;
 * each row links its moment; print and CSV. Per browser only.
 */
import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";

interface Scale {
  id: string;
  label: string;
  options: { id: string; label: string }[];
}
interface Report {
  gapCount: number;
  gaps: { urgency: string | null; label: string; modules: { module: string | null; title: string; rows: { step: { id: string }; capability: { id: string }; status: string; statusLabel: string; urgencyLabel: string }[] }[] }[];
  perMoment: { step: { id: string }; counts: { total: number; unrated: number; byStatus: Record<string, number> } }[];
  perModule: { module: string | null; title: string; counts: { total: number; unrated: number; byStatus: Record<string, number> } }[];
  totals: { total: number; unrated: number; byStatus: Record<string, number> };
}
const lib = createRequire(import.meta.url)("../journeys/assets/gap-report.js") as {
  summarise: (model: unknown, answer: (name: string) => string | null) => Report;
  csv: (report: Report, base?: string) => string;
};

const status: Scale = { id: "status", label: "Where we stand", options: [{ id: "exists", label: "Exists" }, { id: "partial", label: "Partial" }, { id: "absent", label: "Absent" }] };
const urgency: Scale = { id: "urgency", label: "How urgent", options: [{ id: "now", label: "Blocks us now" }, { id: "12m", label: "Needed within 12 months" }, { id: "wait", label: "Can wait" }] };
const item = (cap: string, step: string, module?: string) => ({
  name: { status: `ws:${cap}:status`, urgency: `ws:${cap}:urgency` },
  capability: { id: cap, label: `Cap ${cap}` },
  step: { id: step, title: `Step ${step}`, href: `../walkthrough/${step}/` },
  ...(module ? { module } : {}),
});
const model = {
  status,
  urgency,
  modules: [
    { id: "M1", title: "Capabilities" },
    { id: "M2", title: "Rights" },
  ],
  items: [item("a", "J1", "M2"), item("b", "J1", "M2"), item("c", "J2", "M1"), item("d", "J2", "M1"), item("e", "J3"), item("f", "J3", "M1")],
};
const answers: Record<string, string> = {
  "ws:a:status": "absent", "ws:a:urgency": "wait",
  "ws:b:status": "exists", "ws:b:urgency": "now", // exists: never a gap, whatever its urgency
  "ws:c:status": "partial", "ws:c:urgency": "now",
  "ws:d:status": "absent", "ws:d:urgency": "12m",
  "ws:e:status": "partial", // urgency not set
  "ws:f:status": "bogus", "ws:f:urgency": "now", // an answer no option names counts as not rated
};
const answer = (k: string): string | null => answers[k] ?? null;

describe("summarise: the gaps, by urgency then module", () => {
  const r = lib.summarise(model, answer);
  test("a gap is a rated capability whose standing is not the first option", () => {
    expect(r.gapCount).toBe(4);
  });
  test("urgency groups in the scale's order, not-set last; modules in the workshop's order, none last", () => {
    expect(r.gaps.map((g) => g.label)).toEqual(["Blocks us now", "Needed within 12 months", "Can wait", "Urgency not set"]);
    expect(r.gaps[0]!.modules.map((m) => [m.module, m.rows.map((x) => x.capability.id)])).toEqual([["M1", ["c"]]]);
    expect(r.gaps[2]!.modules[0]!.title).toBe("Rights");
    expect(r.gaps[3]!.modules[0]).toMatchObject({ module: null, title: "No module" });
    expect(r.gaps[0]!.modules[0]!.rows[0]).toMatchObject({ statusLabel: "Partial", urgencyLabel: "Blocks us now", step: { id: "J2" } });
  });
  test("counts per moment (teaching order) and per module (workshop order), unrated counted apart", () => {
    expect(r.perMoment.map((m) => [m.step.id, m.counts.byStatus, m.counts.unrated])).toEqual([
      ["J1", { exists: 1, partial: 0, absent: 1 }, 0],
      ["J2", { exists: 0, partial: 1, absent: 1 }, 0],
      ["J3", { exists: 0, partial: 1, absent: 0 }, 1],
    ]);
    expect(r.perModule.map((m) => [m.module, m.counts.total, m.counts.unrated])).toEqual([["M1", 3, 1], ["M2", 2, 0], [null, 1, 0]]);
    expect(r.totals).toEqual({ total: 6, unrated: 1, byStatus: { exists: 1, partial: 2, absent: 2 } });
  });
  test("nothing answered: no gaps, every capability unrated", () => {
    const empty = lib.summarise(model, () => null);
    expect(empty.gapCount).toBe(0);
    expect(empty.gaps).toEqual([]);
    expect(empty.totals.unrated).toBe(6);
  });
  test("a workshop with one scale (no urgency): every gap under one group", () => {
    const one = lib.summarise({ ...model, urgency: undefined, items: model.items.map((x) => ({ ...x, name: { status: x.name.status } })) }, answer);
    expect(one.gaps.map((g) => [g.label, g.modules.flatMap((m) => m.rows.map((x) => x.capability.id))])).toEqual([["Urgency not set", ["c", "d", "a", "e"]]]);
  });
});

describe("csv: one row per gap, quoted where needed, links made absolute", () => {
  test("header, order and escaping", () => {
    const r = lib.summarise({ ...model, items: [{ ...item("c", "J2", "M1"), capability: { id: "c", label: 'A "quoted", label' } }] }, answer);
    const lines = lib.csv(r, "https://example.org/site/workshops/w/discuss/").split("\r\n");
    expect(lines[0]).toBe("Urgency,Module,Moment,Moment title,Capability,Where we stand,Link");
    expect(lines[1]).toBe('Blocks us now,M1 Capabilities,J2,Step J2,"A ""quoted"", label",Partial,https://example.org/site/workshops/w/walkthrough/J2/');
    expect(lines[2]).toBe("");
  });
});
