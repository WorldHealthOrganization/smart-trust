/**
 * `prov-jsonld` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness/schemas/prov-jsonld.test.ts` (bean `7zz1`, owner ruling
 * 2026-10-06 "Top-level instance"): each reads who-iris's IRIS catalogue,
 * which only the checkout holds. Standing alone, cat-harness has none of it,
 * and `check:cat-harness-standalone` collects every test in that layer. The
 * rest of that file's tests stay there; every path here is composed from
 * ORIGIN_DIR, the directory they were written in, so nothing they read
 * changed.
 */
import { describe, expect, test } from "bun:test";
import { resolve, join } from "node:path";

import jsonld from "jsonld";

import { localLoader } from "../../scripts/publish-verify.ts";
import {
  addressBook,
  provJsonldDocument,
} from "../../schemas/kg/prov-jsonld.ts";
import type { ProvActivity } from "../../schemas/content/prov.ts";

/** The directory these tests were written in (`cat-harness/schemas/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/schemas");

const REPO = resolve(ORIGIN_DIR, "..", "..");
const P = "http://www.w3.org/ns/prov#";

const activity = (agent: string, role: string, plan: string): ProvActivity =>
  ({
    "@type": "prov:Activity",
    "@id": "t--x#1",
    "prov:startedAtTime": "2026-10-01T00:00:00.000Z",
    "prov:qualifiedAssociation": { "prov:agent": agent, "prov:hadRole": role, "prov:hadPlan": plan },
    "cat-harness:underPolicy": "https://litlfred.github.io/folio-assistant/policies/folio-defaults",
  }) as ProvActivity;

async function expanded(doc: object): Promise<Record<string, unknown>[]> {
  const top = (await jsonld.expand(doc, { documentLoader: localLoader(REPO) } as never)) as unknown as Record<string, unknown>[];
  return top.flatMap((n) => (n["@graph"] as Record<string, unknown>[] | undefined) ?? [n]);
}

describe("prov:used — catalogue items linked at their Handle (owner 2026-10-01, option A)", () => {
  const book = addressBook(REPO);
  const used = (items: string[]): ProvActivity =>
    ({ ...activity("owner", "authoring-agent", "code-change-review#T"), "prov:used": items }) as ProvActivity;

  test("a catalogued IRIS item expands to its Handle IRI as a link", async () => {
    const { document, unaddressed } = provJsonldDocument("t--x", [used(["item/18892cf3-5a4f-42a4-923c-a93f4a594dec"])], book);
    expect(unaddressed).toEqual([]);
    const act = (await expanded(document)).find((n) => (n["@type"] as string[] | undefined)?.includes(`${P}Activity`))!;
    expect(act[`${P}used`]).toEqual([{ "@id": "https://hdl.handle.net/10665/332098" }]);
  });
});
