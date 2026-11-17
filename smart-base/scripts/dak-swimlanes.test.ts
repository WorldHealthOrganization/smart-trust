import { describe, expect, test } from "bun:test";
import { crosswalk, lanesFrom, personaAnchor, personasFrom, personasMarkdown, processesFrom, processesMarkdown, resolveLane, swimlaneQa, type SwimlaneMap } from "./dak-swimlanes";

const map: SwimlaneMap = {
  $schema: "dak-swimlanes/v1",
  annexOf: "10665/380303",
  label: "Web Annex B",
  section: "dak#generic-business-processes-and-workflows",
  personas: { "Health worker (HW)": ["Health worker", "HW"], "Community health worker": ["CHW"], Client: [], Caregiver: [] },
  notPersonas: { Function: "header lane", "Vaccination location": "a pool", Community: "a pool" },
};

const personasPage = "<table><tbody>\n<tr>\n<td>Health worker (HW)</td><td>x</td></tr>\n<tr>\n<td>Community health worker</td></tr>\n<tr>\n<td>Client</td></tr>\n<tr>\n<td>Caregiver</td></tr></tbody></table>";
const processesPage = [
  "#### Overview",
  "####  A.  Register  ",
  '<img src="a.svg" />',
  "####  F .  Trace  ",
  '<img src="f.svg" />',
].join("\n");
const svg = (...lanes: string[]) => lanes.map((l) => `<v:ud v:nameU="visHeadingText" v:prompt="" v:val="VT4(${l})" />`).join("\n");
const figures: Record<string, string> = { "a.svg": svg("Function", "Vaccination location\nHealth worker", "Client", "Client"), "f.svg": svg("Community\nCHW", "PCPOSS") };

describe("dak-swimlanes", () => {
  test("readsPersonasProcessesAndLaneTitles", () => {
    expect(personasFrom(personasPage)).toEqual(["Health worker (HW)", "Community health worker", "Client", "Caregiver"]);
    const p = processesFrom(processesPage);
    expect(p.map((x) => [x.letter, x.name, x.anchor, x.figure])).toEqual([
      ["A", "Register", "a--register", "a.svg"],
      ["F", "Trace", "f---trace", "f.svg"],
    ]);
    expect(lanesFrom(figures["a.svg"]!)).toContain("Vaccination location Health worker");
  });

  test("resolvesLaneThroughAliases", () => {
    expect(resolveLane("Vaccination location Health worker", map)).toEqual({ personas: ["Health worker (HW)"], rest: "" });
    expect(resolveLane("Community CHW", map)).toEqual({ personas: ["Community health worker"], rest: "" });
    expect(resolveLane("PCPOSS", map)).toEqual({ personas: [], rest: "PCPOSS" });
  });

  test("crosswalkLinksBothWaysQaNamesGaps", () => {
    const personas = personasFrom(personasPage);
    const cw = crosswalk(personas, processesFrom(processesPage), (f) => lanesFrom(figures[f] ?? ""), map);
    // Client appears twice in a.svg and is one row.
    expect(cw.rows.filter((r) => r.lane === "Client").length).toBe(1);
    const pm = personasMarkdown(personas, cw, "bp.html");
    expect(pm).toContain(`<span id="${personaAnchor("Health worker (HW)")}"></span>Health worker (HW) | [A. Register](bp.html#a--register)`);
    expect(pm).toContain("Caregiver | _no swimlane in any process_");
    const qm = processesMarkdown(cw, map, "p.html");
    expect(qm).toContain("[Community health worker](p.html#persona-community-health-worker)");
    expect(qm).toContain("**not a declared persona:** PCPOSS");
    const qa = swimlaneQa("ig", { script: "s", script_hash: "h" }, personas, cw);
    expect(qa.families["persona-without-swimlane"].entries).toEqual([{ persona: "Caregiver" }]);
    expect(qa.families["swimlane-without-persona"].count).toBe(1);
    expect(qa.total).toBe(2);
  });
});
