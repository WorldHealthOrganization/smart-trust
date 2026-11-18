# The findings read by .github/scripts/layer-pr-checks/run-gates.py and compared by
# compare-gates.py: a gate already red on main still fails the PR that adds a finding to it.
# Each Scenario names the test that executes it.
Feature: Findings on a gate already red on main

  @test:test/layer-pr-checks-findings.test.ts::run-gates.py_findings::reads_✗_lines_and_the_items_under_a_✗_count_header,_not_the_count
  Scenario: Findings are the ✗ lines and the items under a ✗ count header, not the count
    Given gate output with a "✗ 1 finding(s):" header over one stale library file, an indented ✗ line, a ✗ count line and a ✓ line
    When run-gates.py reads its findings
    Then they are the stale library file's line and "schemas/kinds/x.schema.json is stale"
    And neither count header nor the ✓ line is a finding

  @test:test/layer-pr-checks-findings.test.ts::run-gates.py_findings::reads_a_number_as_#,_so_a_count_that_only_went_down_is_not_new
  Scenario: A number in a finding is read as #, so a count that only went down is not new
    Given the gate output "✗ p.ts: 3 contract(s)"
    When run-gates.py reads its findings
    Then the finding is "p.ts: # contract(s)"

  @test:test/layer-pr-checks-findings.test.ts::compare-gates.py_over_a_gate_red_on_both_sides::a_PR_that_adds_a_stale_file_fails
  Scenario: A PR that adds a stale file to a gate red on both sides fails
    Given "libraries:check" red on both sides, with main finding a.json stale and the PR finding a.json and b.json
    When compare-gates.py compares them
    Then it exits 1

  @test:test/layer-pr-checks-findings.test.ts::compare-gates.py_over_a_gate_red_on_both_sides::a_PR_that_leaves_the_findings_as_they_were,_or_removes_one,_passes
  Scenario: A PR that keeps the findings as they were, or removes one, passes
    Given "libraries:check" red on both sides, with main finding a.json and b.json stale
    When compare-gates.py compares a PR finding the same two
    Then it exits 0
    And a PR finding only b.json also exits 0

  @test:test/layer-pr-checks-findings.test.ts::compare-gates.py_when_the_gate's_own_code_moved_between_main_and_the_PR::reworded_findings,_as_many_or_fewer,_pass
  Scenario: Reworded findings from a moved producer pass when as many or fewer
    Given a gate red on both sides whose main side was produced by pin "aaa" and PR side by pin "bbb" with reworded findings
    When the PR has two findings against main's three, or two against two
    Then compare-gates.py exits 0 both times

  @test:test/layer-pr-checks-findings.test.ts::compare-gates.py_when_the_gate's_own_code_moved_between_main_and_the_PR::more_findings_than_main_still_fail
  Scenario: More findings than main still fail when the producer moved
    Given main produced by "aaa" with one finding and the PR produced by "bbb" with two reworded findings
    When compare-gates.py compares them
    Then it exits 1

  @test:test/layer-pr-checks-findings.test.ts::compare-gates.py_when_the_gate's_own_code_moved_between_main_and_the_PR::the_same_producer,_or_a_side_that_names_none,_keeps_the_text_match
  Scenario: The same producer, or a side naming none, keeps the text match
    Given main with two findings and the PR with one reworded finding
    When both sides name producer "aaa"
    Then compare-gates.py exits 1
    And when main names no producer and the PR names "bbb", it also exits 1

  @test:test/layer-pr-checks-findings.test.ts::gate_diagnostics.producer::names_the_pin_of_the_harness_a_gate_is_named_for,_from_the_root's_lock;_None_for_the_root's_own
  Scenario: A gate's producer is the locked pin of the harness it is named for
    Given a root whose index.lock.json mounts cat-harness-tools at ref "d30c2f5f"
    When gate_diagnostics.producer is asked for "cat-harness-tools:check:foreign-paths" and for "site:check:x"
    Then the first is "d30c2f5f"
    And the root's own gate has no producer
