# state:drift: a seeded state branch still matches the ref it was seeded from,
# over real git and a local bare remote. Each Scenario names the test that
# executes it.
Feature: State branch drift

  @test:scripts/tests/state-drift.test.ts::candidatesOf::canonical_first,_then_legacy_—_the_file's_own_resolution_rule,_with_ONE_implementation
  Scenario: Candidates are the canonical branch, then the legacy names
    Then a branch entry cat/h/qa with legacy cat-qa and qa yields cat/h/qa, cat-qa, qa

  @test:scripts/tests/state-drift.test.ts::candidatesOf::a_`family`_is_a_branch_PREFIX,_not_a_branch,_so_it_is_not_compared
  Scenario: A branch family has no candidates
    Then a family entry yields no candidates

  @test:scripts/tests/state-drift.test.ts::drift_against_the_seeded_ref::identical_trees_are_in-sync,_and_the_row_says_which_two_commits_it_compared
  Scenario: Identical trees are in sync
    Given a beans seed taken from main's tip
    When drift is measured
    Then the beans row is "in-sync" and its detail names "vs main@"

  @test:scripts/tests/state-drift.test.ts::drift_against_the_seeded_ref::a_file_changed_on_the_SOURCE_ref_is_drift,_named_—_this_is_the_state_a_cutover_must_not_run_in
  Scenario: A file changed on the source ref is drift
    Given main changes beans/defs/a.md after the seed
    When drift is measured
    Then the row is "drift" naming "M defs/a.md"

  @test:scripts/tests/state-drift.test.ts::drift_against_the_seeded_ref::a_file_added_on_the_BRANCH_is_drift_too:_a_seed_somebody_wrote_to_directly_is_not_current_either
  Scenario: A file added on the seed branch is drift
    Given a file is committed straight to the seed branch
    When drift is measured
    Then the row is "drift" naming "D defs/b.md"

  @test:scripts/tests/state-drift.test.ts::drift_against_the_seeded_ref::a_commit_on_the_source_ref_that_did_not_touch_the_subgraph_is_NOT_drift_—_trees,_not_commit_distance
  Scenario: A source commit outside the subgraph is not drift
    Given main gains a commit outside beans/
    When drift is measured
    Then the row is "in-sync"

  @test:scripts/tests/state-drift.test.ts::the_three_answers_that_are_not_drift::a_branch_with_no_root_manifest_is_`not-a-seed`,_not_`unknown`_—_gh-pages_is_healthy
  Scenario: A branch with no root manifest is not a seed
    Given the branch is a copy of main with no manifest
    Then the row is "not-a-seed"

  @test:scripts/tests/state-drift.test.ts::the_three_answers_that_are_not_drift::`authoritative:_true`_has_no_source_ref_to_be_current_with
  Scenario: An authoritative store is not compared
    Given the manifest says status store and authoritative true
    Then the row is "authoritative"

  @test:scripts/tests/state-drift.test.ts::the_three_answers_that_are_not_drift::`status:_retired`_is_NAMED_and_not_compared,_even_with_real_drift_under_it
  Scenario: A retired seed is named and not compared
    Given a retired seed with a reason, and main changed since
    Then the row is "retired" with no files and its detail is the retired reason

  @test:scripts/tests/state-drift.test.ts::the_three_answers_that_are_not_drift::a_branch_that_is_not_on_the_remote_is_`unknown`_—_never_reported_as_in-sync
  Scenario: A branch missing from the remote is unknown
    When drift is measured for cat/x/absent
    Then the row is "unknown" saying "no such branch"

  @test:scripts/tests/state-drift.test.ts::the_three_answers_that_are_not_drift::a_manifest_with_no_`source.ref`_is_`unknown`:_there_is_nothing_to_be_current_WITH
  Scenario: A manifest with no source ref is unknown
    Given a seed whose manifest has an empty source
    Then the row is "unknown"

  @test:scripts/tests/state-drift.test.ts::the_three_answers_that_are_not_drift::a_subgraph_path_absent_from_one_side_is_`unknown`,_not_an_empty_diff
  Scenario: A subgraph path absent from one side is unknown
    Given a seed whose manifest names the graph path "nowhere"
    Then the row is "unknown" saying "nowhere is not on"

  @test:scripts/tests/state-drift.test.ts::brief_—_the_session-start_form::silent_when_every_seed_is_current:_a_section_printed_every_time_is_a_section_people_skip
  Scenario: The brief is silent when nothing drifts
    Then the brief of in-sync, retired and not-a-seed rows is empty

  @test:scripts/tests/state-drift.test.ts::brief_—_the_session-start_form::counts,_not_paths_—_the_superseded_branch_alone_carried_159_and_would_bury_the_sweep
  Scenario: The brief counts files rather than listing them
    Given a drift row with 159 changed files
    Then the brief says "159 file(s) behind main@bbb" and lists no file

  @test:scripts/tests/state-drift.test.ts::brief_—_the_session-start_form::says_`main`_is_still_the_store,_so_a_reader_does_not_over-read_a_stale_seed_as_a_broken_work-plan
  Scenario: The brief says main is still the store
    Given a drift row
    Then the brief says "`main` is still the store" and "It breaks the cutover"

  @test:scripts/tests/state-drift.test.ts::brief_—_the_session-start_form::an_`unknown`_is_carried_too_—_it_is_a_finding,_not_a_quiet_pass
  Scenario: The brief carries an unknown row
    Given an unknown row whose detail is "could not reach it"
    Then the brief says "could not determine: could not reach it"

  @test:scripts/tests/state-drift.test.ts::exitCodeFor::drift_is_1,_unknown_is_4,_and_neither_is_0
  Scenario: Exit codes for drift and unknown
    Then in-sync, not-a-seed and authoritative rows exit 0
    And an unknown row exits 4
    And a drift row exits 1

  @test:scripts/tests/state-drift.test.ts::exitCodeFor::drift_outranks_unknown:_the_actionable_finding_is_the_one_the_exit_code_should_carry
  Scenario: Drift outranks unknown
    Then unknown and drift rows together exit 1

  @test:scripts/tests/state-drift.test.ts::exitCodeFor::an_EMPTY_report_is_not_a_pass_by_accident_—_it_is_0_because_there_was_nothing_to_compare
  Scenario: An empty report exits 0
    Then no rows exit 0

  @test:scripts/tests/state-drift.test.ts::observed,_not_tabled_(bean_rva2)::every_cat/**_branch_on_the_remote_is_a_row,_and_one_no_directory_declares_is_marked_undeclared
  Scenario: Every cat/** branch on the remote is observed
    Given a remote with cat/fx/declared, cat/fx/stray and feature/not-special, and a declaration storing d on cat/fx/declared
    When the observed rows are read
    Then they are cat/fx/declared as d, declared, and cat/fx/stray, undeclared

  @test:scripts/tests/state-drift.test.ts::observed,_not_tabled_(bean_rva2)::a_remote_that_cannot_be_listed_is_undefined,_never_an_empty_set
  Scenario: An unlistable remote gives no rows at all
    Then observing a remote that does not exist gives undefined
