# The extracted-statements page: each statement, the library entry and section it came
# from, and the page built from a spec. Each Scenario names the test that executes it.
Feature: Publishing extracted statements

  @test:scripts/publish-extracted-statements.test.ts::the_section_a_page_falls_in::sectionStartingLatestAtOrBeforePage
  Scenario: A page falls in the section that starts latest at or before it
    Given sections on pages 1–3, 3–7 and 8–9
    Then page 3 and page 7 fall in the second, and page 1 in the first

  @test:scripts/publish-extracted-statements.test.ts::the_section_a_page_falls_in::noSectionWhenSeveralStartOnPage
  Scenario: A page where several sections start falls in none
    Given two sections both starting on page 1
    Then page 1 falls in no section

  @test:scripts/publish-extracted-statements.test.ts::the_section_a_page_falls_in::skipsSynthesisedFrontMatter
  Scenario: Synthesised front matter is skipped while an authored section applies
    Given synthesised front matter and an authored section both covering page 1
    Then page 1 falls in the authored section
    And a page only the front matter covers falls in the front matter

  @test:scripts/publish-extracted-statements.test.ts::the_section_a_page_falls_in::noSectionBeforeFirst
  Scenario: A page before the first section falls in none
    Given a first section starting on page 4
    Then page 2 falls in no section

  @test:scripts/publish-extracted-statements.test.ts::a_table_cell::cellEscapesBackslashBeforePipe
  Scenario: A table cell escapes backslashes before pipes
    Then a backslash before a pipe is escaped before the pipe is
    And a pipe is escaped
    And a line break with its indentation becomes one space

  @test:scripts/publish-extracted-statements.test.ts::labels::locatorLabelSingularAndPlural
  Scenario: Labels say one place in the singular and a range in the plural
    Then slide 7 to 7 is labelled "slide 7"
    And pages 3 to 5 are labelled "pages 3–5"

  @test:scripts/publish-extracted-statements.test.ts::resolving_a_source_against_a_real_library_entry::resolvesSectionAndPage
  Scenario: A source resolved against a real library entry names its section and page
    Given a statement citing section page-012 of who-iris entry wpr-rdo-2020-003-eng
    When its source is resolved
    Then it links that section's file
    And its label is "page 12"

  @test:scripts/publish-extracted-statements.test.ts::resolving_a_source_against_a_real_library_entry::resolvesSectionFromPage
  Scenario: The same section is found from a page
    Given a statement citing page 12 of that entry
    When its source is resolved
    Then it links section page-012

  @test:scripts/publish-extracted-statements.test.ts::resolving_a_source_against_a_real_library_entry::refusesUnresolvedSource
  Scenario: A statement whose source does not resolve is refused
    Given statements citing a missing section, no place at all, and an entry never ingested
    When each source is resolved
    Then each is refused

  @test:scripts/publish-extracted-statements.test.ts::the_page::pageLinksEntryAndSection
  Scenario: The page links every statement to its entry and its section
    Given one resolved statement
    When the page is rendered
    Then its row links the library entry and the section, with the section's label

  @test:scripts/publish-extracted-statements.test.ts::the_page::pageEscapesPipesAndCarriesLook
  Scenario: The page escapes the statement's pipes and carries the content type's look
    When the page is rendered
    Then the statement's pipe is escaped
    And the table attribute is on the page

  @test:scripts/publish-extracted-statements.test.ts::the_page::pageIsDeterministic
  Scenario: The page is deterministic
    When the same input is rendered twice
    Then the two pages are byte for byte equal

  @test:scripts/publish-extracted-statements.test.ts::a_page_built_from_its_spec::publishThenCheckCurrentThenStale
  Scenario: A page built from its spec is written, current under --check, and stale after a hand edit
    Given a page spec citing page 12 of a real entry
    When it is published
    Then the page links section page-012
    And --check exits 0
    When the page is edited by hand
    Then --check exits 1

  @test:scripts/publish-extracted-statements.test.ts::a_page_built_from_its_spec::writesNothingWhenUnresolved
  Scenario: Nothing is written when a source does not resolve
    Given a page spec citing a missing section
    When it is published
    Then it exits 1 and writes no page

  @test:scripts/publish-extracted-statements.test.ts::derived_statements::derivedFromColumnOnlyWhenListHasOne
  Scenario: Derived statements get a Derived from column only when the list has one
    Given a list with a derivedFrom statement and a list without one
    When each page is rendered
    Then the first shows the Derived from column and the second does not
