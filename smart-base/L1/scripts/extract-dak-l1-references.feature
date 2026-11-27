Feature: The DAK Component 1 reader
  Reading the immunizations DAK's §1.1 interventions, §1.2 citations and
  reference lists, cut down to the lines that exercise each rule, and the
  judgements made on what is read.

  @test:smart-base/L1/scripts/extract-dak-l1-references.test.ts::§1.2_citations::citationsFoundUnder12Heading
  Scenario: found under the 1.2 heading
    Given pages 26 and 27 of the DAK
    When the citations are read
    Then their section's heading contains "1.2"

  @test:smart-base/L1/scripts/extract-dak-l1-references.test.ts::§1.2_citations::citationCardTextVerbatim
  Scenario: each (n) with its card text, verbatim, lines joined by one space
    Given the citations read from pages 26 and 27
    Then their numbers are 29 and 31
    And the first card's text is "Summarizes recommended routine immunizations for all age groups (updated in 2024), including cited WHO vaccine position papers (29)"
    And the second keeps the line-end hyphen: "... implementing catch- up vaccination (31)"

  @test:smart-base/L1/scripts/extract-dak-l1-references.test.ts::§1.2_citations::runInSentenceNotPartOfCard
  Scenario: the run-in sentence before the first card is not part of it
    Given the citations read from pages 26 and 27
    Then the first card's text does not start with "These"

  @test:smart-base/L1/scripts/extract-dak-l1-references.test.ts::§1.1_interventions::interventionItemsUnderGroup
  Scenario: items under their group, multi-line items joined
    Given the interventions read from pages 26 and 27
    Then the items are the counselling item, the joined home-based record item, "diphtheria–tetanus–pertussis (DTP)" and "yellow fever"
    And the third item's group is "Vaccination, based on individual characteristics, include:"

  @test:smart-base/L1/scripts/extract-dak-l1-references.test.ts::§1.1_interventions::interventionsStopAtNote
  Scenario: stops at the Note
    Given the interventions read from pages 26 and 27
    Then no item mentions "COVID"

  @test:smart-base/L1/scripts/extract-dak-l1-references.test.ts::§1.1_interventions::keepsLeadSentence
  Scenario: keeps the lead sentence that names the unnumbered source
    Given the interventions read from pages 26 and 27
    Then the section's lead contains "universal health coverage"

  @test:smart-base/L1/scripts/extract-dak-l1-references.test.ts::reference_lists::referenceNotEndedAtTitleStop
  Scenario: a reference does not end at its title's full stop (reference 26 lost its URL to that)
    Given the reference lists read from a workflow-steps page and the two reference pages
    Then reference 26 contains its "(https://www.who.int/publications/m/item/analysis-and-use" URL
    And its title is "Analysis and use of health facility data: guidance for Immunization programme managers"

  @test:smart-base/L1/scripts/extract-dak-l1-references.test.ts::reference_lists::pageFurnitureNotSwallowed
  Scenario: page furniture is not swallowed
    Given the reference list holding reference 29
    Then no reference's text contains the page number 85 or "References"

  @test:smart-base/L1/scripts/extract-dak-l1-references.test.ts::reference_lists::chosenListHoldsCitedNumbers
  Scenario: the list chosen holds every cited number — not the workflow steps
    Given the citations read from page 27
    When a list is chosen from the reference lists
    Then it is the list holding reference 29

  @test:smart-base/L1/scripts/extract-dak-l1-references.test.ts::reference_lists::websiteMarkerNotInTitle
  Scenario: [website] is not part of the title
    Then the title of reference 29 is "WHO recommendations for routine immunization – summary tables"

  @test:smart-base/L1/scripts/extract-dak-l1-references.test.ts::judgements::titleAgreementIsWordShare
  Scenario: title agreement is a share of the citation's words
    Then a citation whose words all appear in the reference agrees 1
    And "The WHO Immunization Data Portal" against "Immunization dashboard [website]. Geneva" agrees less than 0.34

  @test:smart-base/L1/scripts/extract-dak-l1-references.test.ts::judgements::publicationTypeFromTitleWords
  Scenario: publicationType only from the title's own words
    Then a "summary tables" title is a "summary-table"
    And a "guidance for planning" title is "implementation-guidance"
    And "WHO guidelines on hand hygiene" and "Immunization dashboard" have no publication type

  @test:smart-base/L1/scripts/extract-dak-l1-references.test.ts::context::section12DecidesL1ByContext
  Scenario: §1.2 decides L1 by context, and says which reference and section
    When reference 31 is classified in "1.2 WHO guidelines, recommendations and guidance"
    Then it is an L1 member by context
    And its basis mentions "reference 31"

  @test:smart-base/L1/scripts/extract-dak-l1-references.test.ts::urlKey::urlKeyMatchesSamePage
  Scenario: a reference URL and a record URI for the same page meet
    Then an https www URL with a trailing slash and an http URL with different case and a query have the same key
    And two different IRIS handles have different keys
