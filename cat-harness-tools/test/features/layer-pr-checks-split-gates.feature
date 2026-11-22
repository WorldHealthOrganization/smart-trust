# run-gates.py runs the slow check:cat-harness-tools-standalone gate as four parts spread across shards,
# and names the gate set's scripts to skill-register.ts (verified_by_gates). Each Scenario names the test that executes it.
Feature: The slow standalone gate runs as parts, one per shard

  @test:test/layer-pr-checks-split-gates.test.ts::run-gates.py_split_gates::the_standalone_gate_becomes_four_parts,_in_its_place,_each_one_slice
  Scenario: The standalone gate becomes four parts in its place
    Given gates "t:a:check", the cat-harness-tools standalone gate and "t:b:check"
    When run-gates.py splits the gates
    Then the standalone gate is replaced, in its position, by parts #1/4 to #4/4
    And part 3/4 runs "bun run cat check:cat-harness-tools-standalone --part 3/4"
    And the whole gate is no longer listed

  @test:test/layer-pr-checks-split-gates.test.ts::run-gates.py_split_gates::parts_inherit_alone,_and_a_quarter_of_the_whole_gate's_seconds_until_they_have_their_own
  Scenario: Parts inherit alone and a quarter of the whole gate's seconds until they have their own
    Given the standalone gate is marked alone and took 500 seconds, and part 2/4 has its own 90 seconds
    When run-gates.py splits the gates
    Then part 1/4 is timed at 125 seconds
    And part 2/4 keeps 90 seconds
    And part 4/4 is marked alone

  @test:test/layer-pr-checks-split-gates.test.ts::run-gates.py_split_gates::the_parts_run_alone,_so_the_balancer_puts_one_in_each_of_four_shards
  Scenario: The balancer puts one part in each of four shards
    Given the standalone gate is alone at 500 seconds and the two other gates take 100 seconds each
    When the gates are split and shard_names deals them into 4 shards with 4 jobs at once
    Then each shard holds exactly one part

  @test:test/layer-pr-checks-split-gates.test.ts::run-gates.py_split_gates::a_side_whose_check-standalone.ts_has_no_--part_keeps_the_gate_whole
  Scenario: A side whose check-standalone.ts has no --part keeps the gate whole
    Given a root with no check-standalone.ts, the gate is kept whole
    And with a check-standalone.ts that does not read "--part", the gate is kept whole
    And with a check-standalone.ts that reads "--part", the gate is split up to part #4/4

  @test:test/layer-pr-checks-split-gates.test.ts::run-gates.py_split_gates::a_gate_with_another_script_is_untouched
  Scenario: A gate with another script is untouched
    Given only the gate "x:check:bootstrap-standalone"
    When run-gates.py splits the gates
    Then the gates are unchanged

  @test:test/layer-pr-checks-split-gates.test.ts::run-gates.py_verified_by_gates::names_every_gate's_script,_once,_sorted
  Scenario: verified_by_gates names every gate's script once, sorted
    Given gates "a:kg:audit:check", "b:kg:audit:check", "graph:core:z" and "c:lsi:viz:check"
    When run-gates.py names the scripts verified by the gates
    Then it returns "core:z,kg:audit:check,lsi:viz:check"
