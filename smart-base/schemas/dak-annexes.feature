Feature: The DAK web annex schemas
  The data-dictionary annex and swimlane map schemas accept well-formed annexes
  and reject malformed ones.

  @test:smart-base/schemas/dak-annexes.test.ts::dak-annexes::dataDictionaryRejectsRaggedRowAndStrayKey
  Scenario: a data-dictionary annex parses, and a ragged row or a stray key does not
    Given a data-dictionary annex with one sheet of one column and one row
    Then it parses
    When a row with two cells is added
    Then it does not parse
    When an extra top-level key is added instead
    Then it does not parse

  @test:smart-base/schemas/dak-annexes.test.ts::dak-annexes::swimlaneMapPersonaAliasesMustBeList
  Scenario: a swimlane map parses; a persona's aliases must be a list
    Given a swimlane map whose persona "Health worker" has aliases ["HW"]
    Then it parses
    When the persona's aliases are the string "HW"
    Then it does not parse

  @test:smart-base/schemas/dak-annexes.test.ts::dak-annexes::webAnnexNamesPublicationAndSection
  Scenario: a web annex names its publication, its label and its section; its own IRIS record is optional
    Given the data-dictionary annex
    Then it parses with an IRIS handle "10665/123" added
    And it does not parse without annexOf, or without section
    And it does not parse with annexOf "the DAK", with iris "380303", or with section "core-data-elements"
