import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { qaMessagesFromXml, writeQaMessages } from "./ig-qa-messages.ts";

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
});
