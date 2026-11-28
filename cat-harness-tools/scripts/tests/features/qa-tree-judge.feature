# Compute-and-judge over a tree of sidecars (bean oqe3): kg:audit:check,
# kg:audit:all:check and translation:block-qa:check judge a new finding
# against a baseline, report an unreadable baseline as unknown, and write
# nothing. The branch half runs against a real bare repository over file://.
# A test sidecar is {"f": [findings]}. Each Scenario names the test that
# executes it.
Feature: A tree of QA sidecars is judged against its baseline

  @test:scripts/tests/qa-tree-judge.test.ts::judging_a_tree_against_the_working_copy_(an_unstored_directory)::new_mode:_a_SEEDED_new_finding_fails_(1);_the_same_finding_inherited_does_not_(0)
  Scenario: In new mode a seeded new finding fails and an inherited one does not
    Given a working-copy sidecar "a.json" with finding "old"
    When fresh findings "old" and "new" are judged in new mode
    Then it exits 1 with "new" added for "a.json"
    When fresh finding "old" alone is judged
    Then it exits 0 with one inherited

  @test:scripts/tests/qa-tree-judge.test.ts::judging_a_tree_against_the_working_copy_(an_unstored_directory)::a_subject_with_no_sidecar_yet_is_new_—_a_determined_miss,_not_an_unknown
  Scenario: A subject with no sidecar yet is new
    When a finding for a subject with no sidecar is judged in new mode
    Then it exits 1 and the baseline state is "hit"

  @test:scripts/tests/qa-tree-judge.test.ts::judging_a_tree_against_the_working_copy_(an_unstored_directory)::absolute_mode_against_the_working_copy:_the_author's_own_record_cannot_excuse_their_finding
  Scenario: Absolute mode fails a finding the working copy already holds
    Given a working-copy sidecar with finding "old"
    When fresh finding "old" is judged in absolute mode
    Then it exits 1

  @test:scripts/tests/qa-tree-judge.test.ts::judging_a_tree_against_the_working_copy_(an_unstored_directory)::a_baseline_that_will_not_parse_is_reported_unknown_for_that_sidecar
  Scenario: A baseline that will not parse is unknown for that sidecar
    Given a working-copy sidecar holding "{ nope"
    When a finding for it is judged in new mode
    Then it exits 0 and the unknowns name "a.json"

  @test:scripts/tests/qa-tree-judge.test.ts::judging_a_tree_against_the_working_copy_(an_unstored_directory)::extraFailing_(a_committed_file_out_of_date)_fails;_undetermined_outranks_it_(2)
  Scenario: extraFailing fails, and undetermined outranks it
    Given fresh sidecars with no findings
    Then judging with one extra failing item exits 1
    And judging with it and an undetermined reason exits 2

  @test:scripts/tests/qa-tree-judge.test.ts::judging_a_tree_--against_the_qa-reports_branch::absolute_mode:_a_seeded_new_finding_fails;_inherited_ones_do_not;_a_subject_the_entry_lacks_is_new
  Scenario: Against the branch, inherited findings pass and new ones or new subjects fail
    Given "a.json" with finding "old" published at main/<sha> and the working copy removed
    When fresh "a.json" with "old" is judged in absolute mode against "main"
    Then the baseline is a hit from "qa-reports:main/<sha>" and it exits 0
    When fresh "a.json" with "old" and "new" is judged
    Then it exits 1 with one failing
    When fresh "a.json" with "old" and a new subject "b.json" are judged
    Then it exits 1 with only "b.json" added

  @test:scripts/tests/qa-tree-judge.test.ts::judging_a_tree_--against_the_qa-reports_branch::no_entry_on_the_branch:_ONE_unknown,_never_N_new_subjects_—_new_mode_does_not_fail,_absolute_judges_in_full
  Scenario: No entry on the branch is one unknown, not every subject new
    Given a remote with nothing published
    When a finding is judged in new mode against "main"
    Then the baseline is "unknown", it exits 0, nothing is added, and exactly one unknown says "no baseline"
    And in absolute mode it exits 1

  @test:scripts/tests/qa-tree-judge.test.ts::judging_a_tree_--against_the_qa-reports_branch::an_unreachable_remote_is_unknown_—_never_a_pass_of_the_split
  Scenario: An unreachable remote is unknown
    Given a remote that does not exist
    When a finding is judged in new mode against "main"
    Then the baseline is "unknown" and it exits 0

  @test:scripts/tests/qa-tree-judge.test.ts::what_kg:audit:check_grades::fail_and_unknown_at_the_gate's_severity,_per_finding;_a_lower_severity_and_a_pass_are_not_graded
  Scenario: kg:audit:check grades fail and unknown at the gate's severity, per finding
    Given a critical criterion failing with two findings and a minor one failing with one
    Then grading at "critical" gives 2 findings, and at "critical" and "minor" gives 3
    And a passing critical criterion grades nothing
    And an unknown critical criterion grades one "unknown" item

  @test:scripts/tests/qa-tree-judge.test.ts::what_kg:audit:check_grades::a_second_finding_in_a_subject_that_already_failed_is_NEW,_not_hidden_behind_the_first
  Scenario: A second finding in a subject that already failed is new
    Given a kg sidecar whose graded findings are a critical "one"
    When fresh graded findings "one" and "two" are judged in absolute mode
    Then only the critical "two" is added

  @test:scripts/tests/qa-tree-judge.test.ts::what_kg:audit:check_grades::KG_QA_SCHEMA_is_what_a_baseline_sidecar_must_declare_to_be_read
  Scenario: The KG QA schema id
    # Gap: the title says a baseline sidecar must declare it to be read; the body checks only that the constant is "kg-qa/v1".
    Then KG_QA_SCHEMA is "kg-qa/v1"

  @test:scripts/tests/qa-tree-judge.test.ts::what_translation:block-qa:check_grades::only_`fail`,_by_substance:_a_re-run's_timestamp_and_script_hash_do_not_make_an_inherited_finding_new
  Scenario: translation:block-qa:check grades only fail, by substance
    Given a translation report with a failing "translation-urls" and a warning "translation-acronyms", and another with only the failing one under a new timestamp and script hash
    When each is graded
    Then the first grades only "translation-urls" with severity "major" and its evidence
    And both grade to identical JSON

  @test:scripts/tests/qa-tree-judge.test.ts::the_gate_CLIs_in_judge_mode::an_unknown_flag_is_a_usage_error_(2)_before_anything_is_computed
  Scenario: An unknown flag is a usage error in each gate CLI
    When kg-audit.ts, kg-audit-all.ts and translation-block-qa.ts each run with "--check --chek"
    Then each exits 2 saying "unknown flag"

  @test:scripts/tests/qa-tree-judge.test.ts::the_gate_CLIs_in_judge_mode::a_malformed_--against_is_a_usage_error_(2),_never_a_missing_baseline
  Scenario: A malformed --against is a usage error
    When kg-audit.ts runs with "--check --against refs/heads/main"
    Then it exits 2

  @test:scripts/tests/qa-tree-judge.test.ts::the_gate_CLIs_in_judge_mode::kg:audit:check_--against_a_branch_with_no_entry:_UNKNOWN_reported,_not_gated,_and_nothing_written
  Scenario: kg:audit:check against a branch with no entry reports unknown and writes nothing
    Given an empty bare remote as the store
    When kg-audit.ts runs with "--check --against main"
    Then its output says "judge mode, wrote nothing" and "UNKNOWN"
    And it exits 0 or 1
    And git status of the checkout is unchanged

  @test:scripts/tests/qa-tree-judge.test.ts::the_gate_CLIs_in_judge_mode::translation:block-qa:check_on_one_chapter:_judges,_writes_nothing,_and_the_missing_baseline_is_UNKNOWN
  Scenario: translation:block-qa:check on one chapter judges and writes nothing
    Given an empty bare remote as the store
    When translation-block-qa.ts runs with "--check --root docs/source/process-crdm-methodology --against main"
    Then its output says "judge mode, wrote nothing" and "no baseline to split NEW from inherited"
    And it exits 0
    And git status of the checkout is unchanged
