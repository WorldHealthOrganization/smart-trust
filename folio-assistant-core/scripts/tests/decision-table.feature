Feature: decision tables in the processes

  @test:scripts/tests/decision-table.test.ts::the_shipped_tables::draftQaGateBlocks
  Scenario: the draft QA gate blocks on critical and major, and says so by rule
    When the draft QA gate is evaluated with critical, major and no failures
    Then critical and major block by their rules and none passes

  @test:scripts/tests/decision-table.test.ts::the_shipped_tables::missingFactIsError
  Scenario: a fact the table needs but did not get is an error, not a default
    When the gate is evaluated without failMajor
    Then it throws naming failMajor

  @test:scripts/tests/decision-table.test.ts::computed_gateways_in_a_running_process::gatewayWithoutTableChosen
  Scenario: gateways without a table are still chosen, not computed
    When the editing process reaches the reviewer-kind gateway
    Then it is not computed
    And choosing yes enables the SME review
