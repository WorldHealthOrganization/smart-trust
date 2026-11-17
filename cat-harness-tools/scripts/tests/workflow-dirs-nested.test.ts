import { describe, expect, test } from "bun:test";
import { outermostDirs } from "../known-skills.ts";

/**
 * `workflowDirs` hands every caller directories it walks recursively, so a
 * directory inside another one in the list is a second route to the same
 * diagrams. folio-assistant main after #3119: smart-base's opt-in `L2/` (no
 * `processes/`, pushed whole) and `L2/collab/processes/` (declared in its own
 * right) gave 207 duplicate KG nodes and `slice:sqlite` failed on a UNIQUE IRI.
 */
describe("outermostDirs", () => {
  test("drops a directory nested inside another in the list", () => {
    expect(outermostDirs(["/r/smart-base/L2", "/r/smart-base/L2/collab/processes"])).toEqual(["/r/smart-base/L2"]);
    expect(outermostDirs(["/r/smart-base/L2/collab/processes", "/r/smart-base/L2"])).toEqual(["/r/smart-base/L2"]);
  });

  test("drops identical directories, as before", () => {
    expect(outermostDirs(["/r/a/processes", "/r/a/processes", "/r/a/processes/"])).toEqual(["/r/a/processes"]);
  });

  test("keeps siblings and directories that only share a name prefix", () => {
    expect(outermostDirs(["/r/smart-base/L2", "/r/smart-base/L2-bpmn", "/r/smart-base/L3/collab/processes"])).toEqual([
      "/r/smart-base/L2",
      "/r/smart-base/L2-bpmn",
      "/r/smart-base/L3/collab/processes",
    ]);
  });
});
