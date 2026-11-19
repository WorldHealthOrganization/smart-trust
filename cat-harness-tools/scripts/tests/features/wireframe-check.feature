# wireframe:check takes use, topic and surface and uses each; these drive the
# argv-to-run resolution. Each Scenario names the test that executes it.
Feature: Wireframe check inputs

  Background:
    Given a checkout with as-is wireframes for "beans" and "navbar", an unmarked "harness-config" pair, and design proposals "new-board" (two candidates) and "lonely" (one)
    And an index saying "beans" covers "cat-harness/beans" and "navbar" covers nothing

  @test:scripts/tests/wireframe-check.test.ts::the_three_inputs_are_required,_and_typed_as_the_Tool_types_them::each_missing_flag_is_refused_by_name
  Scenario: Each missing flag is refused by name
    Then omitting --use, --topic or --surface is refused with "<flag> is required"

  @test:scripts/tests/wireframe-check.test.ts::the_three_inputs_are_required,_and_typed_as_the_Tool_types_them::a_value_outside_the_type_is_refused,_a_shell_payload_included
  Scenario: Values outside the type are refused
    Then --use "redesign" is refused with "--use must be one of"
    And --topic "Beans; rm -rf /" is refused as not kebab-case
    And --surface "$(id)" is refused

  @test:scripts/tests/wireframe-check.test.ts::the_three_inputs_are_required,_and_typed_as_the_Tool_types_them::an_unknown_flag,_or_a_flag_with_no_value,_is_refused
  Scenario: Unknown flags and flags without values are refused
    Then "--bogus x" throws "unknown flag"
    And "--use" alone throws "needs a value"

  @test:scripts/tests/wireframe-check.test.ts::--topic_scopes_which_wireframes_are_checked::with_no_candidates,_it_checks_every_.html_of_the_topic's_directory,_and_the_report_goes_to_its_checks/
  Scenario: With no candidates the topic's directory is checked
    When as-is "beans" is run for surface "cat-harness/beans"
    Then the candidates are the topic's "as-is.html", the asset directory is the topic's and the output is its "checks"
    And the run carries the use, topic and surface given

  @test:scripts/tests/wireframe-check.test.ts::--topic_scopes_which_wireframes_are_checked::design_use_looks_in_the_proposal's_asset_directory
  Scenario: Design use looks in the proposal
    When design "new-board" is run
    Then the asset directory is the proposal's wireframes and there are 2 candidates

  @test:scripts/tests/wireframe-check.test.ts::--topic_scopes_which_wireframes_are_checked::a_candidate_outside_the_topic's_directory_is_refused
  Scenario: A candidate outside the topic is refused
    Then as-is "beans" with the navbar wireframe as candidate is refused with "not in it"

  @test:scripts/tests/wireframe-check.test.ts::--topic_scopes_which_wireframes_are_checked::a_candidate_inside_it_is_taken_as_given,_and_--out_still_wins
  Scenario: A candidate inside the topic is used and --out wins
    When as-is "beans" is run with its own wireframe as candidate and --out "elsewhere"
    Then the candidates are that wireframe and the output is "elsewhere" under the checkout

  @test:scripts/tests/wireframe-check.test.ts::--topic_scopes_which_wireframes_are_checked::a_topic_with_no_directory_is_refused_rather_than_checking_nothing
  Scenario: A topic with no directory is refused
    Then as-is "no-such" is refused with 'no wireframes for topic "no-such"'

  @test:scripts/tests/wireframe-check.test.ts::--use_sets_the_rule_for_the_candidate_set::design_compares_at_least_two_candidates
  Scenario: Design needs two candidates
    Then design "lonely" is refused with 'at least two candidates; topic "lonely" has 1'

  @test:scripts/tests/wireframe-check.test.ts::--use_sets_the_rule_for_the_candidate_set::design_may_still_sit_in_docs/wireframes/<topic>/,_where_older_design_work_is
  Scenario: Design may sit in docs/wireframes
    Then design "harness-config" finds 2 candidates

  @test:scripts/tests/wireframe-check.test.ts::--use_sets_the_rule_for_the_candidate_set::as-is_candidates_are_marked_as-is
  Scenario: As-is candidates must be marked as-is
    Then as-is "harness-config" is refused with "not marked: a.html, b.html"

  @test:scripts/tests/wireframe-check.test.ts::--surface_must_be_what_an_as-is_wireframe_covers::a_ref_the_index_lists_for_the_topic,_or_the_topic_itself_for_shared_chrome
  Scenario: The surface must be covered by the as-is wireframe
    Then as-is "navbar" with surface "navbar" is accepted
    And as-is "beans" with surface "cat-harness/todos" is refused, listing "beans, cat-harness/beans"

  @test:scripts/tests/wireframe-check.test.ts::check:wireframes_reads_the_recorded_topic::a_report_written_for_another_topic_is_not_counted_as_this_wireframe's
  Scenario: A report for another topic does not count
    Given wireframe "beans" whose checks report was written for topic "todos"
    When the wireframes are checked
    Then "beans" is incomplete because the report "was written for topic \"todos\""

  @test:scripts/tests/wireframe-check.test.ts::check:wireframes_reads_each_instance's_own_index_(cat-harness-tools#281)::a_second_instance's_wireframe_is_named_<instance>/<topic>_and_judged_by_its_bare_topic
  Scenario: A second instance's wireframe is named with its prefix
    Given two instances each with wireframe "page" and a report for topic "page"
    When both are checked, the second with prefix "content-layer/"
    Then neither is refused for its topic
    And the incomplete names include "page" and "content-layer/page"
