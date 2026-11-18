Feature: how far a folio covers its L1 entry's sentences

  @test:scripts/folio-l1-coverage.test.ts::reading_the_L1_entry::sortedSectionsNoFrontMatter
  Scenario: with no structure file, takes the sorted sections and drops front matter
    When an L1 entry with no structure file is read
    Then its sections are the sorted pages without front matter

  @test:scripts/folio-l1-coverage.test.ts::reading_the_L1_entry::refusesUnreadableStructure
  Scenario: refuses a structure file it cannot read, rather than reading no sections
    When an L1 entry with a structure file it cannot read is read
    Then it throws

  @test:scripts/folio-l1-coverage.test.ts::the_folio's_text_as_captured_statements::removesMarkdownMarkup
  Scenario: removes Markdown markup so a sentence split by it still matches
    When a Markdown line is made plain
    Then the markup is gone

  @test:scripts/folio-l1-coverage.test.ts::the_folio's_text_as_captured_statements::noShortFragments
  Scenario: does not use fragments shorter than 25 characters
    When the folio's captured text is read
    Then no fragment is shorter than 25 characters

  @test:scripts/folio-l1-coverage.test.ts::coverage_of_a_folio::capturesHeldLeavesRest
  Scenario: captures what the folio holds and leaves the rest unaccounted
    When the coverage is computed
    Then the held sentence is captured and the others unaccounted
    And it names its section and carries no generated date

  @test:scripts/folio-l1-coverage.test.ts::coverage_of_a_folio::signedExclusionAccounts
  Scenario: a signed exclusion by text accounts for a sentence; an unsigned one does not
    When an exclusion by text is given unsigned and signed
    Then unsigned, the sentence stays unaccounted
    And signed, it is excluded

  @test:scripts/folio-l1-coverage.test.ts::coverage_of_a_folio::quoteNeedsBlockToHoldIt
  Scenario: a quote captures a sentence only if the block holds it
    When a quote names a block that holds it, and one that does not
    Then the first captures the sentence with no problems
    And the second is a problem

  @test:scripts/folio-l1-coverage.test.ts::the_glossary_as_captured_text::glossaryTextCaptured
  Scenario: a sentence the glossary holds is captured, also across a dropped hyphen
    When the coverage is computed without and with the glossary
    Then without it one sentence is captured
    And with it the glossary's sentences are captured, across a dropped hyphen

  @test:scripts/folio-l1-coverage.test.ts::a_quote_that_stands_for_an_L1_sentence::quoteStandsForL1Sentence
  Scenario: captures the named L1 sentence when the block holds the corrected words
    When a quote with corrected words is given plain and naming its L1 sentence
    Then plain, the L1 sentence stays unaccounted
    And named, it is captured with no problems
