# scripts/translate-pot.ts is the older name and flags of scripts/translation-candidates.ts: every
# machine string, singular or plural, goes through the one candidates writer (translation-candidates/v1),
# fills an EMPTY msgstr fuzzy, is refused when its placeholders do not round-trip, and never overwrites
# a filled msgstr. Plural entries get every form, by the catalogue's plural count. Each Scenario names
# the test that executes it.
Feature: Machine translation of empty catalogue entries, under the older command

  @test:scripts/tests/translate-pot.test.ts::the_older_flags_map_onto_translation-candidates::--locale_repeats_into_one_list,_a_.po_is_started_unless_--no-create,_and_the_rest_pass_through
  Scenario: --locale repeats into one list, a .po is started unless --no-create, and the rest pass through
    Given the case in the older flags map onto translation-candidates
    When translate-pot runs
    Then --locale repeats into one list, a .po is started unless --no-create, and the rest pass through

  @test:scripts/tests/translate-pot.test.ts::the_older_flags_map_onto_translation-candidates::an_unknown_flag,_a_missing_value_or_a_non-English_source_is_refused
  Scenario: An unknown flag, a missing value or a non-English source is refused
    Given the case in the older flags map onto translation-candidates
    When translate-pot runs
    Then an unknown flag, a missing value or a non-English source is refused

  @test:scripts/tests/translate-pot.test.ts::the_CLI_over_a_translations_tree::fills_the_empty_entry,_keeps_the_filled_one,_and_writes_the_node
  Scenario: Fills the empty entry, keeps the filled one, and writes the node
    Given the case in the CLI over a translations tree
    When translate-pot runs
    Then fills the empty entry, keeps the filled one, and writes the node

  @test:scripts/tests/translate-pot.test.ts::the_CLI_over_a_translations_tree::singular_strings_become_candidates_for_the_review_page;_a_second_run_changes_nothing
  Scenario: Singular strings become candidates for the review page; a second run changes nothing
    Given the case in the CLI over a translations tree
    When translate-pot runs
    Then singular strings become candidates for the review page; a second run changes nothing

  @test:scripts/tests/translate-pot.test.ts::the_CLI_over_a_translations_tree::plural_entries_are_machine-filled,_fuzzy,_with_the_target's_plural_count,_and_are_candidates_too
  Scenario: Plural entries are machine-filled, fuzzy, with the target's plural count, and are candidates too
    Given the case in the CLI over a translations tree
    When translate-pot runs
    Then plural entries are machine-filled, fuzzy, with the target's plural count, and are candidates too

  @test:scripts/tests/translate-pot.test.ts::the_CLI_over_a_translations_tree::a_language_with_one_form_(zh)_takes_its_only_form_from_the_plural
  Scenario: A language with one form (zh) takes its only form from the plural
    Given the case in the CLI over a translations tree
    When translate-pot runs
    Then a language with one form (zh) takes its only form from the plural

  @test:scripts/tests/translate-pot.test.ts::the_CLI_over_a_translations_tree::leading_and_trailing_whitespace,_and_line_structure,_come_back_verbatim;_math_and_markup_reach_the_engine_masked
  Scenario: Leading and trailing whitespace, and line structure, come back verbatim; math and markup reach the engine masked
    Given the case in the CLI over a translations tree
    When translate-pot runs
    Then leading and trailing whitespace, and line structure, come back verbatim; math and markup reach the engine masked

  @test:scripts/tests/translate-pot.test.ts::the_CLI_over_a_translations_tree::a_string_with_nothing_but_placeholders_is_not_sent,_and_is_reported
  Scenario: A string with nothing but placeholders is not sent, and is reported
    Given the case in the CLI over a translations tree
    When translate-pot runs
    Then a string with nothing but placeholders is not sent, and is reported

  @test:scripts/tests/translate-pot.test.ts::the_CLI_over_a_translations_tree::an_entry_whose_placeholders_do_not_survive_is_left_empty_and_not_flagged_fuzzy
  Scenario: An entry whose placeholders do not survive is left empty and not flagged fuzzy
    Given the case in the CLI over a translations tree
    When translate-pot runs
    Then an entry whose placeholders do not survive is left empty and not flagged fuzzy

  @test:scripts/tests/translate-pot.test.ts::the_CLI_over_a_translations_tree::a_catalogue_signed_off_as_official_gets_candidates,_but_its_.po_and_node_are_not_changed
  Scenario: A catalogue signed off as official gets candidates, but its .po and node are not changed
    Given the case in the CLI over a translations tree
    When translate-pot runs
    Then a catalogue signed off as official gets candidates, but its .po and node are not changed

  @test:scripts/tests/translate-pot.test.ts::the_CLI_over_a_translations_tree::a_catalogue_that_says_DO_NOT_MACHINE-FILL_gets_candidates,_but_its_.po_is_not_changed
  Scenario: A catalogue that says DO NOT MACHINE-FILL gets candidates, but its .po is not changed
    Given the case in the CLI over a translations tree
    When translate-pot runs
    Then a catalogue that says DO NOT MACHINE-FILL gets candidates, but its .po is not changed

  @test:scripts/tests/translate-pot.test.ts::the_CLI_over_a_translations_tree::a_template_with_no_.po_is_started,_unless_--no-create
  Scenario: A template with no .po is started, unless --no-create
    Given the case in the CLI over a translations tree
    When translate-pot runs
    Then a template with no .po is started, unless --no-create

  @test:scripts/tests/translate-pot.test.ts::the_CLI_over_a_translations_tree::--dry-run_writes_nothing
  Scenario: --dry-run writes nothing
    Given the case in the CLI over a translations tree
    When translate-pot runs
    Then --dry-run writes nothing

  @test:scripts/tests/translate-pot.test.ts::the_CLI_over_a_translations_tree::no_catalogue_at_all_is_reported,_not_passed
  Scenario: No catalogue at all is reported, not passed
    Given the case in the CLI over a translations tree
    When translate-pot runs
    Then no catalogue at all is reported, not passed

