#!/usr/bin/env bun
/**
 * Does a path, a path prefix or a bean id exist on main or any open PR head —
 * the `open-work-lookup` Tool (cat-harness `work-plan/tools/open-work-lookup/`).
 *
 * GitHub REST only (`gh api`), since cloud sessions are refused GraphQL.
 * Whatever could not be read is listed under `unread`, so an empty answer is
 * never presented as absence. Exit 0 with hits, 1 without, 2 when something
 * was unread and nothing was found.
 *
 * @module scripts/open-work-lookup
 */
import { argList, argOne, type Lookup, lookupOpenWork, originRepo, renderLookup } from "./lib/bean-drain.ts";

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const given = (["path", "prefix", "bean"] as const).flatMap((k) => {
    const v = argOne(argv, `--${k}`);
    return v === undefined ? [] : [{ kind: k, value: v }];
  });
  const safe = /^[A-Za-z0-9._][A-Za-z0-9._/-]*$/;
  if (given.length !== 1 || !safe.test(given[0]!.value) || given[0]!.value.split("/").includes("..")) {
    console.error("usage: bun run cat lookup:open-work (--path <p> | --prefix <p> | --bean <id>) [--repo owner/name]... [--json]");
    process.exit(2);
  }
  const repos = argList(argv, "--repo");
  if (repos.length === 0) {
    const o = originRepo(process.cwd());
    if (o === undefined) { console.error("no --repo and the checkout's origin is not on GitHub"); process.exit(2); }
    repos.push(o);
  }
  const r: Lookup = lookupOpenWork(given[0]!, repos);
  console.log(argv.includes("--json") ? JSON.stringify(r, null, 2) : renderLookup(r));
  process.exit(r.hits.length > 0 ? 0 : r.unread.length > 0 ? 2 : 1);
}
