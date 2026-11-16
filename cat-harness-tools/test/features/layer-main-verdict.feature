# .github/scripts/layer-pr-checks/main-verdict.py, driven through python3: main's verdict judges
# only the gates the caller declares in .github/main-qa-gates.json, and reports the rest.
# Each Scenario names the test that executes it.
Feature: Main's verdict judges only declared gates

  @test:test/layer-main-verdict.test.ts::main-verdict.py_and_the_gates_a_layer_declares::no_declaration:_every_gate_that_ran_is_judged,_as_before
  Scenario: With no declaration every gate that ran is judged
    Given a gates report with three failing gates, one passing, one not-applicable (78) and one skipped
    And no main-qa-gates.json
    When main-verdict.py runs
    Then the verdict is "red"
    And the failures count 3 gates
    And the failures carry no declared list

  @test:test/layer-main-verdict.test.ts::main-verdict.py_and_the_gates_a_layer_declares::only_declared_gates_make_main_red;_the_rest_are_reported,_not_judged
  Scenario: Only declared gates make main red, and the rest are reported
    Given the same gates report
    And a declaration judging "folio-assistant-sci:*" and "graph:folio-assistant-sci:*"
    When main-verdict.py runs
    Then the verdict is "red"
    And the only failing gate is "graph:folio-assistant-sci:kg-audit" with exit 1
    And 2 red gates are counted as not judged and 1 passing gate as undeclared
    And the summary holds "Not judged: red, but not declared (2)" and lists "cat-harness-tools:typecheck"

  @test:test/layer-main-verdict.test.ts::main-verdict.py_and_the_gates_a_layer_declares::green_when_every_declared_gate_passes,_whatever_the_undeclared_ones_do
  Scenario: Main is green when every declared gate passes
    Given the same gates report
    And a declaration judging only "folio-assistant-sci:*"
    When main-verdict.py runs
    Then the verdict is "green"
    And the failures count 0 gates

  @test:test/layer-main-verdict.test.ts::main-verdict.py_and_the_gates_a_layer_declares::a_declared_pattern_that_matches_no_gate_is_reported
  Scenario: A declared pattern that matches no gate is reported
    Given a declaration judging "folio-assistant-sci:*" and "nothing:*"
    When main-verdict.py runs
    Then the summary lists "nothing:*"

  @test:test/layer-main-verdict.test.ts::main-verdict.py_and_the_gates_a_layer_declares::a_declaration_that_cannot_be_read_is_unknown,_never_green
  Scenario: A declaration that cannot be read is unknown, never green
    Given a main-qa-gates.json holding "{not json"
    When main-verdict.py runs
    Then the verdict is "unknown"
    And a declaration with an empty judged list is also "unknown"
