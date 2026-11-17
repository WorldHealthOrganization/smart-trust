#!/usr/bin/env bun
/**
 * `bun run cat tools:remedy <host | URL | error text>` — what to reach for when a
 * network host refuses you.
 *
 * It leads from the symptom (a refused host) to the declared Tool that
 * handles it: it reads every declared Tool's `remedies` (schemas/tools/tool.ts,
 * `ToolRemedySchema`) and answers from them, so the answer is the graph's,
 * not a list kept here.
 *
 * Exit 0 when at least one remedy matched (a Tool, or a stated `none`), 1 when
 * nothing declared matches — which is itself worth reporting: that host is
 * reached by no declared Tool, or the Tool reaching it is undeclared.
 *
 * @graphNode script
 */
import { tools } from "../tools/discover.js";
import { remediesFor } from "../schemas/tools/tool.js";

const args = process.argv.slice(2);
const json = args.includes("--json");
const symptom = args.filter((a) => a !== "--json").join(" ").trim();

if (symptom === "" || args.includes("--help")) {
  console.log("Usage: bun run cat tools:remedy <host | URL | error text> [--json]");
  console.log("  e.g. bun run cat tools:remedy packages.fhir.org");
  process.exit(symptom === "" ? 2 : 0);
}

const matches = remediesFor(tools(), symptom);

if (json) {
  console.log(JSON.stringify(matches, null, 2));
} else if (matches.length === 0) {
  console.log(`No declared Tool reaches anything matching "${symptom}".`);
  console.log("Either no declared Tool needs that host, or the Tool that does is not declared —");
  console.log("the second is a finding: add it, with `requires.network` and `remedies`.");
} else {
  // One line per distinct answer, with every Tool that needs the host — the
  // same seeder named four times reads as four different instructions.
  // Workarounds first: they are what the reader came for.
  const groups = new Map<string, { host: string; tool?: string; invoke?: string; none?: string; needed_by: string[] }>();
  for (const m of matches) {
    const key = `${m.host}\u0000${m.tool ?? ""}\u0000${m.none ?? ""}`;
    const g = groups.get(key) ?? { host: m.host, tool: m.tool, invoke: m.invoke, none: m.none, needed_by: [] };
    g.needed_by.push(m.needed_by);
    groups.set(key, g);
  }
  const sorted = [...groups.values()].sort((a, b) => Number(a.tool === undefined) - Number(b.tool === undefined));
  for (const g of sorted) {
    const who = `needed by ${g.needed_by.join(", ")}`;
    if (g.tool !== undefined) {
      console.log(`${g.host} refused → use ${g.tool}   (${who})`);
      if (g.invoke !== undefined) console.log(`    ${g.invoke}`);
    } else {
      console.log(`${g.host} refused → no Tool: ${g.none}   (${who})`);
    }
  }
}
process.exit(matches.length > 0 ? 0 : 1);
