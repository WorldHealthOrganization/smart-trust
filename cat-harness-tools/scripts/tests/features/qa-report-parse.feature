# parseQaReport is loadQaReport over text in hand (bean 8wj1): a sidecar read
# from the qa-reports branch gives the same report as the same bytes read off
# disk. Each Scenario names the test that executes it.
Feature: Parsing a QA report from text

  @test:scripts/tests/qa-report-parse.test.ts::parseQaReport_agrees_with_loadQaReport_on_the_same_bytes::%s
  Scenario Outline: parseQaReport and loadQaReport agree on the same bytes
    Given the <sample> sidecar text written to a .qa.json file
    When it is parsed from text and loaded from the file
    Then the two reports are equal

    Examples:
      | sample    |
      | marked    |
      | unmarked  |
      | bareEntry |
      | foreign   |
      | corrupt   |

  @test:scripts/tests/qa-report-parse.test.ts::parseQaReport_agrees_with_loadQaReport_on_the_same_bytes::the_shape_rules_are_applied,_not_just_the_parse
  Scenario: The shape rules are applied, not just the parse
    Then an unmarked report with the shape is given the "block-qa/v1" marker
    And a bare entry object is wrapped in an array and a scalar entry dropped
    And a report of another schema, and corrupt JSON, each parse to nothing
