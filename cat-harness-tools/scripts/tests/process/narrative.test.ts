/**
 * `<cat-harness.processes:narrative href>`: a business-process task's text
 * lives in the `.md` beside its diagram, one heading per task (owner,
 * 2026-11-01, Q-OB-17 A). The processes viewer shows that section.
 *
 * @module cat-harness-tools/scripts/tests/process/narrative.test
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { narrativeText } from "../../gen-processes-viz.ts";

const MD = `# Apply and be verified

Intro text.

<a name="A.P.Interest"></a>
## Send the Statement of Interest

**[1]** The participant submits its Statement of Interest.

<a name="A.S.Check"></a>
## Validate the data {#check}

**[2]** WHO validates the data.

### Detail

More detail.

## Reject by email

Rejected.
`;

describe("narrativeText", () => {
  const dir = mkdtempSync(join(tmpdir(), "narr-"));
  const diagram = join(dir, "X.bpmn");
  writeFileSync(join(dir, "X.md"), MD);

  test("finds a section by the <a name> anchor before its heading, without the next anchor", () => {
    expect(narrativeText(diagram, "X.md#A.P.Interest")).toBe("**[1]** The participant submits its Statement of Interest.");
  });

  test("keeps sub-headings, stops at the next heading of its level", () => {
    expect(narrativeText(diagram, "X.md#A.S.Check")).toBe("**[2]** WHO validates the data.\n\n### Detail\n\nMore detail.");
  });

  test("also matches a {#id} or the heading's slug", () => {
    expect(narrativeText(diagram, "X.md#check")).toContain("WHO validates");
    expect(narrativeText(diagram, "X.md#reject-by-email")).toBe("Rejected.");
  });

  test("is undefined for a missing file or heading", () => {
    expect(narrativeText(diagram, "Y.md#A.P.Interest")).toBeUndefined();
    expect(narrativeText(diagram, "X.md#nope")).toBeUndefined();
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));
});
