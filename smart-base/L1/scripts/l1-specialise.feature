Feature: l1LibraryDocument specialises a library entry into an L1 graph
  A held publication (its IRIS record, intake and structure) becomes an
  l1-library document whose L1 nodes specialise the library entry's nodes.

  Background:
    Given the "Leave no one behind" record with electronic and print ISBNs, declared an L1 member by the owner
    And a library entry structure with front matter, chapter 1 "Principles" holding 1.1 "Policy", a chapter "Designing schedules" printed as Annex 1, and a Table A1.1 on its page
    When its l1-library document is built

  @test:smart-base/L1/scripts/l1-specialise.test.ts::l1LibraryDocument::publicationIriFromElectronicIsbn
  Scenario: publication IRI from the electronic ISBN; decided when declared
    Then the record's first identifier is isbn "9789240016514"
    And the publication node's id is ".../publication/isbn-9789240016514"
    And it is derived as "decided", with evidence by "ritikarawlani" at "2026-10-07"

  @test:smart-base/L1/scripts/l1-specialise.test.ts::l1LibraryDocument::layoutNodesSpecialiseLibraryIris
  Scenario: every L1 layout node specialises an absolute library IRI — upstream only
    Then there are 5 specializationOf edges
    And each targets a library-node under "https://litlfred.github.io/folio/library/lnob/"
    And no edge has a library node as its source

  @test:smart-base/L1/scripts/l1-specialise.test.ts::l1LibraryDocument::recoversPrintedNumbers
  Scenario: printed numbers are recovered, so an annex does not collide with a chapter
    Then the section ids end in "Section-1", "1.1" and "Annex-1"
    And the printed number of "3" titled "x" with label "Annex 3. y" is "3"

  @test:smart-base/L1/scripts/l1-specialise.test.ts::l1LibraryDocument::sectionsNestElementInDeepestSection
  Scenario: sections nest, and an element sits in the deepest section holding its page
    Then "Section-1" contains "1.1"
    And "Annex-1" contains "table-a1-1"
    And the element's properties are elementType "table", label "Table A1.1" and pageRange "11"

  @test:smart-base/L1/scripts/l1-specialise.test.ts::l1LibraryDocument::frontMatterReportedNotEmitted
  Scenario: front matter is reported, not emitted
    Then the report mentions "front matter"
    And no section node is labelled "Front matter"

  @test:smart-base/L1/scripts/l1-specialise.test.ts::l1LibraryDocument::catHarnessClassesUnderDeclaredRelease
  Scenario: cat-harness classes are minted under its declared release, not a hard-coded version
    Then the cat-harness namespace is cat-harness.json's iriBase followed by "v<major>/ns/"
    And the library entry's class is "SourceDocument" in that namespace
    And every cat-harness class on a library node is in that namespace
    And the kg package's literal cat-harness namespace equals it
