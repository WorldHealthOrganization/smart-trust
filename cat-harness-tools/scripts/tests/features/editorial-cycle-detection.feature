# The detangler-no-dependency-cycle checker in pipeline/qa-checkers-extended.ts must agree with cycles in the union editorial graph
# (uses and interprets), while detangler-no-forward-ref stays on uses[] only. Run against the attached folio.
# Each Scenario names the test that executes it.
Feature: Editorial cycle detection over the union graph

  @test:scripts/tests/editorial-cycle-detection.test.ts::editorial_cycle_detection::the_checker_flags_every_block_the_union_graph_puts_on_a_cycle
  Scenario: Every block on a cycle in the union editorial graph is flagged by the checker
    # Skipped: when no folio is attached
    Given the attached folio's content graph
    When cycles are found by depth-first search over its editorial edges
    Then every block on such a cycle fails the dependency-cycle checker

  @test:scripts/tests/editorial-cycle-detection.test.ts::editorial_cycle_detection::the_checker_does_not_invent_cycles_the_union_graph_does_not_have
  Scenario: The checker flags no block that is not on a union-graph cycle
    # Skipped: when no folio is attached
    Given the attached folio's content graph
    When the dependency-cycle checker runs on every block
    Then every block it fails is on a cycle in the union editorial graph

  @test:scripts/tests/editorial-cycle-detection.test.ts::editorial_cycle_detection::forward-reference_counting_was_NOT_widened_to_interprets
  Scenario: Forward-reference hits name only uses[] targets
    # Skipped: when no folio is attached
    Given the attached folio's content graph
    When the forward-reference checker runs on every block
    Then the text of every hit names one of that block's "uses" editorial targets
