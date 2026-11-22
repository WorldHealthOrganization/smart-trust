# The CI cone wiring in .github/scripts/layer-pr-checks: run-gates.py asks a stubbed ci-cone.ts
# which gates are unchanged and SKIPS them, never passes them; merge-shards.py, compare-gates.py,
# merge-cone.py and merge-results.py carry that through. Each Scenario names the test that executes it.
Feature: The CI cone in the layer PR checks

  @test:test/layer-pr-checks-cone.test.ts::run-gates.py_GATE_CONE=skip::a_gate_the_cone_says_is_unchanged_is_SKIPPED_with_its_sha,_has_no_exit,_and_is_never_counted_as_run
  Scenario: A gate the cone says is unchanged is skipped with its sha and never counted as run
    Given a root with layers b and c, three passing gates each, and the cone saying "check:b-one" is unchanged since "abc123"
    When run-gates.py runs with GATE_CONE "skip"
    Then it exits 0
    And gate "b:check:b-one" has no exit, unchanged "abc123", and a skipped reason "inputs unchanged since abc123"
    And the shard lists it as unchanged and not as ran
    And gate "b:check:b-two" ran with exit 0
    And the output says "b:check:b-one: SKIPPED — inputs unchanged since abc123" and never that it passed

  @test:test/layer-pr-checks-cone.test.ts::run-gates.py_GATE_CONE=skip::the_set_is_still_covered:_ran_and_unchanged_together_are_every_gate_of_the_shard
  Scenario: Ran and unchanged gates together cover the shard
    Given the cone saying "check:b-one" and "check:c-two" are unchanged
    When run-gates.py runs with GATE_CONE "skip"
    Then the number of ran plus unchanged gates equals the shard's total

  @test:test/layer-pr-checks-cone.test.ts::run-gates.py_GATE_CONE=skip::decide-all_is_asked_once,_before_any_gate,_for_the_declared_`bun_run_cat_<script>`_gates_only
  Scenario: decide-all is asked once, before any gate, for the declared bun run cat gates only
    Given a cone stub with no decisions
    When run-gates.py runs with GATE_CONE "skip"
    Then the stub is called once, with "decide-all"
    And the scripts it is asked about are the six layer gates, the checkout gates and the index-gates.json gates
    And nothing else is asked of the cone

  @test:test/layer-pr-checks-cone.test.ts::run-gates.py_GATE_CONE=skip::%s_runs_the_gate_(fail-closed)
  Scenario: A decision that does not clearly skip runs the gate
    Given a cone decision for "check:b-one" that is one of: a skip with no sha, a skip that is not literally true, or no decision at all
    When run-gates.py runs with GATE_CONE "skip"
    Then gate "b:check:b-one" runs with exit 0
    And no gate is unchanged

  @test:test/layer-pr-checks-cone.test.ts::run-gates.py_GATE_CONE=skip::decide-all_failing_runs_every_gate,_and_says_why
  Scenario: decide-all failing runs every gate and says why
    Given a cone whose decide-all exits 3
    When run-gates.py runs with GATE_CONE "skip"
    Then no gate is unchanged and "b:check:b-one" ran with exit 0
    And the output says "decide-all exited 3"

  @test:test/layer-pr-checks-cone.test.ts::run-gates.py_GATE_CONE=skip::no_ci-cone.ts_at_this_side's_pin_runs_every_gate,_and_says_so
  Scenario: No ci-cone.ts at this side's pin runs every gate and says so
    Given no cone CLI
    When run-gates.py runs with GATE_CONE "skip"
    Then no gate is unchanged
    And the output says "ci-cone.ts is absent at this side's pin"

  @test:test/layer-pr-checks-cone.test.ts::run-gates.py_GATE_CONE=skip::GATE_CONE_unset:_the_cone_is_never_asked
  Scenario: With GATE_CONE unset the cone is never asked
    Given a cone that would skip "check:b-one"
    When run-gates.py runs with no GATE_CONE
    Then the cone is not called
    And gate "b:check:b-one" ran with exit 0

  @test:test/layer-pr-checks-cone.test.ts::run-gates.py_GATE_CONE=skip::an_unknown_GATE_CONE_is_off,_and_says_so
  Scenario: An unknown GATE_CONE is off and says so
    Given a cone that would skip "check:b-one"
    When run-gates.py runs with GATE_CONE "maybe"
    Then the cone is not called
    And the output says "neither skip nor record"

  @test:test/layer-pr-checks-cone.test.ts::run-gates.py_GATE_CONE=skip::a_record_whose_read_set_lies_in_its_own_instance's_tree_is_reported_own-tree,_not_the_caller_(2b,_derived)
  Scenario: A skipped gate reading only its own instance's tree is reported own-tree
    Given stored records where "check:b-one" read only under b/ and "check:b-two" also read the root package.json
    And the cone skipping both
    When run-gates.py runs with GATE_CONE "skip"
    Then the skip reason for "b:check:b-one" says "reads only b/ (own tree, not the caller)"
    And the skip reason for "b:check:b-two" does not say "own tree", and it is unchanged "abc123"

  @test:test/layer-pr-checks-cone.test.ts::run-gates.py_footprint_(2b):_derived_from_the_record,_never_declared::the_top-level_entries_of_its_reads_and_of_its_git_calls'_cwd;_`.`_for_the_root_itself
  Scenario: A record's footprint is the top-level entries of its reads and git cwds
    Given a record reading "b", "b/x", "b/y/z" and "bun.lock" with a git call in "c/d"
    When run-gates.py computes its footprint
    Then it is "b", "bun.lock" and "c"
    And a record reading and running git at the root has footprint "."

  @test:test/layer-pr-checks-cone.test.ts::run-gates.py_footprint_(2b):_derived_from_the_record,_never_declared::an_unreadable_git_key_is_an_unknown_directory,_so_never_own-tree
  Scenario: An unreadable git key makes a footprint never own-tree
    Given a record reading "b/x" with a git key that is not JSON
    When own_tree is asked for instance "b"
    Then the answer is false

  @test:test/layer-pr-checks-cone.test.ts::run-gates.py_footprint_(2b):_derived_from_the_record,_never_declared::no_record_has_no_footprint,_and_the_root_is_no_instance's_own_tree
  Scenario: No record has no footprint, and the root is no instance's own tree
    When the footprint of no record is taken
    Then it is empty
    And own_tree of footprint "." for "." is false

  @test:test/layer-pr-checks-cone.test.ts::run-gates.py_GATE_CONE=record::candidates_that_do_not_skip_run_through_`ci-cone.ts_run`,_after_the_rest;_the_shard's_records_are_written
  Scenario: Candidates that do not skip run through ci-cone.ts run, and the shard's records are written
    # Skipped: when strace cannot run here
    Given stored records for "check:c-three" and a script not in this shard
    And the cone skipping "check:b-one" and naming "check:b-two" and "check:c-three" as candidates, with only "check:b-two" recording
    When run-gates.py runs with GATE_CONE "record"
    Then it exits 0
    And the cone runs exactly "check:b-two" and "check:c-three"
    And gate "b:check:b-two" exits 0 with command "bun run cat check:b-two"
    And gate "b:check:b-one" is unchanged "old"
    And cone-records.json holds only "check:b-two"

  @test:test/layer-pr-checks-cone.test.ts::run-gates.py_GATE_CONE=record::a_gate_that_matched_keeps_the_record_it_matched
  Scenario: A gate that matched keeps the record it matched
    # Skipped: when strace cannot run here
    Given a stored record for "check:b-one" at sha "old" and the cone skipping it
    When run-gates.py runs with GATE_CONE "record"
    Then cone-records.json keeps "check:b-one" at sha "old"

  @test:test/layer-pr-checks-cone.test.ts::run-gates.py_GATE_CONE=record::pooled_candidates_are_traced_side_by_side;_a_record_whose_reads_a_neighbour_wrote_is_dropped_and_the_gate_runs_again_alone
  Scenario: Pooled candidates are traced side by side and a disturbed record's gate runs again alone
    # Skipped: when strace cannot run here
    Given four candidates traced in parallel, where "check:c-three" writes b/x.json and b/new.json
    And "check:b-one" read b/x.json, "check:b-two" listed b, and "check:c-one" read b/new.json
    When run-gates.py runs with GATE_CONE "record", 4 jobs and parallel tracing
    Then it exits 0
    And b-one, b-two and c-one each run twice and c-three once
    And one keep call files c-three's record only
    And the output says each of b-one, b-two and c-one runs again alone because c-three wrote what it read or listed
    And the output says c-three wrote inside the checkout while judging
    And cone-records.json holds all four scripts

  @test:test/layer-pr-checks-cone.test.ts::run-gates.py_GATE_CONE=record::a_neighbour_whose_writes_are_not_known_disturbs_every_run_beside_it;_runs_that_did_not_overlap_are_kept
  Scenario: A neighbour whose writes are not known disturbs the run beside it
    # Skipped: when strace cannot run here
    Given two candidates traced in parallel, where "check:b-two" reports its trace undetermined
    When run-gates.py runs with GATE_CONE "record" and parallel tracing
    Then the output says b-one runs again alone because b-two's writes are not known
    And b-one runs twice and b-two once

  @test:test/layer-pr-checks-cone.test.ts::run-gates.py_GATE_CONE=record::a_gate_that_fails_beside_others_keeps_no_record_and_is_judged_by_a_run_alone;_its_neighbours_keep_theirs
  Scenario: A gate that fails beside others keeps no record and is judged alone
    # Skipped: when strace cannot run here
    Given three candidates traced in parallel, where "check:b-one" fails beside others and passes alone
    When run-gates.py runs with GATE_CONE "record" and parallel tracing
    Then it exits 0 and "b:check:b-one" exits 0
    And b-one runs twice and b-two once
    And the output says b-one "runs again alone: it failed beside other gates"
    And one keep call files the records of b-two and c-one

  @test:test/layer-pr-checks-cone.test.ts::run-gates.py_GATE_CONE=record::GATE_CONE_PARALLEL=0,_or_a_ci-cone.ts_without_the_touched_report,_traces_one_at_a_time_with_the_shared_record_file
  Scenario: Without parallel tracing, gates are traced one at a time with the shared record file
    # Skipped: when strace cannot run here
    Given two candidates and 4 jobs but no GATE_CONE_PARALLEL
    When run-gates.py runs with GATE_CONE "record"
    Then no keep call is made
    And the cone runs "check:b-one" and "check:b-two"
    And cone-records.json holds only "check:b-one"

  @test:test/layer-pr-checks-cone.test.ts::run-gates.py_GATE_CONE=record::without_strace_nothing_is_traced,_and_it_says_so;_a_match_still_skips
  Scenario: Without strace nothing is traced, and a match still skips
    Given a PATH holding only python3 and a passing bun, with no strace
    And the cone skipping "check:b-one" and naming "check:b-two" a candidate
    When run-gates.py runs with GATE_CONE "record"
    Then the cone runs nothing
    And the output says "strace does not run here"
    And gate "b:check:b-one" is unchanged "abc123"

  @test:test/layer-pr-checks-cone.test.ts::merge-shards.py_with_cone-skipped_gates::an_unchanged_gate_counts_toward_covering_the_set
  Scenario: An unchanged gate counts toward covering the set
    Given a shard of 2 gates, one ran and one unchanged with its record sha
    When merge-shards.py merges it
    Then it exits 0

  @test:test/layer-pr-checks-cone.test.ts::merge-shards.py_with_cone-skipped_gates::an_unchanged_gate_with_no_record_sha_is_could-not-determine
  Scenario: An unchanged gate with no record sha cannot be determined
    Given a shard of 2 gates, one ran and one listed unchanged with no record sha
    When merge-shards.py merges it
    Then it exits 2
    And its output says "no unchanged record"

  @test:test/layer-pr-checks-cone.test.ts::merge-shards.py_with_cone-skipped_gates::a_gate_both_ran_and_unchanged_is_could-not-determine
  Scenario: A gate both ran and unchanged cannot be determined
    Given a shard of 1 gate listed both as ran and as unchanged
    When merge-shards.py merges it
    Then it exits 2

  @test:test/layer-pr-checks-cone.test.ts::compare-gates.py_with_cone-skipped_gates::unchanged_on_head_is_SKIPPED_with_its_reason,_never_a_pass,_and_never_fails_the_PR
  Scenario: Unchanged on head is SKIPPED with its reason and never fails the PR
    Given gate g failed on base and is unchanged since "abc" on head
    When compare-gates.py compares them
    Then it exits 0
    And the table row reads base 1, head "unchanged since abc", "SKIPPED — inputs unchanged since abc (3 paths)"
    And no row says pass

  @test:test/layer-pr-checks-cone.test.ts::compare-gates.py_with_cone-skipped_gates::unchanged_on_both_sides_is_SKIPPED,_not_pass
  Scenario: Unchanged on both sides is SKIPPED, not pass
    Given gate g unchanged since "abc" on base and head
    When compare-gates.py compares them
    Then it exits 0
    And the output says "SKIPPED — inputs unchanged since abc"
    And no row says pass

  @test:test/layer-pr-checks-cone.test.ts::compare-gates.py_with_cone-skipped_gates::unchanged_on_base_stands_for_its_green_run:_a_head_failure_against_it_is_NEW
  Scenario: Unchanged on base stands for its green run, so a head failure is new
    Given gate g unchanged on base and exiting 1 on head
    When compare-gates.py compares them
    Then it exits 1
    And the output says "NEW FAILURE"

  @test:test/layer-pr-checks-cone.test.ts::compare-gates.py_with_cone-skipped_gates::unchanged_on_base,_head_could_not_determine:_NEW
  Scenario: Unchanged on base with head could not determine is new
    Given gate g unchanged on base and exiting 2 on head
    When compare-gates.py compares them
    Then it exits 1
    And the output says "NEW: could not determine"

  @test:test/layer-pr-checks-cone.test.ts::compare-gates.py_with_cone-skipped_gates::passed_on_base,_head_could_not_determine:_labelled_could_not_determine,_still_counted
  Scenario: Passed on base with head could not determine is labelled could not determine and counted
    Given gate g exiting 0 on base and 2 on head
    When compare-gates.py compares them
    Then it exits 1
    And the table row reads base 0, head 2, "NEW: could not determine"
    And the output does not say "NEW FAILURE"

  @test:test/layer-pr-checks-cone.test.ts::compare-gates.py_with_cone-skipped_gates::unchanged_on_base,_head_passes:_pass
  Scenario: Unchanged on base with head passing is a pass
    Given gate g unchanged on base and exiting 0 on head
    When compare-gates.py compares them
    Then it exits 0
    And the table row reads base "unchanged since abc", head 0, "pass"

  @test:test/layer-pr-checks-cone.test.ts::compare-gates.py_with_a_gate_main_did_not_run::not_applicable_(78)_on_head,_absent_on_base:_listed,_not_counted
  Scenario: Not applicable on head, absent on base, is listed and not counted
    Given gate g absent on base and exiting 78 on head
    When compare-gates.py compares them
    Then it exits 0
    And the table row reads "not applicable here; main did not run it, so not counted"

  @test:test/layer-pr-checks-cone.test.ts::compare-gates.py_with_a_gate_main_did_not_run::could_not_determine_(2)_on_head,_absent_on_base:_listed,_not_counted
  Scenario: Could not determine on head, absent on base, is listed and not counted
    Given gate g absent on base and exiting 2 on head
    When compare-gates.py compares them
    Then it exits 0
    And the output says "could not determine; main did not run it, so not counted"

  @test:test/layer-pr-checks-cone.test.ts::compare-gates.py_with_a_gate_main_did_not_run::a_plain_failure_on_head,_absent_on_base,_is_still_NEW
  Scenario: A plain failure on head, absent on base, is still new
    Given gate g absent on base and exiting 1 on head
    When compare-gates.py compares them
    Then it exits 1
    And the output says "NEW FAILURE"

  @test:test/layer-pr-checks-cone.test.ts::compare-gates.py_with_a_gate_main_did_not_run::not_applicable_(78)_on_head_where_base_passed_is_listed_with_main's_answer,_not_counted_(#1701)
  Scenario: Not applicable on head where base passed is listed with main's answer and not counted
    Given gate g exiting 0 on base and 78 on head
    When compare-gates.py compares them
    Then it exits 0
    And the output says "not applicable here; not counted (main exited 0)"

  @test:test/layer-pr-checks-cone.test.ts::merge-cone.py::the_shards'_records_joined,_in_ci-cone.ts's_records.json_shape,_at_this_run's_sha
  Scenario: The shards' cone records join into one records.json at this run's sha
    Given two base shards recording scripts a and b
    When merge-cone.py merges them at sha "mainsha"
    Then it exits 0
    And records.json is version 2, recipe 1, sha "mainsha", with checks a and b

  @test:test/layer-pr-checks-cone.test.ts::merge-cone.py::a_missing_shard_is_left_out_with_a_warning:_its_gates_have_no_record,_so_they_run
  Scenario: A missing shard is left out with a warning
    # Gap: that the missing shard's gates then run is not checked here.
    Given two base shards, the second with no cone-records.json
    When merge-cone.py merges them
    Then it exits 0 with a "::warning::"
    And records.json holds only script a

  @test:test/layer-pr-checks-cone.test.ts::merge-cone.py::two_shards_recording_one_script,_or_disagreeing_on_the_version,_keep_nothing
  Scenario: Two shards recording one script, or disagreeing on the version, keep nothing
    Given two base shards that both record script a
    When merge-cone.py merges them
    Then it exits 2 and writes no records.json
    And two shards with versions 2 and 3 also exit 2 and write nothing

  @test:test/layer-pr-checks-cone.test.ts::merge-cone.py::no_records_anywhere_keeps_nothing
  Scenario: No records anywhere keeps nothing
    Given one base shard with no checks
    When merge-cone.py merges it
    Then it exits 0 and writes no records.json

  @test:test/layer-pr-checks-cone.test.ts::merge-results.py:_the_shards'_result_stores,_unioned,_newest_16_per_gate::two_shards'_stores_union_into_one,_an_entry_both_carried_is_kept_once,_and_ci-cone.ts_reads_it_back
  Scenario: Two shards' result stores union into one, keeping a shared entry once
    Given two result stores written by result-store.ts for gate "x:check", sharing one entry
    When merge-results.py merges them, with one absent store also named
    Then it exits 0 and says "3 result(s) of 1 gate(s) kept"
    And result-store.ts lists the merged entries newest first as 3, 2, 1

  @test:test/layer-pr-checks-cone.test.ts::merge-results.py:_the_shards'_result_stores,_unioned,_newest_16_per_gate::past_16_per_gate_the_oldest_go,_and_an_unreadable_file_is_dropped
  Scenario: Past 16 results per gate the oldest are dropped
    # Gap: that the unreadable junk.json is dropped is only implied by a clean exit and the count.
    Given two result stores holding 24 results for gate "x:check", one with an unreadable junk.json
    When merge-results.py merges them
    Then it exits 0
    And 16 results are kept, the newest 23 first and the oldest kept 8
