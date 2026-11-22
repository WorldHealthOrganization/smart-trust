/**
 * `split_sections` finds an outline heading on its page by comparing
 * `_match_key`s, so a spacing accent in the text layer ("L¨ubeck") must
 * not hide a heading the outline spells "Lübeck".
 *
 * @module scripts/tests/heading-key
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const SCRIPTS = new URL("..", import.meta.url).pathname;

function py(code: string): unknown {
  const r = Bun.spawnSync(["python3", "-c",
    `import sys, json, importlib.util\nsys.path.insert(0, ${JSON.stringify(SCRIPTS)})\n` +
    `spec = importlib.util.spec_from_file_location("ps", ${JSON.stringify(join(SCRIPTS, "pdf-structure.py"))})\n` +
    `ps = importlib.util.module_from_spec(spec); sys.modules['ps'] = ps; spec.loader.exec_module(ps)\n${code}`]);
  if (r.exitCode !== 0) throw new Error(new TextDecoder().decode(r.stderr));
  return JSON.parse(new TextDecoder().decode(r.stdout));
}

describe("matching outline headings to page lines", () => {
  test("spacing and combining accents compare equal to the composed letter", () => {
    expect(py(`print(json.dumps([ps._match_key(s) for s in ["L\\u00a8ubeck", "L\\u00fcbeck", "Lu\\u0308beck", "  Erd\\u02ddos  "]]))`))
      .toEqual(["lubeck", "lubeck", "lubeck", "erdos"]);
  });

  test("a heading printed with a spacing accent still opens its section", () => {
    const got = py(
      "pages = ['1. Intro\\nbody', '2. Application I\\nmore', '3. Application II: L\\u00a8ubeck formula\\ntext', '4. End\\nfin']\n" +
      "toc = [ps.TocEntry(1, t, p, 'outline', n) for n, t, p in [('1','Intro',1),('2','Application I',2),('3','Application II: L\\u00fcbeck formula',3),('4','End',4)]]\n" +
      "print(json.dumps([[s.title, s.page_start, s.page_end] for s in ps.split_sections(pages, toc)]))",
    );
    expect(got).toEqual([
      ["Intro", 1, 2],
      ["Application I", 2, 3],
      ["Application II: Lübeck formula", 3, 4],
      ["End", 4, 4],
    ]);
  });

  test("an appendix letter on its own line still opens its section", () => {
    const got = py(
      "pages = ['1 Intro\\nbody', 'A\\nProperties of analytic functions\\ntext\\nB.1\\nPolarization\\nmore']\n" +
      "toc = [ps.TocEntry(1, t, p, 'outline', None) for t, p in [('1 Intro',1),('A Properties of analytic functions',2),('B.1 Polarization',2)]]\n" +
      "print(json.dumps([[s.title, s.page_start] for s in ps.split_sections(pages, toc)]))",
    );
    expect(got).toEqual([["1 Intro", 1], ["A Properties of analytic functions", 2], ["B.1 Polarization", 2]]);
  });

  // ant-v14-n7-s p. 302: the heading runs into its paragraph, the math is
  // spaced ("p = 3" for the outline's "p=3"), and with a longer paragraph the
  // line passes the 120-character guard of the ordinary rule.
  const RUN_IN = "3C1. Lie type in cross-characteristic for p = 3. In this section, we prove Theorem 3.7 for groups of Lie type defined in characteristic different from 3, which is the harder case.";

  test("a run-in heading longer than 120 characters still opens its section", () => {
    const got = py(
      `pages = ['3C. The case p = 3\\nintro', 'text\\n${RUN_IN}\\nmore', '3C2. Lie type in defining characteristic for p = 3\\nfin']\n` +
      "toc = [ps.TocEntry(3, t, p, 'outline', None) for t, p in [('3C. The case p=3',1),('3C1. Lie type in cross-characteristic for p=3',2),('3C2. Lie type in defining characteristic for p=3',3)]]\n" +
      "print(json.dumps([len(pages[1].splitlines()[1]), [[s.title, s.page_start] for s in ps.split_sections(pages, toc)]]))",
    );
    expect(got).toEqual([RUN_IN.length, [
      ["3C. The case p=3", 1],
      ["3C1. Lie type in cross-characteristic for p=3", 2],
      ["3C2. Lie type in defining characteristic for p=3", 3],
    ]]);
    expect(RUN_IN.length).toBeGreaterThan(120);
  });

  test("a long line that only MENTIONS a title mid-sentence is not a heading", () => {
    const mention = "As explained in the discussion preceding 3C1. Lie type in cross-characteristic for p = 3, we may assume that the group is simple and of Lie type throughout.";
    const got = py(
      `pages = ['${mention}\\nbody text']\n` +
      "e = ps.TocEntry(4, '3C1. Lie type in cross-characteristic for p=3', 1, 'outline', None)\n" +
      "print(json.dumps(ps.locate_heading(pages, e)))",
    );
    expect(mention.length).toBeGreaterThan(120);
    expect(got).toBeNull();
  });

  test("a run-in prefix must end at a boundary, not inside a longer token", () => {
    const got = py(
      "pages = ['3C1. Lie type in cross-characteristic for p = 31 and every larger prime the argument of Section 2 applies verbatim to the groups considered here.']\n" +
      "e = ps.TocEntry(4, '3C1. Lie type in cross-characteristic for p=3', 1, 'outline', None)\n" +
      "print(json.dumps(ps.locate_heading(pages, e)))",
    );
    expect(got).toBeNull();
  });

  test("an unlabelled title gets no run-in match", () => {
    const got = py(
      "pages = ['Introduction of the auxiliary operator below is what makes the estimate work, and we use it throughout the remainder of this paper without further comment.']\n" +
      "e = ps.TocEntry(1, 'Introduction', 1, 'outline', None)\n" +
      "print(json.dumps(ps.locate_heading(pages, e)))",
    );
    expect(got).toBeNull();
  });
});
