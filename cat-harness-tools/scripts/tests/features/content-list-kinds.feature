# How `content_list` identifies a block's kind and label in a scaffolded folio, through
# readBlockManifest and readUnlabelledBlockManifest in pipeline/qa-utils, against the old regex.
# Each Scenario names the test that executes it.
Feature: content_list reads a block's kind from its builder

  @test:scripts/tests/content-list-kinds.test.ts::block_identification_in_a_scaffolded_folio::a_builder-authored_block_reports_its_real_kind_and_label
  Scenario: A builder-authored block is identified with its kind and label
    Given a scaffolded document folio "cold-chain-guidance"
    When "overview.ts" in its introduction chapter is identified
    Then a block is found
    And its kind is "prose" and its label is "prose:overview"

  @test:scripts/tests/content-list-kinds.test.ts::block_identification_in_a_scaffolded_folio::the_old_regex_could_not_have_found_it_—_this_is_the_regression
  Scenario: The old kind regex finds nothing in a builder-authored block
    Given a scaffolded document folio
    When the source of "overview.ts" in its introduction chapter is read
    Then it contains "prose({"
    And it contains no literal "kind:" followed by a quote
    And the old regex detector reports "unknown"

  @test:scripts/tests/content-list-kinds.test.ts::block_identification_in_a_scaffolded_folio::the_chapter_manifest_is_not_a_block
  Scenario: The chapter manifest is not identified as a block
    Given a scaffolded document folio
    When "introduction.ts" in its introduction chapter is identified
    Then no block is found

  @test:scripts/tests/content-list-kinds.test.ts::block_identification_in_a_scaffolded_folio::exactly_one_.ts_in_the_starter_chapter_is_a_block
  Scenario: Exactly one of the starter chapter's two .ts files is a block
    # Skipped: when the paper folio-template profile is not held
    Given a scaffolded paper folio
    Then its introduction chapter holds 2 .ts files
    And exactly 1 of them is identified as a block
