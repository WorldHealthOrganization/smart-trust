# The always-green gates of .github/scripts/layer-pr-checks/compare-gates.py: red on head fails
# the PR even when main is red too, while not applicable (78) is never counted.
# Each Scenario names the test that executes it.
Feature: Always-green gates in the gate comparison

  @test:test/layer-pr-checks-always-green.test.ts::always-green_gates::%s:_red_on_both_sides_still_fails_the_PR
  Scenario: An always-green gate red on both sides still fails the PR
    Given a gate that exits 1 on both base and head, for each of "cat-harness-tools:gen:jsonld:check" and "check:kg-blocks"
    When compare-gates.py compares base and head
    Then it exits 1
    And its output says "always-green"

  @test:test/layer-pr-checks-always-green.test.ts::always-green_gates::could_not_determine_(2)_on_head_fails_too
  Scenario: Could not determine (2) on head fails an always-green gate
    Given gate "x:gen:jsonld:check" exits 1 on base and 2 on head
    When compare-gates.py compares them
    Then it exits 1

  @test:test/layer-pr-checks-always-green.test.ts::always-green_gates::not_applicable_(78)_is_never_counted
  Scenario: Not applicable (78) is never counted
    Given gate "x:gen:jsonld:check" exits 1 on base and 78 on head
    When compare-gates.py compares them
    Then it exits 0

  @test:test/layer-pr-checks-always-green.test.ts::always-green_gates::green_passes
  Scenario: A green always-green gate passes
    Given gate "x:gen:jsonld:check" exits 1 on base and 0 on head
    When compare-gates.py compares them
    Then it exits 0

  @test:test/layer-pr-checks-always-green.test.ts::always-green_gates::the_diagram_SVGs_are_not_always-green:_a_QA_report_(owner,_2026-11-13)
  Scenario: The diagram SVG render gate is not always-green
    Given gate "x:render:bpmn:check" exits 1 on both base and head
    When compare-gates.py compares them
    Then it exits 0

  @test:test/layer-pr-checks-always-green.test.ts::always-green_gates::an_ordinary_gate_red_on_both_sides_is_still_main's_to_fix
  Scenario: An ordinary gate red on both sides is left to main
    Given gate "x:bpmn:checklist:check" exits 1 on both base and head
    When compare-gates.py compares them
    Then it exits 0
    And its output says "failing on main too"
