# run-gates.py splits the layer PR-check gates into shards (GATE_SHARD, GATE_TIMINGS), merge-shards.py joins
# one side's shards and fails could-not-determine on a missing one, and snapshot.py carries the prepared tree
# to each shard. Each Scenario names the test that executes it.
Feature: Layer PR-check gates split into shards judge the same set as one job

  @test:test/layer-pr-checks-shards.test.ts::run-gates.py_GATE_SHARD::the_fixture_derives_a_gate_set_big_enough_to_split
  Scenario: The fixture derives a gate set big enough to split
    Given a fixture root declaring layer "a" with 17 gate scripts and a "build" script
    When run-gates.py lists its gates
    Then there are more than 17
    And "a:build" is not among them

  @test:test/layer-pr-checks-shards.test.ts::run-gates.py_GATE_SHARD::1/1_is_today's_set,_in_today's_order
  Scenario: Shard 1/1 is the unsharded set in the same order
    Given the fixture root
    When run-gates.py lists its gates with GATE_SHARD "1/1"
    Then the gate names are the unsharded names in the same order
    And the gates and the skipped gates equal the unsharded run's

  @test:test/layer-pr-checks-shards.test.ts::run-gates.py_GATE_SHARD::%d_shards_are_disjoint,_and_their_union_is_the_unsharded_set
  Scenario: N shards are disjoint, balanced and union to the unsharded set
    Given the fixture root and a shard count of 2, 3, 4 or 7
    When run-gates.py lists each shard i of N
    Then each reports shard i of N over the total gate count
    And each gate's command is the unsharded command
    And each shard's size is within one gate of the total divided by N
    And no gate appears in two shards
    And together the shards hold exactly the unsharded gates

  @test:test/layer-pr-checks-shards.test.ts::run-gates.py_GATE_SHARD::the_slice_is_the_same_on_every_call_(base_and_head_split_alike)
  Scenario: The same shard is the same slice on every call
    Given the fixture root
    When run-gates.py lists shard "2/3" twice
    Then both lists of gates are equal

  @test:test/layer-pr-checks-shards.test.ts::run-gates.py_GATE_SHARD::a_malformed_GATE_SHARD_(%s)_exits_2,_never_a_guessed_slice
  Scenario: A malformed GATE_SHARD exits 2 without a guessed slice
    Given GATE_SHARD is one of "0/4", "5/4", "1/0", "x", "1/2/3" or "-1/4"
    When run-gates.py lists the fixture's gates
    Then it exits 2
    And it prints nothing on stdout

  @test:test/layer-pr-checks-shards.test.ts::run-gates.py_GATE_TIMINGS_(cat-harness-tools#397)::shards_split_by_recorded_seconds_stay_disjoint_and_cover_the_set
  Scenario: Shards split by recorded seconds stay disjoint and cover the set
    Given a timings file where "a:check:g07" took 1000 seconds and every other gate far less
    When run-gates.py lists shards 1 to 4 of 4 with GATE_TIMINGS set
    Then no gate appears in two shards
    And together the shards hold exactly the unsharded gates

  @test:test/layer-pr-checks-shards.test.ts::run-gates.py_GATE_TIMINGS_(cat-harness-tools#397)::the_slowest_gate_gets_a_shard_to_itself
  Scenario: The slowest gate gets a shard to itself
    Given the timings file where "a:check:g07" took 1000 seconds
    When run-gates.py lists shards 1 to 4 of 4 with GATE_TIMINGS set
    Then the shard holding "a:check:g07" holds nothing else

  @test:test/layer-pr-checks-shards.test.ts::run-gates.py_GATE_TIMINGS_(cat-harness-tools#397)::the_split_is_the_same_on_every_call
  Scenario: The timed split is the same on every call
    Given the timings file
    When run-gates.py lists shard "3/4" twice with GATE_TIMINGS set
    Then both lists are equal

  @test:test/layer-pr-checks-shards.test.ts::run-gates.py_GATE_TIMINGS_(cat-harness-tools#397)::an_absent_timings_file_falls_back_to_the_count_split
  Scenario: An absent timings file falls back to the count split
    Given GATE_TIMINGS names a file that does not exist
    When run-gates.py lists shard "2/4"
    Then the list equals shard 2/4 with no timings

  @test:test/layer-pr-checks-shards.test.ts::run-gates.py_shard_names_weighs_alone_gates_by_wall_time::an_alone_gate_costs_its_whole_seconds,_pooled_ones_their_sum_over_GATE_JOBS
  Scenario: An alone gate's wall time keeps the pooled gates off its shard
    Given one 500-second gate "a:check:alone" that runs alone and forty 25-second pooled gates
    When shard_names splits them into 2 shards with 4 jobs at once
    Then the shard holding "a:check:alone" holds nothing else

  @test:test/layer-pr-checks-shards.test.ts::run-gates.py_shard_names_weighs_alone_gates_by_wall_time::with_GATE_JOBS_1_the_split_is_the_summed-seconds_split
  Scenario: With GATE_JOBS 1 the split is the summed-seconds split
    Given the same timings with "a:check:alone" marked alone
    When shard_names splits them into 2 shards with 1 job at once
    Then the shard sizes are 11 and 30
    And the split equals the one with no gate marked alone

  @test:test/layer-pr-checks-shards.test.ts::run-gates.py_shard_names_weighs_alone_gates_by_wall_time::eight_shards_stay_disjoint,_cover_the_set_and_agree_across_calls
  Scenario: Eight timed shards stay disjoint, cover the set and agree across calls
    Given the same timings with "a:check:alone" marked alone
    When shard_names splits them into 8 shards with 4 jobs at once
    Then no gate appears in two shards
    And together the shards hold every gate
    And a second call gives the same split

  @test:test/layer-pr-checks-shards.test.ts::merge-shards.py::every_gate_records_its_wall_time
  Scenario: Every gate records its wall time
    Given an unsharded run of the fixture root's gates
    Then every gate's entry in gates.json has a numeric seconds

  @test:test/layer-pr-checks-shards.test.ts::merge-shards.py::four_joined_shards_hold_the_same_verdicts_as_one_unsharded_run
  Scenario: Four merged shards hold the same verdicts as one unsharded run
    Given the fixture's gates run as 4 head shards, each with its own junit report
    When merge-shards.py joins the 4 head shards
    Then it exits 0
    And every gate's command and exit equal the unsharded run's
    And the merged junit report says tests="10" and holds the test cases "t1" to "t4"

  @test:test/layer-pr-checks-shards.test.ts::merge-shards.py::a_missing_shard_is_could-not-determine,_never_a_pass
  Scenario: A missing shard is could-not-determine, never a pass
    Given head shards 1, 2 and 4 of 4 but not 3
    When merge-shards.py joins the head shards
    Then it exits 2
    And it says "results-head-3 is missing"
    And it writes no gates.json

  @test:test/layer-pr-checks-shards.test.ts::merge-shards.py::a_shard_missing_one_of_its_files_is_could-not-determine
  Scenario: A shard missing one of its files is could-not-determine
    Given 4 head shards where shard 2 has no gates.json
    When merge-shards.py joins the head shards
    Then it exits 2

  @test:test/layer-pr-checks-shards.test.ts::merge-shards.py::shards_of_another_N,_or_a_side_with_fewer_shards_than_expected,_are_could-not-determine
  Scenario: Shards of another N or a side with no shards are could-not-determine
    Given 4 head shards
    When merge-shards.py joins them expecting 3 shards, it exits 2
    And expecting 5 shards, it exits 2
    And joining the base side, which has no shards, exits 2

  @test:test/layer-pr-checks-shards.test.ts::merge-shards.py::a_shard_that_dropped_a_gate_it_was_given_is_could-not-determine
  Scenario: A shard that dropped a gate it was given is could-not-determine
    Given 4 head shards where shard 3's gates-shard.json lists one gate fewer as ran
    When merge-shards.py joins the head shards
    Then it exits 2
    And it says "of a set of"

  @test:test/layer-pr-checks-shards.test.ts::snapshot.py_(cat-harness-tools#397)::a_shard_that_applies_the_snapshot_holds_the_prepared_tree,_a_moved-in_caller_included
  Scenario: Applying the snapshot gives a shard the prepared tree, a moved-in caller included
    Given a prepared root with a mounted "caller", a shard copied from it, and a mark of the mounted files
    And the caller replaced by a checkout with a changed "a.ts" and a new "new.ts" and without "gone.ts"
    And a new "derived.json", branch-mount files "beans.json" and "issue-marks.absent", and a ".git/HEAD"
    When snapshot.py saves the prepared root and applies it to the shard
    Then the shard's "caller/a.ts" and "caller/new.ts" read "the PR"
    And "caller/gone.ts" is gone
    And "derived.json" exists and "kept.ts" still reads "mounted"
    And both branch-mount files exist
    And ".git/HEAD" is not carried

  @test:test/layer-pr-checks-shards.test.ts::snapshot.py_(cat-harness-tools#397)::a_directory_the_PR_emptied_is_gone_from_the_shard,_not_left_empty_(cat-harness#390)
  Scenario: A directory the PR emptied is gone from the shard
    Given a prepared root whose mounted caller has "tools/github/github.ts" and "kept.ts"
    And the caller replaced by a checkout with an empty "tools" directory and a changed "kept.ts"
    When snapshot.py saves the prepared root and applies it to a shard copied before the change
    Then the shard has no "caller/tools/github"
    And its "caller/kept.ts" reads "the PR"
