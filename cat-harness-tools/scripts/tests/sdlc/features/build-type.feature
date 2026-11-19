# scripts/lib/build-type.ts reads the build type from the environment: a preview
# borrows main's indexes, a full build rebuilds them, and any doubt builds full.
# Each Scenario names the test that executes it.
Feature: Preview and full build types

  @test:scripts/tests/sdlc/build-type.test.ts::buildTypeOf::unset_builds_full
  Scenario: An unset build type builds full
    Given the build-type variable is absent, or set to only whitespace
    When the build type is read
    Then the type is "full"

  @test:scripts/tests/sdlc/build-type.test.ts::buildTypeOf::names_preview_or_full
  Scenario: The build type names preview or full
    Given the build-type variable is "preview", then "full"
    When the build type is read
    Then the type is "preview", then "full"

  @test:scripts/tests/sdlc/build-type.test.ts::buildTypeOf::refuses_anything_else,_so_a_typo_cannot_pass_for_a_full_build
  Scenario: Any other build type is refused, so a typo cannot pass for a full build
    Given the build-type variable is "previw", then "staging"
    When the build type is read
    Then each result carries a refusal

  @test:scripts/tests/sdlc/build-type.test.ts::isIndexWriter::a_writer_all_of_whose_entries_are_indexes_is_borrowed
  Scenario: A writer all of whose entries are indexes is an index writer
    Given a plan where "lsi:viz" writes only an entry marked index
    When "lsi:viz" is checked
    Then it is an index writer

  @test:scripts/tests/sdlc/build-type.test.ts::isIndexWriter::a_writer_that_also_writes_a_page_is_not:_borrowing_it_would_keep_main's_page
  Scenario: A writer that also writes a page is not an index writer
    Given a plan where "slice:sqlite" writes one index entry and shares a page entry with "docs:pages"
    When "slice:sqlite" and "docs:pages" are checked
    Then neither is an index writer

  @test:scripts/tests/sdlc/build-type.test.ts::isIndexWriter::a_writer_nothing_declares_is_not
  Scenario: A writer no entry declares is not an index writer
    Given a plan that never names "kg:export"
    When "kg:export" is checked
    Then it is not an index writer

  @test:scripts/tests/sdlc/build-type.test.ts::the_declaration_field::index:_true_is_accepted
  Scenario: A built-at-publish entry with index true is accepted
    Given a built-at-publish entry for "docs/x/" written by "lsi:viz"
    When it is parsed with index set to true
    Then the schema accepts it

  @test:scripts/tests/sdlc/build-type.test.ts::the_declaration_field::index:_false_is_refused:_leave_it_out_instead
  Scenario: A built-at-publish entry with index false is refused
    Given a built-at-publish entry for "docs/x/" written by "lsi:viz"
    When it is parsed with index set to false
    Then the schema refuses it
