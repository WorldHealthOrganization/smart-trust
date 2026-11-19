Feature: a glossary drafted from a source's glossary and abbreviations

  @test:scripts/glossary-from-source.test.ts::glossary-from-source_(folio-assistant-core#498)::readsRowsWithLines
  Scenario: reads table rows and definition lines, skipping the header, with their lines
    When the rows of a terms section are read
    Then they are the four terms with their lines, without the header
    And a definition across lines is joined

  @test:scripts/glossary-from-source.test.ts::glossary-from-source_(folio-assistant-core#498)::sectionKindFromTitle
  Scenario: a section's kind comes from its title
    When section kinds are read from titles
    Then an abbreviations title gives abbreviations, Glossary gives terms, Introduction nothing

  @test:scripts/glossary-from-source.test.ts::glossary-from-source_(folio-assistant-core#498)::bracketedAcronymNotation
  Scenario: a bracketed acronym is the notation; ids are slugs
    When labels are split and ids made
    Then a bracketed plural acronym becomes the notation
    And a bracket that is not an acronym stays, and ids are slugs

  @test:scripts/glossary-from-source.test.ts::glossary-from-source_(folio-assistant-core#498)::acronymsFoldIntoTerms
  Scenario: acronyms fold into the term they expand; the rest become terms of their own, without a definition
    When candidates are made from terms and abbreviations
    Then acronyms become the notation of the terms they expand
    And the rest become candidate terms with no definition, sourced at their line

  @test:scripts/glossary-from-source.test.ts::glossary-from-source_(folio-assistant-core#498)::headingTermOneRow
  Scenario: a term printed as a heading of its own is one row, on its paragraph's line
    When a term printed as its own heading is read
    Then it is one row on its paragraph's line, without link markup

  @test:scripts/glossary-from-source.test.ts::glossary-from-source_(folio-assistant-core#498)::mergeKeepsPersonOwned
  Scenario: merging keeps what a person owns and refreshes only the tool's own candidates
    Given a term a person has authored
    When the candidates are merged again
    Then the authored definition is kept and the count unchanged
    And merging unedited terms changes nothing

  @test:scripts/glossary-from-source.test.ts::glossaries_as_a_PDF_prints_them_(re-ingest_pilot,_2026-11-14)::stackedTermsRead
  Scenario: an L1 glossary printed term over definition is read
    When a term is printed on its own line, wrapped over at most three, and its definition below it
    Then each term becomes a row, its definition joined and its reference marks dropped

  @test:scripts/glossary-from-source.test.ts::glossaries_as_a_PDF_prints_them_(re-ingest_pilot,_2026-11-14)::stackedAcronymsFoldIntoTerms
  Scenario: an L1 abbreviations list printed acronym over expansion is read
    When an acronym is printed on its own line and its expansion on the next
    Then each acronym becomes a row with its expansion

  @test:scripts/glossary-from-source.test.ts::glossaries_as_a_PDF_prints_them_(re-ingest_pilot,_2026-11-14)::titleWordsOpenTheTitle
  Scenario: a glossary title names the glossary at its start
    When "definitions" appears late in a step's title
    Then the section is not a glossary, while "Annex G. Definition of terms" and "II. Definition of key terms" are

  @test:scripts/glossary-from-source.test.ts::glossaries_as_a_PDF_prints_them_(re-ingest_pilot,_2026-11-14)::titledSectionWithNoRowIsAnInput
  Scenario: a glossary section nothing is read from is still a glossary section
    When a section titled Glossary yields no row
    Then it is an input with no candidates, so the arm reports partial and not none
