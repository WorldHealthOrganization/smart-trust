# The KG audit's `tool` subject kind (schemas/sdlc/kg-qa.ts, scripts/kg-audit.ts): every Tool node
# gets a report whose criteria project answers other gates own rather than decide them.
# Each Scenario names the test that executes it.
Feature: Tool as a QA subject kind

  @test:scripts/tests/tools/tool-qa-subjects.test.ts::the_subject_kind_exists_and_is_not_empty::`tool`_is_a_subject_kind
  Scenario: "tool" is a KG subject kind
    Then KG_SUBJECT_KINDS contains "tool"

  @test:scripts/tests/tools/tool-qa-subjects.test.ts::the_subject_kind_exists_and_is_not_empty::it_carries_at_least_one_criterion
  Scenario: The tool subject kind carries at least one criterion
    Given the KG criteria that apply to "tool"
    Then there is at least one

  @test:scripts/tests/tools/tool-qa-subjects.test.ts::the_subject_kind_exists_and_is_not_empty::the_fresh_audit_ran_and_reported_on_Tools_at_all
  Scenario: A fresh audit reports on Tools at all
    Given a fresh "kg-audit.ts --check --json" run in the harness layer
    Then it produced at least one report whose subject kind is "tool"

  @test:scripts/tests/tools/tool-qa-subjects.test.ts::the_subject_kind_exists_and_is_not_empty::every_Tool_node_gets_a_report_—_all_of_them,_not_a_sample
  Scenario: Every Tool node gets a report from the fresh audit
    Given the harness's Tools and a fresh audit
    Then no Tool id is missing a report

  @test:scripts/tests/tools/tool-qa-subjects.test.ts::the_criteria_project,_they_do_not_decide::no_tool_criterion_re-answers_`maintains`_presence_itself
  Scenario: The maintains criterion points at check:maintained-artefacts
    # Gap: only checks the criterion's summary text names "check:maintained-artefacts", not that its logic defers to it.
    Given the tool criteria
    Then a "tool-maintains-in-tree" criterion exists
    And its summary contains "check:maintained-artefacts"

  @test:scripts/tests/tools/tool-qa-subjects.test.ts::the_two_results_that_are_not_`pass`::there_are_tools_of_each_shape_—_otherwise_the_assertions_below_are_vacuous
  Scenario: There are Tools with maintains and Tools without alternatives
    Given the harness's Tools and their derived alternatives
    Then at least one Tool declares maintains
    And at least one Tool has no alternative

  @test:scripts/tests/tools/tool-qa-subjects.test.ts::the_two_results_that_are_not_`pass`::a_`maintains`_claim_is_`unknown`_from_a_checkout,_never_`pass`
  Scenario: A maintains claim is unknown from a checkout
    Given every Tool that declares maintains
    When its fresh report is validated against KgQaReportSchema
    Then its "tool-maintains-in-tree" result is "unknown"
    And its first finding's detail names "check:maintained-artefacts"

  @test:scripts/tests/tools/tool-qa-subjects.test.ts::the_two_results_that_are_not_`pass`::a_Tool_with_no_alternative_records_`n/a`,_not_a_pass
  Scenario: A Tool with no alternative records n/a
    # Gap: only the first 5 Tools without an alternative are checked.
    Given Tools with no derived alternative
    When their fresh reports are read
    Then each one's "tool-alternative-selectable" result is "n/a"

  @test:scripts/tests/tools/tool-qa-subjects.test.ts::the_permanent_`unknown`_cannot_put_a_gate_out_of_reach::`tool-maintains-in-tree`_is_`minor`
  Scenario: The tool-maintains-in-tree criterion is minor
    Then the "tool-maintains-in-tree" criterion's severity is "minor"

  @test:scripts/tests/tools/tool-qa-subjects.test.ts::the_permanent_`unknown`_cannot_put_a_gate_out_of_reach::no_Tool_sidecar_is_`critical`,_so_`kg:audit:check`_still_passes
  Scenario: No Tool report is critical
    # Gap: does not run kg:audit:check itself; it checks only the worst severity of each fresh Tool report.
    Given the fresh report of every Tool
    When the worst severity of each is computed
    Then none is "critical"
