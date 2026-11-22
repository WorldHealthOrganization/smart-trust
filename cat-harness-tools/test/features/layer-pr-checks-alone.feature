# The tree_snapshotting choice in .github/scripts/layer-pr-checks/run-gates.py: which gates run
# alone after the pool drains because they run a tree tool, directly or through what they run.
# Each Scenario names the test that executes it.
Feature: Gates that run alone

  @test:test/layer-pr-checks-alone.test.ts::a_gate_runs_alone_when_it_runs_a_tree_tool,_directly_or_through_what_it_runs
  Scenario: A gate runs alone when it runs a tree tool directly or through what it runs
    Given a root declaring layer "a" whose package scripts reach publish-check.ts, the standalone probes, a script spawning cat with a verify list, and a gate chaining to it
    When run-gates.py picks the tree-snapshotting gates
    Then they are exactly "a:chained:check", "a:probe:check", "a:register:check", "a:rehearse:check" and "a:x:check"

  @test:test/layer-pr-checks-alone.test.ts::a_name_in_a_comment,_or_a_verify_list_never_spawned,_is_not_a_call
  Scenario: A name in a comment, or a verify list never spawned, is not a call
    Given the same fixture root
    When run-gates.py picks the tree-snapshotting gates
    Then "a:mentions:check", whose script names x:check only in a comment, is not among them
    And "a:lists:check", whose verify list is never spawned, is not among them
    And "a:plain:check" is not among them
