/**
 * The bean reader, and the three things about it that are easy to get wrong.
 *
 * @module scripts/tests/beans
 *
 * Front-matter UNESCAPING, the direction of `blocking:`, and the finding rules
 * computed from it. Each of the three has already been wrong once here: the
 * first shipped `the knowledge graph''s own structure` to a published page,
 * and the other two are the kind of defect that still computes — every finding
 * lands, each one naming the wrong bean.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { repoRootFor } from "../../schemas/kg/cat-harness.ts";
import { beanDefsDir, beanFindings, blockEdges, blockedBy, blocksOf, hasExpiry, isOpen, readArchivedBeans, readBeans, resolveBeanArchive } from "../beans.ts";
import { notApplicableAlone } from "../../test/support/checkout.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

/** A repository-shaped temp dir with a bean store in it. */
function store(beans: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "beans-test-"));
  const defs = join(root, "beans", "defs");
  mkdirSync(defs, { recursive: true });
  writeFileSync(
    join(root, "beans", "beans.json"),
    JSON.stringify({
      name: "t",
      directories: [{ id: "defs", path: "defs", graphTypologies: ["bean-defs"] }],
    }),
  );
  for (const [name, body] of Object.entries(beans)) {
    writeFileSync(join(defs, `${name}.md`), body);
  }
  return root;
}

function bean(id: string, fm: string, body = "Body."): string {
  return `---\n# ${id}\n${fm}\n---\n\n${body}\n`;
}

describe("front matter is unescaped, not merely unquoted", () => {
  test("a YAML single-quoted scalar undoubles its apostrophes", () => {
    const root = store({
      a: bean("t-a", `title: 'KG: the knowledge graph''s own structure'\nstatus: todo\ntype: task`),
    });
    expect(readBeans(root)![0]!.title).toBe("KG: the knowledge graph's own structure");
  });

  test("a double-quoted scalar undoes its backslashes instead", () => {
    const root = store({ a: bean("t-a", `title: "a \\"quoted\\" word"\nstatus: todo\ntype: task`) });
    expect(readBeans(root)![0]!.title).toBe('a "quoted" word');
  });

  test("an unquoted scalar is left exactly as written", () => {
    const root = store({ a: bean("t-a", `title: plain title\nstatus: todo\ntype: task`) });
    expect(readBeans(root)![0]!.title).toBe("plain title");
  });

  test("a lone apostrophe inside an unquoted scalar survives", () => {
    // The naive fix — strip every quote character — eats this one.
    const root = store({ a: bean("t-a", `title: don't strip me\nstatus: todo\ntype: task`) });
    expect(readBeans(root)![0]!.title).toBe("don't strip me");
  });
});

describe("`file` is relative to the root it was read with", () => {
  test("no repository-name prefix, so an edit link resolves", () => {
    // `repoRootFor` is an unconditional `join(root, "..")`. Recomputing it on
    // a root the caller already resolved prefixed every path with the
    // repository's own directory name, and every link built from it pointed
    // one level too high.
    const root = store({ a: bean("t-a", `title: a\nstatus: todo\ntype: task`) });
    expect(readBeans(root)![0]!.file).toBe("beans/defs/a.md");
  });
});

describe("no store is not an empty store", () => {
  test("a repository with no bean graph reads as null", () => {
    const root = mkdtempSync(join(tmpdir(), "beans-empty-"));
    expect(readBeans(root)).toBeNull();
  });

  test("a declared store with no beans in it reads as an empty list", () => {
    expect(readBeans(store({}))).toEqual([]);
  });
});

describe("`blocking:` names the blocked, and sits on the blocker", () => {
  const root = store({
    a: bean("t-a", `title: blocker\nstatus: todo\ntype: task\nblocking:\n    - t-b`),
    b: bean("t-b", `title: blocked\nstatus: todo\ntype: task`),
  });
  const beans = readBeans(root)!;

  test("the sequence is read off the blocker", () => {
    expect(beans.find((x) => x.id === "t-a")!.blocking).toEqual(["t-b"]);
    expect(beans.find((x) => x.id === "t-b")!.blocking).toEqual([]);
  });

  test("blockedBy inverts it, so the blocked bean can name its blocker", () => {
    // Inverting this wrongly is silent: every finding still computes and each
    // one names the wrong bean. That is why the inversion has one home.
    expect(blockedBy(beans).get("t-b")).toEqual(["t-a"]);
    expect(blockedBy(beans).get("t-a")).toBeUndefined();
  });
});

describe("an expiry is prose in the body, not a field", () => {
  const root = store({
    a: bean("t-a", `title: with\nstatus: todo\ntype: task`, "Waiting. **expires**: 2026-10-19."),
    b: bean("t-b", `title: without\nstatus: todo\ntype: task`, "Waiting on the owner."),
  });
  const beans = readBeans(root)!;

  test("it is found wherever in the body it is written", () => {
    expect(hasExpiry(beans.find((x) => x.id === "t-a")!)).toBe(true);
    expect(hasExpiry(beans.find((x) => x.id === "t-b")!)).toBe(false);
  });
});

describe("findings", () => {
  test("a live block with no expiry is reported once per bean it blocks", () => {
    const root = store({
      a: bean("t-a", `title: blocker\nstatus: in-progress\ntype: task\nblocking:\n    - t-b`),
      b: bean("t-b", `title: blocked\nstatus: todo\ntype: task`),
    });
    const f = beanFindings(readBeans(root)!);
    expect(f).toHaveLength(1);
    expect(f[0]!.kind).toBe("blocked-without-expiry");
    expect(f[0]!.bean).toBe("t-a");
    expect(f[0]!.blocks).toBe("t-b");
  });

  test("a live block that STATES an expiry is not reported", () => {
    // Falsification in the other direction: adding the expiry must clear it,
    // or the finding is measuring something else.
    const root = store({
      a: bean("t-a", `title: b\nstatus: in-progress\ntype: task\nblocking:\n    - t-b`,
              "**expires**: 2026-10-19."),
      b: bean("t-b", `title: blocked\nstatus: todo\ntype: task`),
    });
    expect(beanFindings(readBeans(root)!)).toEqual([]);
  });

  test("a live block on a bean that is already CLOSED is not reported", () => {
    // 11 of the 25 "No expiry" rows on 2026-10-16 were this: the blocked bean
    // was completed or scrapped, so the block held nothing up.
    const root = store({
      a: bean("t-a", `title: blocker\nstatus: in-progress\ntype: task\nblocking:\n    - t-b`),
      b: bean("t-b", `title: done\nstatus: completed\ntype: task`),
    });
    expect(beanFindings(readBeans(root)!)).toEqual([]);
  });

  test("a block between two beans under ONE parent is sequencing, and needs no expiry", () => {
    // Owner ruling 2026-10-16: "stage 1b before 1c" is ordering inside one
    // plan. A block across parents still needs one — the falsifying half.
    const root = store({
      e: bean("t-e", `title: epic\nstatus: in-progress\ntype: epic`),
      f: bean("t-f", `title: other epic\nstatus: in-progress\ntype: epic`),
      a: bean("t-a", `title: 1b\nstatus: todo\ntype: task\nparent: t-e\nblocking:\n    - t-b\n    - t-c`),
      b: bean("t-b", `title: 1c\nstatus: todo\ntype: task\nparent: t-e`),
      c: bean("t-c", `title: elsewhere\nstatus: todo\ntype: task\nparent: t-f`),
    });
    const f = beanFindings(readBeans(root)!);
    expect(f.map((x) => [x.kind, x.bean, x.blocks])).toEqual([["blocked-without-expiry", "t-a", "t-c"]]);
  });

  test("a CLOSED blocker holding an OPEN bean is the sharper finding, and only that one", () => {
    const root = store({
      a: bean("t-a", `title: done\nstatus: completed\ntype: task\nblocking:\n    - t-b`),
      b: bean("t-b", `title: blocked\nstatus: in-progress\ntype: task`),
    });
    const f = beanFindings(readBeans(root)!);
    expect(f.map((x) => x.kind)).toEqual(["blocker-closed"]);
  });

  test("a CLOSED blocker holding a DRAFT bean is reported too", () => {
    // `ygzh` (completed) → `18p1` (draft), 2026-10-16: a draft is not counted
    // as open work, and the block on it went unreported for that reason.
    const root = store({
      a: bean("t-a", `title: done\nstatus: completed\ntype: task`),
      b: bean("t-b", `title: drafted\nstatus: draft\ntype: task\nblocked_by:\n    - t-a`),
    });
    const f = beanFindings(readBeans(root)!);
    expect(f.map((x) => [x.kind, x.bean, x.blocks])).toEqual([["blocker-closed", "t-a", "t-b"]]);
    expect(f[0]!.detail).toContain("which is draft");
  });

  test("a DRAFT blocker is not a closed one", () => {
    // The other half of the same mistake: `!isOpen` read a draft blocker as
    // finished, and reported it as a block nobody lifted.
    const root = store({
      a: bean("t-a", `title: drafted\nstatus: draft\ntype: task\nblocking:\n    - t-b`, "**expires**: 2026-10-19."),
      b: bean("t-b", `title: blocked\nstatus: todo\ntype: task`),
    });
    expect(beanFindings(readBeans(root)!).filter((x) => x.kind === "blocker-closed")).toEqual([]);
  });

  test("a closed blocker holding a CLOSED bean is nobody's problem", () => {
    const root = store({
      a: bean("t-a", `title: done\nstatus: completed\ntype: task\nblocking:\n    - t-b`),
      b: bean("t-b", `title: also done\nstatus: completed\ntype: task`),
    });
    expect(beanFindings(readBeans(root)!)).toEqual([]);
  });

  test("blocking a bean that does not exist is its own finding", () => {
    const root = store({
      a: bean("t-a", `title: b\nstatus: todo\ntype: task\nblocking:\n    - t-gone`,
              "**expires**: 2026-10-19."),
    });
    const f = beanFindings(readBeans(root)!);
    expect(f.map((x) => x.kind)).toEqual(["blocking-unknown"]);
  });

  test("nothing time-relative is computed, so the same store gives the same findings", () => {
    // The projection is gated on exact content. A finding that read the clock
    // would change the file on every build and the gate would fire forever.
    const root = store({
      a: bean("t-a", `title: b\nstatus: in-progress\ntype: task\nblocking:\n    - t-b`),
      b: bean("t-b", `title: blocked\nstatus: todo\ntype: task`),
    });
    const beans = readBeans(root)!;
    expect(JSON.stringify(beanFindings(beans))).toBe(JSON.stringify(beanFindings(beans)));
  });
});

describe("isOpen", () => {
  test("todo and in-progress are work; completed and scrapped are history", () => {
    const root = store({
      a: bean("t-a", `title: a\nstatus: todo\ntype: task`),
      b: bean("t-b", `title: b\nstatus: in-progress\ntype: task`),
      c: bean("t-c", `title: c\nstatus: completed\ntype: task`),
      d: bean("t-d", `title: d\nstatus: scrapped\ntype: task`),
    });
    expect(readBeans(root)!.filter(isOpen).map((x) => x.id)).toEqual(["t-a", "t-b"]);
  });
});

describe("ONE edge set over `blocking:` and `blocked_by:` (bean vhqq)", () => {
  const root = store({
    a: bean("t-a", `title: a\nstatus: in-progress\ntype: task\nblocking:\n    - t-b`),
    // Declared from the blocked end only.
    b: bean("t-b", `title: b\nstatus: todo\ntype: task\nblocked_by:\n    - t-c`),
    // Declared from BOTH ends — the pair must appear once, with both keys.
    c: bean("t-c", `title: c\nstatus: todo\ntype: task\nblocking:\n    - t-d`),
    d: bean("t-d", `title: d\nstatus: todo\ntype: task\nblocked_by:\n    - t-c\n    - t-gone`),
  });
  const beans = readBeans(root)!;
  const { edges, dangling } = blockEdges(beans);

  test("both declarations normalise to blocker → blocked, deduplicated", () => {
    expect(edges.map((e) => `${e.blocker}>${e.blocked}`)).toEqual(["t-a>t-b", "t-c>t-b", "t-c>t-d", "t-gone>t-d"]);
    expect(edges.find((e) => e.blocked === "t-d" && e.blocker === "t-c")!.declaredOn).toEqual(["blocked_by", "blocking"]);
  });

  test("blockedBy and blocksOf read the union, not `blocking:` alone", () => {
    expect(blockedBy(beans).get("t-b")).toEqual(["t-a", "t-c"]);
    expect(blocksOf(beans).get("t-c")).toEqual(["t-b", "t-d"]);
  });

  test("a dangling edge is reported, never dropped", () => {
    expect(dangling).toEqual([{ blocker: "t-gone", blocked: "t-d", declaredOn: ["blocked_by"], missing: ["blocker"] }]);
    const f = beanFindings(beans).filter((x) => x.kind === "blocking-unknown");
    expect(f.map((x) => `${x.bean}>${x.blocks}`)).toEqual(["t-gone>t-d"]);
  });

  test("a blocked_by edge's expiry is looked for on the bean that declared it", () => {
    const withExpiry = store({
      b: bean("t-b", `title: b\nstatus: todo\ntype: task\nblocked_by:\n    - t-c`, "**expires**: 2026-11-01."),
      c: bean("t-c", `title: c\nstatus: in-progress\ntype: task`),
    });
    expect(beanFindings(readBeans(withExpiry)!)).toEqual([]);
  });
});

// The bean store is the COMPOSED checkout's, mounted from its state branch:
// cat-harness standing alone has none, so these are not applicable there and
// say so. In the composed checkout they run, and an unmounted store fails them.
const NO_BEAN_STORE = notApplicableAlone(
  "the bean store (`beans/`, kept on its state branch and mounted only in a composed checkout)",
);

describe.skipIf(NO_BEAN_STORE)("the REAL corpus: the edge set is exactly the union of both declarations", () => {
  // Computed WITHOUT readBeans: the front matter is parsed here by its own
  // line walk, so a reader that drops one key cannot agree with itself.
  // Lazily, inside the tests: `describe.skipIf` still runs this body, and an
  // unreadable store must fail a test by name rather than the whole file.
  const repo = repoRootFor(join(HARNESS_ROOT));
  let declaredBlocking = 0;
  let declaredBlockedBy = 0;
  let read: Set<string> | undefined;
  const corpus = (): Set<string> => (read ??= unionOfDeclarations(beanDefsDir(repo)!));
  // The archive view, read the same way: a drain archives most blocked beans
  // with their edges, so the precondition below counts both halves
  // (cat-harness-tools#1248).
  let readArchive: Set<string> | undefined;
  const archiveDir = (): string | null => resolveBeanArchive(repo).dir;
  const archived = (): Set<string> => (readArchive ??= archiveDir() === null ? new Set() : unionOfDeclarations(archiveDir()!));

  function unionOfDeclarations(dir: string): Set<string> {
    const union = new Set<string>();
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".md")) continue;
      const text = readFileSync(join(dir, name), "utf-8");
      const fm = /^---\n([\s\S]*?)\n---/.exec(text)?.[1];
      if (fm === undefined) continue;
      const id = /^#\s*(\S+)/m.exec(fm)?.[1] ?? name.replace(/\.md$/, "");
      const lines = fm.split("\n");
      const list = (key: string): string[] => {
        const at = lines.findIndex((l) => l.startsWith(`${key}:`));
        if (at < 0) return [];
        const out: string[] = [];
        for (const l of lines.slice(at + 1)) {
          const m = /^\s+-\s*['"]?([^'"\s]+)['"]?\s*$/.exec(l);
          if (!m) break;
          out.push(m[1]!);
        }
        return out;
      };
      for (const t of list("blocking")) {
        union.add(`${id}>${t}`);
        declaredBlocking++;
      }
      for (const f of list("blocked_by")) {
        union.add(`${f}>${id}`);
        declaredBlockedBy++;
      }
    }
    return union;
  }

  test("the corpus declares edges from both ends (else this test proves nothing)", () => {
    corpus();
    archived();
    expect(declaredBlocking).toBeGreaterThan(0);
    expect(declaredBlockedBy).toBeGreaterThan(0);
  });

  test("blockEdges(readBeans) has exactly the union's edges", () => {
    const union = corpus();
    const { edges } = blockEdges(readBeans(repo)!);
    expect(edges.length).toBe(union.size);
    expect(new Set(edges.map((e) => `${e.blocker}>${e.blocked}`))).toEqual(union);
  });

  test("...and so does blockEdges(readArchivedBeans) over the archive view", () => {
    const union = archived();
    const { edges } = blockEdges(readArchivedBeans(repo) ?? []);
    expect(edges.length).toBe(union.size);
    expect(new Set(edges.map((e) => `${e.blocker}>${e.blocked}`))).toEqual(union);
  });
});


describe("readBeans skips README.md even when it carries generated YAML front matter", () => {
  test("beans/defs/README.md with a `generated:` fence is not returned as a bean", () => {
    const r = store({
      a: bean("t-a", "title: Real bean\nstatus: todo\ntype: task"),
      README: [
        "---",
        'generated: "cat-harness-tools/scripts/subgraph-readmes.ts — bun run cat readme:subgraphs"',
        "---",
        "",
        "# `beans/defs/`",
      ].join("\n"),
    });
    const got = readBeans(r)!;
    expect(got.map((b) => b.id)).toEqual(["t-a"]);
  });
});
