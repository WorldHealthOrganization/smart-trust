import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { contextOf, extractUserScenario } from "./pot-for-user-scenarios.ts";
import { TOOLS_ROOT } from "../scripts/lib/roots.ts";

const SCENARIO = {
  $schema: "user-scenario/0.4.0",
  id: "p1",
  title: "Health check and consent",
  description: "The pilgrim is checked and agrees to share a summary.",
  personas: ["kamal"],
  trustLadder: "trust-states",
  references: [{ label: "Consent model", href: "trust_domain_policy.html", rel: "specifies" }],
  steps: [
    {
      id: "P1",
      title: "Health check",
      narrative: "Kamal sees the counsellor.",
      lead: "kamal",
      experiences: [{ actor: "kamal", doing: "Answers the questions.", feeling: "Calm.", emotion: 1 }],
      record: { state: "self-reported", description: "Held on the wallet.", heldWhere: "Wallet" },
      handoff: { summary: "The summary goes to the HIE.", from: "kamal", to: "malaysia-hie" },
      fhirChanges: [{ resource: "Consent", change: "Created as active", profile: "HajjConsent" }],
      examples: ["Consent/hajj-consent"],
    },
  ],
};

describe("extractUserScenario — the words a person reads, and nothing a machine resolves", () => {
  test("titles, narrative, experiences, record and handoff text are extracted, each with its field as context", () => {
    const raw = JSON.stringify(SCENARIO, null, 2);
    const got = extractUserScenario(raw, "user-scenarios/p1.json");
    const pairs = got.map((e) => [e.msgctxt, e.msgid]);
    expect(pairs).toContainEqual(["title", "Health check and consent"]);
    expect(pairs).toContainEqual(["step.narrative", "Kamal sees the counsellor."]);
    expect(pairs).toContainEqual(["step.experiences.doing", "Answers the questions."]);
    expect(pairs).toContainEqual(["step.record.heldWhere", "Wallet"]);
    expect(pairs).toContainEqual(["step.handoff.summary", "The summary goes to the HIE."]);
    expect(pairs).toContainEqual(["step.fhirChanges.change", "Created as active"]);
    expect(pairs).toContainEqual(["references.label", "Consent model"]);
    expect(got.every((e) => e.kind === "json-field" && e.source === "user-scenarios/p1.json" && e.line > 1)).toBe(true);
  });
  test("ids, hrefs, ladder codes, actor ids, resource keys and profiles are never extracted", () => {
    const ids = extractUserScenario(JSON.stringify(SCENARIO), "p1.json").map((e) => e.msgid);
    for (const machine of ["p1", "P1", "kamal", "malaysia-hie", "trust-states", "self-reported", "trust_domain_policy.html", "specifies", "Consent", "HajjConsent", "Consent/hajj-consent"]) {
      expect(ids).not.toContain(machine);
    }
  });
  test("a field path's context drops the array markers and reads steps as step", () => {
    expect(contextOf("steps[].experiences[].doing")).toBe("step.experiences.doing");
    expect(contextOf("references[].label")).toBe("references.label");
  });
});

describe("translate-user-scenarios — templates per locale, and --check", () => {
  test("--check fails on a missing template, --extract writes it, then --check passes; no user-scenario directory exits 2", () => {
    const root = mkdtempSync(join(tmpdir(), "user-scenario-pot-"));
    try {
      writeFileSync(
        join(root, "acme.json"),
        JSON.stringify({
          name: "acme",
          directories: [
            { id: "translations", path: "translations/", graphTypologies: ["translation-sources"] },
            { id: "user-scenarios", path: "user-scenarios/", graphTypologies: ["user-scenario"] },
          ],
        }),
      );
      mkdirSync(join(root, "translations", "fr"), { recursive: true });
      mkdirSync(join(root, "user-scenarios"));
      writeFileSync(join(root, "user-scenarios", "p1.json"), JSON.stringify(SCENARIO, null, 2));
      const run = (...a: string[]) => spawnSync("bun", [join(TOOLS_ROOT, "scripts", "translate-user-scenarios.ts"), "--instance", root, ...a], { encoding: "utf-8" });
      expect(run("--check").status).toBe(1);
      expect(run("--extract").status).toBe(0);
      const pot = readFileSync(join(root, "translations", "fr", "user-scenarios", "p1.pot"), "utf-8");
      expect(pot).toContain('msgctxt "step.narrative"\nmsgid "Kamal sees the counsellor."');
      expect(run("--check").status).toBe(0);
      writeFileSync(join(root, "acme.json"), JSON.stringify({ name: "acme", directories: [{ id: "translations", path: "translations/", graphTypologies: ["translation-sources"] }] }));
      expect(run("--check").status).toBe(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
