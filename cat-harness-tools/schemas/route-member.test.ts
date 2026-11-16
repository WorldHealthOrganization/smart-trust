/**
 * `RouteMemberSchema` validates UNTRUSTED input, so these are adversarial
 * cases rather than examples.
 *
 * A `route-family` member derives from a branch name, and
 * `.github/workflows/feature-staging.yml` states the consequence in as many
 * words: *"the branch name is ATTACKER-CONTROLLED on a fork PR"*. A member key
 * becomes a path on the published `gh-pages` branch, so a traversal here writes
 * outside the family's prefix — over the published site at `/`, in the worst
 * case. Bean `xp5j`.
 *
 * The schema REFUSES rather than sanitises, and that is the design: a key that
 * had to be cleaned up is a key whose author meant something else, and a
 * sanitiser's output is a value nobody declared.
 */
import { describe, expect, test } from "bun:test";
import { DirectoryStorageSchema } from "./kg/cat-harness.ts";
import { KeyedBySchema, RouteMemberSchema } from "./kg/subgraph-source.ts";

const ok = (m: string) => RouteMemberSchema.safeParse(m).success;

describe("a route-family member is one safe path segment", () => {
  test("ordinary branch-derived slugs pass", () => {
    for (const m of ["claude-xp5j-ref-steward", "main", "pr-2063", "v1.2.3", "a", "A_b-c.d"]) {
      expect(ok(m)).toBe(true);
    }
  });

  test("ONE segment: a slash is refused, which kills traversal in a single rule", () => {
    // The point of refusing `/` outright is that `..`, `//`, absolute paths
    // and deep traversal all stop being separate patterns somebody has to keep
    // complete. These are the cases that rule covers.
    for (const m of [
      "a/b",
      "../etc",
      "..",
      "../../index.html",
      "/absolute",
      "a//b",
      "STAGING/x",
      "x/..",
      "./x",
    ]) {
      expect(ok(m)).toBe(false);
    }
  });

  test("no dot-prefixed segment — the directory-conventions guard", () => {
    for (const m of [".git", ".beans", ".hidden", "..", "."]) {
      expect(ok(m)).toBe(false);
    }
  });

  test("a dash-leading key is refused, so a member cannot be read as a flag", () => {
    // `--force` reaching a git invocation as a path is the shape this stops.
    for (const m of ["-rf", "--force", "-"]) {
      expect(ok(m)).toBe(false);
    }
  });

  test("empty and oversized are refused", () => {
    expect(ok("")).toBe(false);
    expect(ok("a".repeat(100))).toBe(true);
    expect(ok("a".repeat(101))).toBe(false);
  });

  test("characters that mean something to a shell or a URL are refused", () => {
    for (const m of [
      "a b",
      "a;rm",
      "a&b",
      "a|b",
      "a$b",
      "a`b`",
      "a'b",
      'a"b',
      "a>b",
      "a\nb",
      "a\0b",
      "a%2e%2e",
      "a?b",
      "a#b",
      "a:b",
      "a\\b",
    ]) {
      expect(ok(m)).toBe(false);
    }
  });

  test("a dot INSIDE is fine, but never two in a row", () => {
    // `v1.2.3` is a legitimate member; `a..b` is a traversal spelled without
    // slashes, and some path resolvers still collapse it.
    expect(ok("v1.2.3")).toBe(true);
    expect(ok("a..b")).toBe(false);
  });
});

describe("storage on ONE branch is keyed in exactly four ways", () => {
  test("route-family parses, and no fifth keying does", () => {
    const base = { branch: "gh-pages" };
    for (const keyedBy of ["commit", "tip", "route", "route-family"]) {
      expect(DirectoryStorageSchema.safeParse({ ...base, keyedBy }).success).toBe(true);
    }
    // The enum is the whole point: a fifth keying is a schema change somebody
    // has to make, not a string a declaration can invent. `family` IS a fifth
    // value of the enum, but only for a `branchPrefix` (one branch per
    // member, below); on a single `branch` it is refused like the rest.
    for (const keyedBy of ["routes", "family", "route_family", "dynamic", ""]) {
      expect(DirectoryStorageSchema.safeParse({ ...base, keyedBy }).success).toBe(false);
    }
  });

  test("the branch it names is still validated", () => {
    for (const branch of ["refs/heads/gh-pages", "-x", "a..b", "a//b", "gh-pages/", "x.lock", "/abs"]) {
      expect(DirectoryStorageSchema.safeParse({ branch, keyedBy: "route-family" }).success).toBe(false);
    }
  });
});

/**
 * THE DRIFT GUARD, and it exists because this branch caused the defect it
 * guards.
 *
 * Bean `1j3q`: `DirectoryStorageSchema.keyedBy` held its own
 * `z.enum(["commit","tip","route"])` while `KeyedBySchema` in
 * `subgraph-source.ts` is what every consumer parses through. `route` was added
 * to the first and not the second, so a route-keyed declaration PARSED and then
 * threw a ZodError inside `resolveSubgraphSource`. Main fixed it by importing
 * the one enum, with the rule: *a schema change somebody has to make is only a
 * guard if there is ONE schema to change.*
 *
 * This branch then added `route-family` to the copy in `cat-harness.ts` —
 * reproducing `1j3q` one keying later, accepted by the declaration and rejected
 * by every consumer. Nothing caught it; main's fix landed independently and the
 * merge is what exposed it.
 *
 * So the guard is behavioural rather than a comment: the two must AGREE on
 * every value, in both directions. A future keying added to one and not the
 * other fails here instead of at a consumer's parse.
 */
describe("the keying enum has exactly one definition", () => {
  const VALUES = ["commit", "tip", "route", "route-family"] as const;
  // `family` WAS junk here (a near-miss for `route-family`) until it became a
  // keying of its own — bean `lehh`, folded into this one enum when the two
  // branches met. `famly` keeps the near-miss guarded.
  const JUNK = ["", "routes", "famly", "route_family", "dynamic", "ROUTE", "tip "] as const;

  test("every accepted value is accepted by BOTH", () => {
    for (const v of VALUES) {
      expect(KeyedBySchema.safeParse(v).success).toBe(true);
      expect(DirectoryStorageSchema.safeParse({ branch: "gh-pages", keyedBy: v }).success).toBe(true);
    }
  });

  test("`family` is in the one enum, and the declaration takes it in its OWN shape", () => {
    expect(KeyedBySchema.safeParse("family").success).toBe(true);
    expect(
      DirectoryStorageSchema.safeParse({ branchPrefix: "cat/x/y/", keyedBy: "family", keyFrom: "the package id" }).success,
    ).toBe(true);
    // A family is not a single branch: one with `branch` and no prefix is refused.
    expect(DirectoryStorageSchema.safeParse({ branch: "gh-pages", keyedBy: "family" }).success).toBe(false);
  });

  test("every rejected value is rejected by BOTH — the direction `1j3q` missed", () => {
    // `1j3q`'s failure was a value one side accepted and the other did not.
    // Asserting only the accept direction would have passed while that bug was
    // live, so both directions are checked.
    for (const v of JUNK) {
      expect(KeyedBySchema.safeParse(v).success).toBe(false);
      expect(DirectoryStorageSchema.safeParse({ branch: "gh-pages", keyedBy: v }).success).toBe(false);
    }
  });

  test("the declaration does not RESTATE the enum — it is the same schema object", () => {
    // The structural half. Agreement on a value list can be maintained by hand
    // and drift again; identity cannot. `DirectoryStorageSchema` must carry
    // `KeyedBySchema` itself, so a new value reaches both by construction.
    const shape = (DirectoryStorageSchema as unknown as { shape: Record<string, unknown> }).shape;
    expect(shape.keyedBy).toBe(KeyedBySchema);
  });
});
