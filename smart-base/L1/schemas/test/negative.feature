Feature: The validator fails on what it claims to catch
  A port of WHO smart-kg's negative tests, case for case: each case mutates a
  valid document into one defect and the validator must name it; some cases
  assert that something legitimate is not reported.

  @test:smart-base/L1/schemas/test/negative.test.ts::negativeCase[${name}]
  Scenario: each negative case is reported, or not reported, as it expects
    Given a case's valid base document of L1, L2, L2-BPMN, L2-DMN or L3, and its mutation if it has one
    When the mutated copy is checked with the set's other documents as external nodes
    Then the copy is still of its base's layer
    And a case expecting an error pattern has an error matching it
    And a case expecting nothing has no errors
    And a case expecting a warning has no errors and a warning matching it
    And a case expecting no warning has no errors and no warning matching its pattern
