# A change may not publish a translated page without its .po (bean 3sm2).
# Each Scenario names the test that executes it.
Feature: Translation catalogue gate

  @test:scripts/tests/translation-catalogue.test.ts::the_real_corpus_—_the_map_the_gate_reads::is_non-empty_—_otherwise_every_run_of_this_gate_is_vacuously_clean
  Scenario: The harness's translation map is not empty
    When the harness's translations are mapped by file
    Then the map exists and has at least one entry

  @test:scripts/tests/translation-catalogue.test.ts::the_real_corpus_—_the_map_the_gate_reads::every_key_is_a_file_that_exists,_so_the_mapping_is_not_composing_paths
  Scenario: Every mapped file exists
    Then every key of the harness's translation map is an existing file

  @test:scripts/tests/translation-catalogue.test.ts::the_real_corpus_—_the_map_the_gate_reads::keys_are_absolute,_which_is_what_makes_the_git_comparison_location-independent
  Scenario: Every mapped file is absolute
    Then every key of the harness's translation map starts with "/"

  @test:scripts/tests/translation-catalogue.test.ts::addedFiles_distinguishes_`no_additions`_from_`could_not_tell`::a_ref_git_cannot_resolve_is_undefined,_never_an_empty_list
  Scenario: An unresolvable since-ref cannot tell
    Then the files added since "no-such-ref-3sm2" are undefined

  @test:scripts/tests/translation-catalogue.test.ts::addedFiles_distinguishes_`no_additions`_from_`could_not_tell`::a_resolvable_range_answers_with_a_list
  Scenario: A resolvable range answers a list
    Then the files added since "HEAD" are a list

  @test:scripts/tests/translation-catalogue.test.ts::addedFiles_distinguishes_`no_additions`_from_`could_not_tell`::two_dots_and_three_dots_agree_whenever_HEAD_contains_the_base
  Scenario: Two-dot and three-dot ranges agree when HEAD contains the base
    # Gap: returns early with no assertion when HEAD does not contain origin/main (or the ref is missing), so it can pass without comparing anything.
    Given HEAD contains origin/main
    Then the files added in the three-dot range and in the two-dot range from origin/main are the same set

  @test:scripts/tests/translation-catalogue.test.ts::addedFiles_distinguishes_`no_additions`_from_`could_not_tell`::a_base_ref_git_cannot_resolve_is_undefined,_not_an_empty_list
  Scenario: An unresolvable base ref cannot tell
    Then the files added from base "no-such-base-3sm2" are undefined

  @test:scripts/tests/translation-catalogue.test.ts::uncatalogued_reports_exactly_the_added_translations_with_no_catalogue::a_translation_with_no_catalogue_is_reported,_with_the_path_to_author
  Scenario: An added translation with no catalogue is reported
    Given a layer with "translations/fr/has-one.po" only
    When the French page "none" is added
    Then "fr/none" is reported with the catalogue path "translations/fr/none.po"

  @test:scripts/tests/translation-catalogue.test.ts::uncatalogued_reports_exactly_the_added_translations_with_no_catalogue::a_translation_WHOSE_catalogue_the_change_already_carries_is_not_reported
  Scenario: An added translation with its catalogue is not reported
    Given a layer with "translations/fr/has-one.po"
    When the French page "has-one" is added
    Then nothing is reported

  @test:scripts/tests/translation-catalogue.test.ts::uncatalogued_reports_exactly_the_added_translations_with_no_catalogue::an_added_file_that_is_not_a_published_translation_is_ignored_entirely
  Scenario: Added files that are not translations are ignored
    When a script and a README are added
    Then nothing is reported

  @test:scripts/tests/translation-catalogue.test.ts::uncatalogued_reports_exactly_the_added_translations_with_no_catalogue::no_additions_at_all_is_a_determined_empty,_not_a_finding
  Scenario: No additions report nothing
    When nothing is added
    Then nothing is reported

  @test:scripts/tests/translation-catalogue.test.ts::baseFromEnv_—_the_step_registers_ONE_gate,_so_the_range_comes_from_the_env::a_sha_is_returned
  Scenario: The base comes from CATALOGUE_BASE_SHA
    Then CATALOGUE_BASE_SHA "deadbeef" gives base "deadbeef"

  @test:scripts/tests/translation-catalogue.test.ts::baseFromEnv_—_the_step_registers_ONE_gate,_so_the_range_comes_from_the_env::an_EMPTY_string_is_no_base_at_all,_which_is_how_the_argv_version_failed
  Scenario: An empty base is no base
    Then CATALOGUE_BASE_SHA "" and "   " give no base

  @test:scripts/tests/translation-catalogue.test.ts::baseFromEnv_—_the_step_registers_ONE_gate,_so_the_range_comes_from_the_env::an_absent_variable_is_no_base,_so_the_run_falls_back_to_three_dots
  Scenario: An absent variable is no base
    # Gap: the fallback to three dots named in the title is not exercised; only the undefined base is.
    Then an environment without CATALOGUE_BASE_SHA gives no base
