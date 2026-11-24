# The quiet-claim liveness sweep: a branch is a signal only for the beans it
# changes, a bulk ref is excluded and reported, and a sweep that could not
# determine is never a clean run. Fixture repositories are a throwaway origin
# with side branches, cloned. Each Scenario names the test that executes it.
Feature: Quiet-claim liveness

  @test:scripts/tests/quiet-claim-liveness.test.ts::a_reference_to_a_bean_is_bean-SHAPED,_never_a_bare_id_(thux's_trap)::the_qualified_form_is_a_reference
  Scenario: The qualified bean id is a reference
    Then "fixes folio-assistant-2634 at last" references bean "2634"

  @test:scripts/tests/quiet-claim-liveness.test.ts::a_reference_to_a_bean_is_bean-SHAPED,_never_a_bare_id_(thux's_trap)::the_backticked_bare_id_is_a_reference_—_how_beans_are_cited_in_prose_here
  Scenario: The backticked bare id is a reference
    Then "bean `2634` is the cause" references bean "folio-assistant-2634"

  @test:scripts/tests/quiet-claim-liveness.test.ts::a_reference_to_a_bean_is_bean-SHAPED,_never_a_bare_id_(thux's_trap)::a_bare_id_inside_a_version_string_is_NOT_—_the_measured_false_positive
  Scenario: A bare id inside a version string is not a reference
    Then "bump foo from 1.2634.0 to 1.2635.0" does not reference bean "2634"

  @test:scripts/tests/quiet-claim-liveness.test.ts::a_reference_to_a_bean_is_bean-SHAPED,_never_a_bare_id_(thux's_trap)::a_bare_id_as_a_plain_word_is_not_a_reference_either
  Scenario: A bare id as a plain word is not a reference
    Then "see 2634 for details" does not reference bean "2634"

  @test:scripts/tests/quiet-claim-liveness.test.ts::a_reference_to_a_bean_is_bean-SHAPED,_never_a_bare_id_(thux's_trap)::an_id_that_is_a_regex_metacharacter_run_does_not_throw_or_match_everything
  Scenario: An id made of regex metacharacters neither throws nor matches everything
    Then "anything at all" does not reference bean "a.*b"

  @test:scripts/tests/quiet-claim-liveness.test.ts::the_branch_signal_names_the_bean_it_is_about::a_branch_changing_one_bean_file_is_a_signal_for_THAT_bean_only
  Scenario: A branch changing one bean file is a signal for that bean only
    Given branches feature-x changing bean bbbb and feature-y changing bean cccc
    When the refs changing beans against origin/main are listed
    Then feature-x changes only bbbb's file and feature-y only cccc's

  @test:scripts/tests/quiet-claim-liveness.test.ts::the_branch_signal_names_the_bean_it_is_about::a_branch_that_merged_main_in_does_NOT_inherit_main's_bean_churn
  Scenario: A branch that merged main in does not inherit main's bean churn
    Given branch feature-x changing bean bbbb, and main then changing three other beans and being merged into feature-x
    When the refs changing beans against origin/main are listed
    Then feature-x changes only bbbb's file

  @test:scripts/tests/quiet-claim-liveness.test.ts::the_branch_signal_names_the_bean_it_is_about::a_merged_branch_is_not_live_work_at_all
  Scenario: A branch merged into main is not live work
    Given branch feature-x merged into main
    When the refs changing beans against origin/main are listed
    Then origin/feature-x is not among them

  @test:scripts/tests/quiet-claim-liveness.test.ts::the_branch_signal_names_the_bean_it_is_about::carries_the_ref's_tip_age,_so_an_abandoned_branch_is_visible_rather_than_counted_blind
  Scenario: A changing ref carries its tip's age
    Given branch feature-x changing one bean
    When the refs changing beans are listed
    Then the first carries a tip age of zero hours or more

  @test:scripts/tests/quiet-claim-liveness.test.ts::a_bulk_ref_is_excluded_from_the_signal_and_REPORTED::a_ref_changing_more_than_11_bean_files_is_bulk
  Scenario: A ref changing more than the bulk threshold of bean files
    # Gap: only that the ref's file list exceeds the threshold is asserted; that the sweep classes it bulk and excludes it is not
    Given a branch "sweep" changing one more bean file than the bulk threshold
    When the refs changing beans are listed
    Then sweep's file list is longer than the threshold

  @test:scripts/tests/quiet-claim-liveness.test.ts::a_bulk_ref_is_excluded_from_the_signal_and_REPORTED::the_threshold_sits_AT_the_measured_gap,_not_at_a_round_number
  Scenario: The bulk threshold sits at the measured gap
    Then the bulk threshold is 11 bean files

  @test:scripts/tests/quiet-claim-liveness.test.ts::a_bulk_ref_is_excluded_from_the_signal_and_REPORTED::the_excluded_refs_reach_the_report_—_an_exclusion_nobody_sees_is_a_silence_list
  Scenario: Excluded bulk refs reach the report
    Given a checked sweep whose bulk refs include "origin/claude/BULK-REF-NAME" changing 198 files
    When the report is formatted
    Then it names "BULK-REF-NAME" and "198"

  @test:scripts/tests/quiet-claim-liveness.test.ts::could_not_determine_is_never_a_clean_run::an_undetermined_sweep_reports_no_quiet_claims_at_all
  Scenario: An undetermined sweep reports no quiet claims
    Given an undetermined sweep with the reason "THE-STATED-REASON"
    When the report is formatted
    Then it says "COULD NOT DETERMINE", gives the reason and says "not a clean run"
    And it has no "QUIET — no open PR" line

  @test:scripts/tests/quiet-claim-liveness.test.ts::could_not_determine_is_never_a_clean_run::ref_freshness_is_part_of_the_evidence,_and_the_limit_is_short_on_purpose
  Scenario: The ref freshness limit is short
    # Gap: only the constant is checked; that a stale ref makes the sweep undetermined is not exercised
    Then the ref freshness limit is at most 30 minutes

  @test:scripts/tests/quiet-claim-liveness.test.ts::could_not_determine_is_never_a_clean_run::a_repo_with_no_GitHub_origin_is_undetermined,_not_quiet
  Scenario: A repository with no GitHub origin has no origin slug
    # Gap: only that no slug is derived is asserted; that the sweep is then undetermined rather than quiet is not
    Given a clone whose origin is a local path
    Then no origin slug is derived

  @test:scripts/tests/quiet-claim-liveness.test.ts::this_repository::can_establish_how_stale_its_own_refs_are
  Scenario: The freshness probe runs against this repository
    Given this checkout has origin refs and a FETCH_HEAD, or the test is skipped
    When the age of this repository's fetched refs is read
    Then it is established, as zero minutes or more
