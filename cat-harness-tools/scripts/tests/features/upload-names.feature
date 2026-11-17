# check:upload-names: a file in an uploads or library graph carries a name that
# is safe to link to. Each Scenario names the test that executes it.
Feature: Upload names

  @test:scripts/tests/upload-names.test.ts::the_corpus_is_clean_as_committed::`--check`_passes
  Scenario: The committed corpus passes --check
    When "check-upload-names.ts --check" is run from the checkout's parent
    Then its output says "files examined" and it exits 0

  @test:scripts/tests/upload-names.test.ts::the_corpus_is_clean_as_committed::every_count_carries_its_denominator
  Scenario: The count of names needing normalisation has a denominator
    When "check-upload-names.ts" is run
    Then its output has "...needing normalisation N of M"

  @test:scripts/tests/upload-names.test.ts::case_is_not_the_defect::`README.md`_is_left_alone
  Scenario: README.md is left alone
    Then "README.md" is normalised and normalises to itself

  @test:scripts/tests/upload-names.test.ts::case_is_not_the_defect::a_name_with_no_unsafe_character_is_returned_UNTOUCHED
  Scenario: A safe name is untouched
    Then a section file name with a double dash normalises to itself
    And "a--b.pdf" and "-leading-and-trailing-.pdf" are normalised

  @test:scripts/tests/upload-names.test.ts::case_is_not_the_defect::mixed_case_and_underscores_survive
  Scenario: Mixed case and underscores survive
    Then "AGENTS.md", "My_File.PDF", "arxiv-2607.25032v1" and "WHO-handbook.pdf" normalise to themselves

  @test:scripts/tests/upload-names.test.ts::the_characters_that_actually_break_a_link_are_replaced::the_defect_that_reddened_main
  Scenario: Parentheses and spaces are replaced
    Then "PIIS2589750021000388 (2).pdf" normalises to "PIIS2589750021000388-2.pdf"

  @test:scripts/tests/upload-names.test.ts::the_characters_that_actually_break_a_link_are_replaced::each_unsafe_character_is_handled
  Scenario: Each unsafe character makes a name unnormalised
    Then a name holding a space, comma, bracket, brace, "#", "?", "&", "%", quote, backtick, angle bracket or "|" is not normalised

  @test:scripts/tests/upload-names.test.ts::the_characters_that_actually_break_a_link_are_replaced::a_run_collapses_to_one_dash,_and_edges_are_trimmed
  Scenario: Unsafe runs collapse and edges are trimmed
    Then "a  (  ) b.pdf" normalises to "a-b.pdf"
    And " leading.pdf" normalises to "leading.pdf"

  @test:scripts/tests/upload-names.test.ts::the_extension_chain_survives_—_the_whole_risk::the_extension_is_not_slugged_into_the_stem
  Scenario: The extension survives
    Then "x (2).pdf" normalises to a name ending ".pdf" and not containing "-pdf"

  @test:scripts/tests/upload-names.test.ts::the_extension_chain_survives_—_the_whole_risk::a_sidecar_normalises_to_exactly_what_its_source_does,_plus_the_suffix
  Scenario: A sidecar normalises with its source
    Then "<source>.pdf.extraction.json" normalises to the source's normalised name plus ".extraction.json"

  @test:scripts/tests/upload-names.test.ts::the_extension_chain_survives_—_the_whole_risk::a_dotfile_and_an_extensionless_name_are_not_mangled
  Scenario: Dotfiles and extensionless names are kept
    Then "Makefile" and ".gitkeep" normalise to themselves

  @test:scripts/tests/upload-names.test.ts::a_collision_refuses_rather_than_picking_a_winner::the_refusal_is_in_the_script,_and_it_is_a_refusal_not_a_rename
  Scenario: The script's source refuses a collision before any git mv
    # Gap: asserted on the script's source text, not by running a collision; it checks two strings and that "COLLISION" appears before the first git mv call.
    When the source of "check-upload-names.ts" is read
    Then it contains "COLLISION" and "picking a winner silently destroys an upload"
    And "COLLISION" appears before the git mv call
