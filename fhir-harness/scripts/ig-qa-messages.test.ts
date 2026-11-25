import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { carryQa, qaMessagesFromXml, QA_ORIGIN_FILE, writeQaMessages } from "./ig-qa-messages.ts";

/** The shape ValidationPresenter writes as qa.xml: the build's own messages, then one OperationOutcome per input file. */
const QA_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Bundle xmlns="http://hl7.org/fhir">
  <type value="collection"/>
  <entry>
    <resource>
      <OperationOutcome>
        <issue>
          <extension url="http://hl7.org/fhir/StructureDefinition/operationoutcome-message-id"><valueCode value="SD_NO_SLICING"/></extension>
          <severity value="warning"/>
          <code value="processing"/>
          <details><text value="The build &amp; its &lt;config&gt;"/></details>
        </issue>
      </OperationOutcome>
    </resource>
  </entry>
  <entry>
    <resource>
      <OperationOutcome>
        <extension url="http://hl7.org/fhir/StructureDefinition/operationoutcome-file"><valueString value="fsh-generated/resources/Questionnaire-A.json"/></extension>
        <!-- a comment -->
        <issue>
          <extension url="http://hl7.org/fhir/StructureDefinition/operationoutcome-issue-line"><valueInteger value="12"/></extension>
          <extension url="http://hl7.org/fhir/StructureDefinition/operationoutcome-issue-col"><valueInteger value="4"/></extension>
          <extension url="http://hl7.org/fhir/StructureDefinition/operationoutcome-issue-source"><valueString value="InstanceValidator"/></extension>
          <severity value="error"/>
          <code value="invalid"/>
          <details><text value="Questionnaire.item[0]: no &#x201C;linkId&#x201D;"/></details>
          <expression value="Questionnaire.item[0]"/>
        </issue>
        <issue>
          <severity value="information"/>
          <code value="informational"/>
          <details><text value="a hint"/></details>
        </issue>
      </OperationOutcome>
    </resource>
  </entry>
</Bundle>
`;

describe("ig-qa-messages", () => {
  test("groupsTheBundleInThePublishersOrder", () => {
    const r = qaMessagesFromXml(QA_XML);
    expect(r.groups.length).toBe(2);
    expect(r.groups[0]).toEqual({ messages: [{ severity: "warning", code: "processing", text: "The build & its <config>", messageId: "SD_NO_SLICING" }] });
    expect(r.groups[1]!.file).toBe("fsh-generated/resources/Questionnaire-A.json");
    expect(r.groups[1]!.messages[0]).toEqual({
      severity: "error",
      code: "invalid",
      text: "Questionnaire.item[0]: no “linkId”",
      path: "Questionnaire.item[0]",
      line: 12,
      col: 4,
      source: "InstanceValidator",
    });
    expect(r.groups[1]!.messages[1]!.severity).toBe("information");
  });

  test("noQaXmlStillWritesAFileThatSaysSo", () => {
    const d = mkdtempSync(join(tmpdir(), "ig-qa-msg-"));
    writeQaMessages(join(d, "qa.xml"), join(d, "out.json"));
    const r = JSON.parse(readFileSync(join(d, "out.json"), "utf-8"));
    expect(r.groups).toEqual([]);
    expect(r.absent).toContain("no qa.xml");
  });

  test("anIncrementalAstCarriesItsBasesPublisherQaAndSaysWhichRunItCameFrom", () => {
    const base = mkdtempSync(join(tmpdir(), "qa-base-"));
    const out = mkdtempSync(join(tmpdir(), "qa-out-"));
    writeFileSync(join(base, "qa.json"), '{"errs":1}');
    writeFileSync(join(base, "qa-messages.json"), '{"$schema":"ig-qa-messages/v1","groups":[]}');
    writeFileSync(join(base, "manifest.json"), JSON.stringify({ generatedAt: "2026-11-17T11:59:18Z", inputs: { sourceRevision: "2f4f04df6ed8" } }));
    expect(carryQa(base, out)).toEqual(["qa.json", "qa-messages.json", QA_ORIGIN_FILE]);
    expect(readFileSync(join(out, "qa.json"), "utf-8")).toBe('{"errs":1}');
    expect(JSON.parse(readFileSync(join(out, QA_ORIGIN_FILE), "utf-8"))).toEqual({ $schema: "ig-qa-origin/v1", sourceRevision: "2f4f04df6ed8", generatedAt: "2026-11-17T11:59:18Z" });
    // A chain of incremental builds keeps the first full run as the origin.
    const next = mkdtempSync(join(tmpdir(), "qa-next-"));
    writeFileSync(join(out, "manifest.json"), JSON.stringify({ generatedAt: "2026-11-17T13:04:29Z", inputs: { sourceRevision: "6833cd15ae5e" } }));
    carryQa(out, next);
    expect(JSON.parse(readFileSync(join(next, QA_ORIGIN_FILE), "utf-8")).sourceRevision).toBe("2f4f04df6ed8");
  });

  test("carryNeverOverwritesTheNewAstsOwnQaAndWritesNothingWithNothingToCarry", () => {
    const base = mkdtempSync(join(tmpdir(), "qa-base-"));
    const out = mkdtempSync(join(tmpdir(), "qa-out-"));
    expect(carryQa(base, out)).toEqual([]);
    expect(existsSync(join(out, QA_ORIGIN_FILE))).toBe(false);
    writeFileSync(join(base, "qa.json"), '{"errs":1}');
    writeFileSync(join(out, "qa.json"), '{"errs":0}');
    expect(carryQa(base, out)).toEqual([]);
    expect(readFileSync(join(out, "qa.json"), "utf-8")).toBe('{"errs":0}');
  });
});
