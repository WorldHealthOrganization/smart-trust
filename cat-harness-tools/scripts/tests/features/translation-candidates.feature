# scripts/translation-candidates.ts collects candidate translations from open, self-hosted engines
# (OPUS-MT, a self-hosted LibreTranslate) through the one writer, addCandidates: candidates are
# appended to <catalogue>.candidates.json, a candidate whose placeholders do not round-trip is not
# recorded, and an EMPTY msgstr gets the first good candidate, fuzzy. Each Scenario names the test
# that executes it.
Feature: Candidate translations from open engines

  @test:scripts/tests/translation-candidates.test.ts::placeholder_guard::finds_the_tokens_a_translation_must_keep
  Scenario: Finds the tokens a translation must keep
    Given the case in placeholder guard
    When candidates are collected
    Then finds the tokens a translation must keep

  @test:scripts/tests/translation-candidates.test.ts::placeholder_guard::accepts_a_reordered_but_complete_translation
  Scenario: Accepts a reordered but complete translation
    Given the case in placeholder guard
    When candidates are collected
    Then accepts a reordered but complete translation

  @test:scripts/tests/translation-candidates.test.ts::placeholder_guard::refuses_a_lost,_renamed,_duplicated_or_translated_placeholder
  Scenario: Refuses a lost, renamed, duplicated or translated placeholder
    Given the case in placeholder guard
    When candidates are collected
    Then refuses a lost, renamed, duplicated or translated placeholder

  @test:scripts/tests/translation-candidates.test.ts::placeholder_guard::refuses_lost_line_breaks_and_an_empty_answer
  Scenario: Refuses lost line breaks and an empty answer
    Given the case in placeholder guard
    When candidates are collected
    Then refuses lost line breaks and an empty answer

  @test:scripts/tests/translation-candidates.test.ts::placeholder_guard::a_checked_candidate_gets_the_source's_surrounding_whitespace_back
  Scenario: A checked candidate gets the source's surrounding whitespace back
    Given the case in placeholder guard
    When candidates are collected
    Then a checked candidate gets the source's surrounding whitespace back

  @test:scripts/tests/translation-candidates.test.ts::masking::placeholders_become_numbered_stand-ins_and_come_back
  Scenario: Placeholders become numbered stand-ins and come back
    Given the case in masking
    When candidates are collected
    Then placeholders become numbered stand-ins and come back

  @test:scripts/tests/translation-candidates.test.ts::masking::the_source's_own_bracketed_numbers_are_not_taken_as_stand-ins
  Scenario: The source's own bracketed numbers are not taken as stand-ins
    Given the case in masking
    When candidates are collected
    Then the source's own bracketed numbers are not taken as stand-ins

  @test:scripts/tests/translation-candidates.test.ts::masking::a_dropped_or_duplicated_stand-in_is_still_caught_by_the_guard
  Scenario: A dropped or duplicated stand-in is still caught by the guard
    Given the case in masking
    When candidates are collected
    Then a dropped or duplicated stand-in is still caught by the guard


  @test:scripts/tests/translation-candidates.test.ts::which_entries_are_translated::a_catalogue_that_forbids_machine_filling_is_recognised
  Scenario: A catalogue that forbids machine filling is recognised
    Given the case in which entries are translated
    When candidates are collected
    Then a catalogue that forbids machine filling is recognised

  @test:scripts/tests/translation-candidates.test.ts::which_entries_are_translated::a_catalogue_started_from_its_template_names_the_locale_and_says_unofficial
  Scenario: A catalogue started from its template names the locale and says unofficial
    Given the case in which entries are translated
    When candidates are collected
    Then a catalogue started from its template names the locale and says unofficial

  @test:scripts/tests/translation-candidates.test.ts::mergeCandidates:_the_never-overwrite_rule_and_the_first-candidate_fill::every_non-empty_msgstr_is_kept_byte-for-byte;_each_empty_one_gets_the_first_candidate,_fuzzy
  Scenario: Every non-empty msgstr is kept byte-for-byte; each empty one gets the first candidate, fuzzy
    Given the case in mergeCandidates: the never-overwrite rule and the first-candidate fill
    When candidates are collected
    Then every non-empty msgstr is kept byte-for-byte; each empty one gets the first candidate, fuzzy

  @test:scripts/tests/translation-candidates.test.ts::mergeCandidates:_the_never-overwrite_rule_and_the_first-candidate_fill::appending_the_same_text_from_the_same_source_twice_adds_nothing
  Scenario: Appending the same text from the same source twice adds nothing
    Given the case in mergeCandidates: the never-overwrite rule and the first-candidate fill
    When candidates are collected
    Then appending the same text from the same source twice adds nothing

  @test:scripts/tests/translation-candidates.test.ts::mergeCandidates:_the_never-overwrite_rule_and_the_first-candidate_fill::a_candidate_that_breaks_a_placeholder_is_not_recorded_and_does_not_fill
  Scenario: A candidate that breaks a placeholder is not recorded and does not fill
    Given the case in mergeCandidates: the never-overwrite rule and the first-candidate fill
    When candidates are collected
    Then a candidate that breaks a placeholder is not recorded and does not fill

  @test:scripts/tests/translation-candidates.test.ts::mergeCandidates:_the_never-overwrite_rule_and_the_first-candidate_fill::when_the_first_source_fails_the_guard,_the_next_good_candidate_fills
  Scenario: When the first source fails the guard, the next good candidate fills
    Given the case in mergeCandidates: the never-overwrite rule and the first-candidate fill
    When candidates are collected
    Then when the first source fails the guard, the next good candidate fills

  @test:scripts/tests/translation-candidates.test.ts::mergeCandidates:_the_never-overwrite_rule_and_the_first-candidate_fill::a_candidate_for_an_entry_the_catalogue_does_not_have_is_refused
  Scenario: A candidate for an entry the catalogue does not have is refused
    Given the case in mergeCandidates: the never-overwrite rule and the first-candidate fill
    When candidates are collected
    Then a candidate for an entry the catalogue does not have is refused

  @test:scripts/tests/translation-candidates.test.ts::mergeCandidates:_the_never-overwrite_rule_and_the_first-candidate_fill::a_web-service_import_can_skip_the_guard_(a_person_wrote_it),_and_still_never_overwrites
  Scenario: A web-service import can skip the guard (a person wrote it), and still never overwrites
    Given the case in mergeCandidates: the never-overwrite rule and the first-candidate fill
    When candidates are collected
    Then a web-service import can skip the guard (a person wrote it), and still never overwrites

  @test:scripts/tests/translation-candidates.test.ts::sources::OPUS-MT_models,_with_the_target_token_the_multi-target_ones_need
  Scenario: OPUS-MT models, with the target token the multi-target ones need
    Given the case in sources
    When candidates are collected
    Then OPUS-MT models, with the target token the multi-target ones need

  @test:scripts/tests/translation-candidates.test.ts::sources::the_OPUS-MT_runner_gets_one_JSON_request_and_returns_translations
  Scenario: The OPUS-MT runner gets one JSON request and returns translations
    Given the case in sources
    When candidates are collected
    Then the OPUS-MT runner gets one JSON request and returns translations

  @test:scripts/tests/translation-candidates.test.ts::sources::LibreTranslate:_self-hosted_only,_recorded_as_open_MT
  Scenario: LibreTranslate: self-hosted only, recorded as open MT
    Given the case in sources
    When candidates are collected
    Then LibreTranslate: self-hosted only, recorded as open MT

  @test:scripts/tests/translation-candidates.test.ts::sources::an_unknown_engine_name_is_refused,_naming_the_known_ones
  Scenario: An unknown engine name is refused, naming the known ones
    Given the case in sources
    When candidates are collected
    Then an unknown engine name is refused, naming the known ones

  @test:scripts/tests/translation-candidates.test.ts::collectCandidates_over_a_layer::several_sources_become_candidates;_the_first_fills;_the_node_records_it;_the_forbidden_catalogue_is_untouched
  Scenario: Several sources become candidates; the first fills; the node records it; the forbidden catalogue is untouched
    Given the case in collectCandidates over a layer
    When candidates are collected
    Then several sources become candidates; the first fills; the node records it; the forbidden catalogue is untouched

  @test:scripts/tests/translation-candidates.test.ts::collectCandidates_over_a_layer::an_official_node_gets_candidates_but_no_fill;_a_dry_run_writes_nothing
  Scenario: An official node gets candidates but no fill; a dry run writes nothing
    Given the case in collectCandidates over a layer
    When candidates are collected
    Then an official node gets candidates but no fill; a dry run writes nothing

  @test:scripts/tests/translation-candidates.test.ts::collectCandidates_over_a_layer::--init_starts_a_catalogue_from_its_template_and_fills_it;_a_missing_node_is_created_and_validates
  Scenario: --init starts a catalogue from its template and fills it; a missing node is created and validates
    Given the case in collectCandidates over a layer
    When candidates are collected
    Then --init starts a catalogue from its template and fills it; a missing node is created and validates

  @test:scripts/tests/translation-candidates.test.ts::collectCandidates_over_a_layer::an_invalid_node_or_candidates_file_refuses_the_catalogue;_--no-create-node_records_without_filling
  Scenario: An invalid node or candidates file refuses the catalogue; --no-create-node records without filling
    Given the case in collectCandidates over a layer
    When candidates are collected
    Then an invalid node or candidates file refuses the catalogue; --no-create-node records without filling

  @test:scripts/tests/translation-candidates.test.ts::collectCandidates_over_a_layer::addCandidates_is_the_shared_entry_point_other_sources_call
  Scenario: AddCandidates is the shared entry point other sources call
    Given the case in collectCandidates over a layer
    When candidates are collected
    Then addCandidates is the shared entry point other sources call

  @test:scripts/tests/translation-candidates.test.ts::placeholder_guard::TeX_math,_liquid_tags_and_Markdown_strong/strike_markers_are_kept_too
  Scenario: TeX math, liquid tags and Markdown strong/strike markers are kept too
    Given the case in placeholder guard
    When candidates are collected
    Then TeX math, liquid tags and Markdown strong/strike markers are kept too

  @test:scripts/tests/translation-candidates.test.ts::which_entries_are_translated::empty_and_fuzzy_entries,_plural_ones_included;_never_a_reviewed_one
  Scenario: Empty and fuzzy entries, plural ones included; never a reviewed one
    Given the case in which entries are translated
    When candidates are collected
    Then empty and fuzzy entries, plural ones included; never a reviewed one

  @test:scripts/tests/translation-candidates.test.ts::which_entries_are_translated::a_plural_a_person_has_started_is_left_to_them
  Scenario: A plural a person has started is left to them
    Given the case in which entries are translated
    When candidates are collected
    Then a plural a person has started is left to them

  @test:scripts/tests/translation-candidates.test.ts::collectCandidates_over_a_layer::addCandidates_takes_a_region-tagged_locale_(pt-BR)_and_creates_its_node
  Scenario: AddCandidates takes a region-tagged locale (pt-BR) and creates its node
    Given the case in collectCandidates over a layer
    When candidates are collected
    Then addCandidates takes a region-tagged locale (pt-BR) and creates its node

  @test:scripts/tests/translation-candidates.test.ts::masking::a_mangled_stand-in_is_refused,_never_leaked_into_the_text_(bean_cat-tools-ph0s)
  Scenario: A mangled stand-in is refused, never leaked into the text (bean cat-tools-ph0s)
    Given the case in masking
    When candidates are collected
    Then a mangled stand-in is refused, never leaked into the text (bean cat-tools-ph0s)
