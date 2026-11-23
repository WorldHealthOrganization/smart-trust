# scripts/check-instance-render.ts, the QA axis's render checker, must take a layer's exemption from rendering from its declaration rather than from its name.
# Each Scenario names the test that executes it.
Feature: The render checker reads the exemption declaration

  @test:schemas/render-exemption.test.ts::isExemptFrom_is_what_the_QA_axis_calls::the_axis_reads_the_DECLARATION,_not_an_instance_name
  Scenario: The render checker uses the declared exemption, not the name "bootstrap"
    # Gap: reads the checker's source text only; does not run the checker
    Given the source of "cat-harness-tools/scripts/check-instance-render.ts"
    Then it contains "renderExemptionProblems"
    And it does not contain a comparison with "bootstrap"
