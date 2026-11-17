Feature: the note on a document's glossary that lists outside glossaries

  @test:scripts/external-glossaries.test.ts::external_glossaries::noteLinksNotDefinitional
  Scenario: the note links each glossary and says it is not definitional
    When the note is made for one outside glossary, and for none
    Then it links the glossary as external and says it is not definitions
    And with none it is empty

  @test:scripts/external-glossaries.test.ts::external_glossaries::noteBeforeFirstEntry
  Scenario: the note goes just before the first glossary entry, and nowhere without one
    When the note is added to a glossary page
    Then it goes after the heading and before the first entry's anchor
    And with no first entry, or no outside glossary, the page is unchanged
