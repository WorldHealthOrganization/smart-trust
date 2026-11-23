import { describe, expect, test } from "bun:test";
import { isBeanFile, oneHomeProblems, repoOfUrl, retiredBeanStore } from "../scripts/lib/bean-homes.ts";
import { retiredBeanWrite } from "../scripts/state-push.ts";

describe("bean homes (#459)", () => {
  test("repoOfUrl reads https, ssh and proxy remotes", () => {
    expect(repoOfUrl("https://github.com/litlfred/cat-harness.git")).toBe("litlfred/cat-harness");
    expect(repoOfUrl("git@github.com:litlfred/cat-harness.git")).toBe("litlfred/cat-harness");
    expect(repoOfUrl("http://127.0.0.1:1234/git/litlfred/cat-harness\n")).toBe("litlfred/cat-harness");
  });

  test("only cat-harness's bean branch is retired", () => {
    expect(retiredBeanStore("litlfred/cat-harness", "cat/cat-harness/beans")?.name).toBe("cat-harness");
    expect(retiredBeanStore("litlfred/folio-assistant", "cat/cat-harness/beans")).toBeUndefined();
    expect(retiredBeanStore("litlfred/cat-harness", "cat/cat-harness/todos")).toBeUndefined();
    expect(retiredBeanStore(undefined, "cat/cat-harness/beans")).toBeUndefined();
  });

  test("isBeanFile matches bean files under defs only", () => {
    expect(isBeanFile("beans/defs/folio-assistant-abcd--a-title.md")).toBe(true);
    expect(isBeanFile("beans/defs/archive/folio-assistant-abcd--a-title.md")).toBe(true);
    expect(isBeanFile("beans/defs/README.md")).toBe(false);
    expect(isBeanFile("beans/notes/folio-assistant-abcd--x.md")).toBe(false);
  });

  test("oneHomeProblems flags duplicates and retired-store beans", () => {
    expect(oneHomeProblems({ "folio-assistant": ["a"], "cat-harness-tools": ["b"], "cat-harness": [] })).toEqual([]);
    const p = oneHomeProblems({ "folio-assistant": ["a", "c"], "cat-harness-tools": ["a"], "cat-harness": ["c2"] });
    expect(p).toEqual(["a is in 2 stores: folio-assistant, cat-harness-tools", "c2 is in cat-harness, which keeps no beans any more"]);
  });

  test("state:push refuses bean writes to the retired store but allows deletes", () => {
    const loc = { id: "beans", branch: "cat/cat-harness/beans", repository: "litlfred/cat-harness" };
    const write = [{ path: "beans/defs/folio-assistant-abcd--t.md", content: "x" }];
    expect(retiredBeanWrite("/", loc, write)).toContain("keeps no bean files");
    expect(retiredBeanWrite("/", loc, [{ path: "beans/defs/folio-assistant-abcd--t.md", content: null }])).toBeUndefined();
    expect(retiredBeanWrite("/", loc, [{ path: "beans/notes/n.md", content: "x" }])).toBeUndefined();
    expect(retiredBeanWrite("/", { ...loc, repository: "litlfred/folio-assistant" }, write)).toBeUndefined();
    expect(retiredBeanWrite("/", { ...loc, id: "todos" }, write)).toBeUndefined();
  });
});
