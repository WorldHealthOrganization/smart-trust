/**
 * The Component 1 reader on the shapes the immunizations DAK actually prints
 * (pages 26, 27, 94-95 of ISBN 978-92-4-009945-6), cut down to the lines that
 * exercise each rule.
 */
import { describe, expect, test } from "bun:test";

import { agreement, chooseList, contextClassification, publicationTypeOf, urlKey, readCitations, readInterventions, readReferenceLists, titleOf } from "./extract-dak-l1-references.ts";

const page = (path: string, text: string, pdfPage = 1) => ({
  path,
  pdfPage,
  lines: text.split("\n").map((t, i) => ({ n: i + 1, text: t })),
});

const P26 = page(
  "p26.md",
  `16
recommendations
1.1 \t List of interventions referenced in this DAK based on WHO universal health coverage list of essential
interventions
Interventions referenced in this DAK are based on WHO universal health coverage list of essential interventions.
\t»
General vaccine administration practices for all age groups, including children, are:
\t–
counselling on the vaccine(s) to be administered
\t–
document vaccinations received on a personal immunization record,
including the home-based record
\t»
Vaccination, based on individual characteristics, include:
\t–
diphtheria–tetanus–pertussis
(DTP)
\t–
yellow fever.
Note: The decision-support logic related to COVID-19 vaccinations is not included`,
  26,
);

const P27 = page(
  "p27.md",
  `17
personas
1.2 \t WHO guidelines, recommendations and guidance
These interventions draw from the following WHO guidelines and guidance.
Summarizes
recommended
routine
immunizations for all
age groups (updated
in 2024), including
cited WHO vaccine
position papers (29)
Leave no one
behind: guidance
for planning and
implementing catch-
up vaccination (31)`,
  27,
);

const REFS = page(
  "p94.md",
  `84
References2
 All references were accessed on 10 July 2024.
1.\t Resolution WHA71.7: Digital health. New York (NY): United Nations; 2018 (https://apps.who.int/gb/ebwha/pdf_files/WHA71/A71_R7-en.pdf).
26.\t Analysis and use of health facility data: guidance for Immunization programme managers.
Geneva: World Health Organization; 2018 (https://www.who.int/publications/m/item/analysis-and-use-of-health-facility-data-guidance-for-immunization-programme-managers).`,
);
// Numbering restarts are separate lists; 29 and 31 continue one.
const REFS2 = page(
  "p95.md",
  `85
References
29.\t WHO recommendations for routine immunization – summary tables [website]. Geneva: World
Health Organization (https://www.who.int/teams/immunization-vaccines-and-biologicals/policies/
who-recommendations-for-routine-immunization---summary-tables).
30.\t Sample of the WHO/UNICEF joint report form on immunization. World Health Organization and
United Nations Children’s Fund; 2016 (https://data.unicef.org/x.xls).
31.\t Leave no one behind: guidance for planning and implementing catch-up vaccination. Geneva:
World Health Organization; 2021 (https://iris.who.int/handle/10665/340749).`,
);
const STEPS = page("p42.md", "1.\t Obtain vaccination location information\n2.\t Validate against the NMFL");

describe("§1.2 citations", () => {
  const { section, citations } = readCitations([P26, P27]);
  test("citationsFoundUnder12Heading", () => expect(section?.heading).toContain("1.2"));
  test("citationCardTextVerbatim", () => {
    expect(citations.map((c) => c.number)).toEqual([29, 31]);
    expect(citations[0]!.text).toBe("Summarizes recommended routine immunizations for all age groups (updated in 2024), including cited WHO vaccine position papers (29)");
    // Not de-hyphenated: the rule extract-smart-kg-l1.ts follows.
    expect(citations[1]!.text).toBe("Leave no one behind: guidance for planning and implementing catch- up vaccination (31)");
  });
  test("runInSentenceNotPartOfCard", () => expect(citations[0]!.text.startsWith("These")).toBe(false));
});

describe("§1.1 interventions", () => {
  const { section, items } = readInterventions([P26, P27]);
  test("interventionItemsUnderGroup", () => {
    expect(items.map((i) => i.name)).toEqual([
      "counselling on the vaccine(s) to be administered",
      "document vaccinations received on a personal immunization record, including the home-based record",
      "diphtheria–tetanus–pertussis (DTP)",
      "yellow fever",
    ]);
    expect(items[2]!.group).toBe("Vaccination, based on individual characteristics, include:");
  });
  test("interventionsStopAtNote", () => expect(items.some((i) => i.name.includes("COVID"))).toBe(false));
  test("keepsLeadSentence", () => expect(section?.lead).toContain("universal health coverage"));
});

describe("reference lists", () => {
  const lists = readReferenceLists([STEPS, REFS, REFS2]);
  const refs = lists.find((l) => l.some((r) => r.number === 29))!;
  test("referenceNotEndedAtTitleStop", () => {
    const r26 = lists.flat().find((r) => r.number === 26)!;
    expect(r26.text).toContain("(https://www.who.int/publications/m/item/analysis-and-use");
    expect(titleOf(r26.text)).toBe("Analysis and use of health facility data: guidance for Immunization programme managers");
  });
  test("pageFurnitureNotSwallowed", () => expect(refs.every((r) => !/\b85\b|References/.test(r.text))).toBe(true));
  test("chosenListHoldsCitedNumbers", () => {
    const { citations } = readCitations([P27]);
    expect(chooseList(lists, citations)?.list).toBe(refs);
  });
  test("websiteMarkerNotInTitle", () => expect(titleOf(refs[0]!.text)).toBe("WHO recommendations for routine immunization – summary tables"));
});

describe("judgements", () => {
  test("titleAgreementIsWordShare", () => {
    expect(agreement("Leave no one behind: guidance for planning", "Leave no one behind: guidance for planning and implementing catch-up vaccination. Geneva")).toBe(1);
    expect(agreement("The WHO Immunization Data Portal", "Immunization dashboard [website]. Geneva")).toBeLessThan(0.34);
  });
  test("publicationTypeFromTitleWords", () => {
    expect(publicationTypeOf("WHO recommendations for routine immunization – summary tables")).toBe("summary-table");
    expect(publicationTypeOf("Leave no one behind: guidance for planning")).toBe("implementation-guidance");
    // L1 3.0 has no bare "guideline" type: the subtype needs the GRC record.
    expect(publicationTypeOf("WHO guidelines on hand hygiene")).toBeUndefined();
    expect(publicationTypeOf("Immunization dashboard")).toBeUndefined();
  });
});

describe("context", () => {
  test("section12DecidesL1ByContext", () => {
    const c = contextClassification(31, "1.2 WHO guidelines, recommendations and guidance");
    expect(c).toMatchObject({ code: "l1", member: true, source: "context" });
    expect(c.basis).toContain("reference 31");
  });
});

describe("urlKey", () => {
  test("urlKeyMatchesSamePage", () => {
    expect(urlKey("https://www.who.int/publications/m/item/x/")).toBe(urlKey("http://who.int/publications/m/item/X?download=true"));
    expect(urlKey("https://iris.who.int/handle/10665/1")).not.toBe(urlKey("https://iris.who.int/handle/10665/2"));
  });
});
