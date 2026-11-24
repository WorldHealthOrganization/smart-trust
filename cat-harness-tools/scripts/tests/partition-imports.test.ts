/**
 * `IMPORT_RE` sees every import form this repository actually writes.
 *
 * Bean `q2wn`. The bare side-effect form — `import "./x.js";`, no binding and
 * no `from` — matched neither alternative the regex had, and **every
 * registration edge in this repository is written that way**: a module
 * imported to run its side effect has nothing to bind. So the one mechanism
 * computing this repo's module edges was blind to exactly the class carrying
 * load-time registration.
 *
 * @module scripts/tests/partition-imports
 */
import { describe, expect, test } from "bun:test";

import { extractSpecifiers } from "../partition/engine.ts";

describe("the bare side-effect form, which is how every registration edge is written", () => {
  test("a bare import on its own is an edge", () => {
    expect(extractSpecifiers(`import "./x.js";\n`)).toEqual(["./x.js"]);
  });

  test("a bare import at the very start of a file is an edge", () => {
    // `(?:^|\n)` — the `^` branch, which is a different path from every other
    // case here and the one a file's first line takes.
    expect(extractSpecifiers(`import "./s.js";\nconst x = 1;\n`)).toEqual(["./s.js"]);
  });

  test("A BARE IMPORT FOLLOWED BY A NORMAL ONE YIELDS BOTH", () => {
    // THE case the bean asks for, and the reason the bare alternative is tried
    // FIRST rather than appended. Alternation is left-to-right at each
    // position: with the `from`-scanning alternative first, it starts at the
    // bare import, scans forward into the NEXT statement, finds that one's
    // `from`, and consumes both — so the bare edge stayed missing however the
    // third alternative was written. Measured: appending fixes 2 of the 5
    // failing shapes and leaves 3, of which this is one.
    expect(extractSpecifiers(`import "./a.js";\nimport { x } from "./b.js";\n`)).toEqual([
      "./a.js",
      "./b.js",
    ]);
  });

  test("...and with no semicolon on the bare one, where ASI applies", () => {
    expect(extractSpecifiers(`import "./a.js"\nimport { x } from "./b.js";\n`)).toEqual([
      "./a.js",
      "./b.js",
    ]);
  });

  test("two bare imports before a normal one lose TWO edges, not one", () => {
    // The bean recorded this as a single misattributed neighbour. Measured, it
    // is worse: the forward scan swallows every bare import it crosses, so the
    // loss scales with how many precede the next `from`.
    expect(
      extractSpecifiers(`import "./a.js";\nimport "./b.js";\nimport { x } from "./c.js";\n`),
    ).toEqual(["./a.js", "./b.js", "./c.js"]);
  });
});

describe("every other form still resolves, so the fix only widens", () => {
  test.each([
    ["named", `import { x } from "./b.js";\n`, ["./b.js"]],
    ["two named", `import { x } from "./a.js";\nimport { y } from "./b.js";\n`, ["./a.js", "./b.js"]],
    ["namespace", `import * as z from "./n.js";\n`, ["./n.js"]],
    ["type-only", `import type { T } from "./t.js";\n`, ["./t.js"]],
    ["multiline", `import {\n  a,\n  b,\n} from "./m.js";\n`, ["./m.js"]],
    ["dynamic", `await import("./d.js");\n`, ["./d.js"]],
    ["export-from", `export { a } from "./e.js";\n`, ["./e.js"]],
  ])("%s", (_name, src, want) => {
    expect(extractSpecifiers(src as string)).toEqual(want as string[]);
  });
});

describe("the forward scan does not cross a statement end", () => {
  test("a quoted string in prose after a `;` is not an edge", () => {
    // `[^;]` rather than `[\s\S]` in the scan. A static import statement holds
    // no `;` before its `from`, so this only narrows — and it removed two
    // false edges where the scan crossed into a TEMPLATE LITERAL:
    // `init-folio.ts` writes `import … from "../../schema/builders"` into a
    // GENERATED folio, and the scan attributed that scaffolded import to the
    // platform script that emits it.
    const src = [
      `import { a } from "./real.js";`,
      `const t = \`import { b } from "./generated.js";\`;`,
    ].join("\n");
    expect(extractSpecifiers(src)).toEqual(["./real.js"]);
  });
});

describe("the real corpus — a guard against a regex that matches nothing", () => {
  test("the registration edge this bean is about is extracted", () => {
    // Every assertion above is a literal, so a regex narrowed by a later edit
    // could keep them all passing. This reads the shape off the form the repo
    // actually writes.
    expect(extractSpecifiers(`import "../../schemas/folio-graph-typology.js";\n`)).toEqual([
      "../../schemas/folio-graph-typology.js",
    ]);
  });
});
