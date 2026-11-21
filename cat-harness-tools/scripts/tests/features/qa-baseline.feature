# Baselines and compute-and-judge (beans id4s, 0dav): a finding new against a
# baseline fails, an inherited one does not, and a missing baseline is
# unknown. The --against half runs against a real bare repository over
# file://. Each Scenario names the test that executes it.
Feature: QA results are judged against a baseline

  @test:scripts/tests/qa-baseline.test.ts::--against_parses_or_refuses_—_a_typo_is_never_a_missing_baseline::absent_→_undefined;_a_ref_→_the_ref;_a_bad_or_empty_ref_→_usage_error
  Scenario: --against parses a ref or refuses
    Then "--check" alone gives no ref
    And "--against main" gives "main" and "--against=pr/12" gives "pr/12"
    And "--against" with nothing, with "--strict" after it, or with "refs/heads/main" is a usage error

  @test:scripts/tests/qa-baseline.test.ts::the_working-copy_baseline,_in_four_states::miss_carries_no_text_—_there_is_nothing_to_read_as_clean
  Scenario: A missing working-copy baseline carries no text
    Given a root with no result file
    When its baseline is read
    Then the state is "miss" with no text
    And the result state is "absent"

  @test:scripts/tests/qa-baseline.test.ts::the_working-copy_baseline,_in_four_states::a_file_that_will_not_parse_is_corrupt,_never_stale_and_never_current
  Scenario: A baseline file that will not parse is corrupt
    Given a result file holding "{ not json"
    When its baseline is read
    Then the state is "corrupt"
    And the result state is "unreadable"

  @test:scripts/tests/qa-baseline.test.ts::the_working-copy_baseline,_in_four_states::valid_JSON_that_is_not_qa-results/v1_is_corrupt_as_a_RESULT
  Scenario: Valid JSON that is not qa-results/v1 is a corrupt result
    Given a result file holding {"rows": 3}
    Then reading it as a baseline is a "hit"
    And reading it as a QA result is "corrupt"

  @test:scripts/tests/qa-baseline.test.ts::the_working-copy_baseline,_in_four_states::hit:_current_when_identical,_stale_when_not
  Scenario: A baseline is current when identical and stale when not
    Given a written result with one finding {f: 1}
    Then its state against the same result is "current"
    And its state against a result with {f: 2} is "stale"

  @test:scripts/tests/qa-baseline.test.ts::new_vs_inherited::by_entry_identity,_independent_of_key_order
  Scenario: New and inherited findings are told apart by entry identity
    Given a baseline with findings {a:1,b:2} and {a:3}, and a fresh result with {b:2,a:1} and {a:4}
    When the findings of "bad" are diffed
    Then {a:4} is added, one is inherited and one is resolved

  @test:scripts/tests/qa-baseline.test.ts::new_vs_inherited::a_family_the_baseline_lacks_is_all_new
  Scenario: A family the baseline lacks is all new
    When a fresh result with {a:1} is diffed against an empty baseline
    Then {a:1} is added under "bad"

  @test:scripts/tests/qa-baseline.test.ts::compute_and_judge_against_the_working_copy_(the_pre-move_baseline)::a_SEEDED_new_finding_fails_(1);_the_same_finding_inherited_does_not_(0)
  Scenario: A seeded new finding fails and an inherited one does not
    Given a working-copy baseline with finding "old"
    When a fresh result with "old" and "new" is judged with failOnNew "bad"
    Then it exits 1 with "new" added
    When a fresh result with only "old" is judged
    Then it exits 0 with one inherited

  @test:scripts/tests/qa-baseline.test.ts::compute_and_judge_against_the_working_copy_(the_pre-move_baseline)::a_census_family_never_fails,_however_much_it_moved
  Scenario: A census family never fails
    Given a baseline with one census entry
    When a fresh result with three census entries is judged with failOnNew "bad"
    Then it exits 0

  @test:scripts/tests/qa-baseline.test.ts::compute_and_judge_against_the_working_copy_(the_pre-move_baseline)::failOn_is_absolute_against_the_working_copy:_the_author's_own_record_cannot_excuse_their_finding
  Scenario: failOn is absolute against the working copy
    Given a baseline with finding "old"
    When a fresh result with the same finding is judged with failOn "bad"
    Then it exits 1

  @test:scripts/tests/qa-baseline.test.ts::compute_and_judge_against_the_working_copy_(the_pre-move_baseline)::NO_baseline:_unknown,_reported,_and_not_a_failure_—_but_failOn_still_judged_in_full
  Scenario: No baseline is unknown and not a failure, but failOn is still judged
    Given a root with no baseline
    When a fresh result with a finding is judged with failOnNew "bad"
    Then it exits 0, the baseline is "miss", and one unknown says "not made"
    When the same result is judged with failOn "bad"
    Then it exits 1

  @test:scripts/tests/qa-baseline.test.ts::compute_and_judge_against_the_working_copy_(the_pre-move_baseline)::a_run_that_could_not_ask_part_of_its_question_is_2,_outranking_a_finding
  Scenario: An undetermined run exits 2, outranking a finding
    When a result with a finding is judged with failOn "bad" and undetermined "a source would not read"
    Then it exits 2

  @test:scripts/tests/qa-baseline.test.ts::compute_and_judge_--against_the_qa-reports_branch::a_seeded_new_finding_fails;_an_inherited_one_does_not,_even_under_failOn
  Scenario: Against the branch, a new finding fails and an inherited one does not
    Given a result with finding "old" published to qa-reports as main/<sha>, and the working copy removed
    When a fresh result with "old" and "new" is judged with failOn "bad" against "main"
    Then the baseline is a "hit" from "qa-reports:main/<sha>" and it exits 1
    When a fresh result with only "old" is judged
    Then it exits 0
    And the result state against "main" is "current"

  @test:scripts/tests/qa-baseline.test.ts::compute_and_judge_--against_the_qa-reports_branch::no_entry_on_the_branch:_unknown,_never_a_pass_of_the_split,_never_a_failure
  Scenario: No entry on the branch is unknown, never a failure
    Given a bare remote with nothing published
    When a fresh result with a finding is judged with failOnNew "bad" against "main"
    Then the baseline is "miss", it exits 0, and the unknowns name "qa-reports:main"
    And the result state against "main" is "absent"

  @test:scripts/tests/qa-baseline.test.ts::compute_and_judge_--against_the_qa-reports_branch::a_remote_that_cannot_be_reached_is_unknown_—_the_fifth_QaResultState,_never_current
  Scenario: An unreachable remote is unknown
    Given a store whose remote does not exist
    When the baseline is read against "main"
    Then the state is "unknown" with no text
