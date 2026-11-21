# The address of a QA result (bean bejf, issue #2217): a stored result is
# linked on its storage branch under one named entry, never at blob/main.
# Each Scenario names the test that executes it.
Feature: A QA result links to where it is stored

  @test:scripts/tests/qa-result-link.test.ts::qaResultHref::a_stored_result_with_a_known_entry_is_addressed_on_the_branch,_under_that_entry
  Scenario: A stored result with a known entry is addressed under that entry
    When the href of a stored translation result is made for entry main/<sha>
    Then it is addressed by "entry" at "<forge>/blob/<branch>/main/<sha>/<path>"

  @test:scripts/tests/qa-result-link.test.ts::qaResultHref::a_PR_entry_is_addressed_the_same_way
  Scenario: A PR entry is addressed the same way
    When the href is made for entry pr/12/<sha>
    Then it is "<forge>/blob/<branch>/pr/12/<sha>/<path>"

  @test:scripts/tests/qa-result-link.test.ts::qaResultHref::a_stored_result_with_no_entry_known_opens_the_tip's_index,_and_says_so
  Scenario: A stored result with no known entry opens the tip's index
    When the href of a stored result is made with no entry
    Then it is addressed by "tip" at "<forge>/blob/<branch>/index.json"

  @test:scripts/tests/qa-result-link.test.ts::qaResultHref::a_result_in_a_directory_that_declares_no_storage_keeps_its_main_address
  Scenario: A result whose directory declares no storage keeps its main address
    When the href of "x/test/results/a.json" with no storage is made
    Then it is addressed by "main" at "<forge>/blob/main/x/test/results/a.json"

  @test:scripts/tests/qa-result-link.test.ts::qaResultHref::a_stored_result_never_gets_a_blob/main_href,_whatever_the_inputs
  Scenario: A stored result never gets a blob/main href
    When the href of a stored result is made with no entry, a main entry, or a PR entry
    Then none contains "/blob/main/"

  @test:scripts/tests/qa-result-link.test.ts::qaResultHref::no_forge:_no_href_rather_than_a_guessed_one
  Scenario: No forge gives no href
    When the href is made without a forge URL, stored or not
    Then there is no href

  @test:scripts/tests/qa-result-link.test.ts::qaResultHref::a_trailing_slash_or_.git_on_the_forge_URL_does_not_leak_into_the_href
  Scenario: A trailing slash or .git on the forge URL does not leak into the href
    Then the forge URL with ".git" and with a trailing "/" both give "<forge>/blob/main/<path>"

  @test:scripts/tests/qa-result-link.test.ts::qaResultHref::segments_are_percent-encoded,_separators_are_not
  Scenario: Path segments are percent-encoded and separators are not
    When the href of "a b/c#d.json" is made
    Then it ends "/blob/main/a%20b/c%23d.json"

  @test:scripts/tests/qa-result-link.test.ts::qaResultHref::a_path_that_is_not_repo-relative_is_refused,_not_composed_(the_instance-relative_defect)
  Scenario: A path that is not repo-relative is refused
    When the href of "../smart-base/test/results/x.json" is made
    Then it throws

  @test:scripts/tests/qa-result-link.test.ts::qaResultHref::a_key_that_is_a_search_(main,_a_prefix)_is_refused:_an_address_names_one_entry
  Scenario: A key that is a search is refused
    When the href is made with key "main" or "main/941df8d"
    Then it throws

  @test:scripts/tests/qa-result-link.test.ts::linkKeyFromFetchState:_the_entry_the_page's_evidence_came_from::fetched:_the_entry_read
  Scenario: A fetched state links the entry read
    Then a "fetched" state with key main/<sha> links main/<sha>

  @test:scripts/tests/qa-result-link.test.ts::linkKeyFromFetchState:_the_entry_the_page's_evidence_came_from::fetched-fallback:_the_fallback_entry_read,_which_IS_the_evidence_shown
  Scenario: A fallback fetch links the fallback entry
    Then a "fetched-fallback" state with another commit's key links that key

  @test:scripts/tests/qa-result-link.test.ts::linkKeyFromFetchState:_the_entry_the_page's_evidence_came_from::checkout:_the_build's_own_ref,_because_the_checkout_IS_that_commit's_evidence
  Scenario: A checkout links the build's own ref
    Then a "checkout" state requesting main/<sha> links main/<sha>
    And it still links main/<sha> when it carries another commit's key

  @test:scripts/tests/qa-result-link.test.ts::linkKeyFromFetchState:_the_entry_the_page's_evidence_came_from::checkout_with_no_full_key_requested_(a_dispatch_run_asks_for_`main`):_unknown
  Scenario: A checkout with no full key requested links nothing
    Then a "checkout" state requesting only "main" links nothing

  @test:scripts/tests/qa-result-link.test.ts::linkKeyFromFetchState:_the_entry_the_page's_evidence_came_from::unavailable:_nothing_to_name
  Scenario: An unavailable state links nothing
    Then an "unavailable" state links nothing

  @test:scripts/tests/qa-result-link.test.ts::where_the_state_is_read_from::CI's_RUNNER_TEMP,_or_an_explicit_QA_SITE_STATE,_and_nothing_local_by_default
  Scenario: The fetch state is read from CI's temp directory or an explicit path
    Then with RUNNER_TEMP "/r" the state path is "/r/qa-site-assets.state.json"
    And QA_SITE_STATE "/s.json" wins over RUNNER_TEMP
    And with neither there is no link key

  @test:scripts/tests/qa-result-link.test.ts::this_repository's_declaration::its_derived_translation_results_are_stored,_so_their_link_is_on_the_branch,_never_blob/main
  Scenario: This repository's derived translation results are linked on the branch
    When the link for a translation result in this repository is made for main/<sha>
    Then its path is repo-relative, addressed by "entry", at "<forge>/blob/cat/cat-harness/qa-reports/main/<sha>/<path>"

  @test:scripts/tests/qa-result-link.test.ts::this_repository's_declaration::a_location_resolved_once_and_passed_in_gives_the_same_address_as_resolving_per_call_(#871)
  Scenario: A location resolved once gives the same address as resolving per call
    Given this repository's QA location resolved once
    Then for a translation result and for "cat-harness/docs/index.md" the link with it passed in equals the link without it
