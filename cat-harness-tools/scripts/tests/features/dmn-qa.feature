# The DMN decision-table checks of src/workflow/dmn-qa.ts and scripts/dmn-check.ts (bean lo3p),
# run on small tables written by the test. Each Scenario names the test that executes it.
Feature: DMN decision-table checks

  @test:scripts/tests/dmn-qa.test.ts::dmn-table-complete::a_free-text_column_with_no_inputValues_and_no_catch-all_is_incomplete
  Scenario: A free-text column with no inputValues and no catch-all is incomplete
    Given a UNIQUE table over the string column "group" with rules for "a" and "b" only
    When the table is checked
    Then there is one "dmn-table-complete" finding
    And it is an error saying the columns "declare no inputValues"

  @test:scripts/tests/dmn-qa.test.ts::dmn-table-complete::declared_inputValues_close_the_column
  Scenario: Declared inputValues close a column
    Given a UNIQUE table whose string column declares the values "yes", "no" and "unknown", and a boolean column, with a rule for every combination and a last "unknown" rule
    When the table is checked
    Then there are no findings

  @test:scripts/tests/dmn-qa.test.ts::dmn-table-complete::a_missing_combination_is_named
  Scenario: A missing combination of inputs is named
    Given a UNIQUE table over booleans x and y with rules for x true and for x false with y true
    When the table is checked
    Then the "dmn-table-complete" finding names "{x: false, y: false}"

  @test:scripts/tests/dmn-qa.test.ts::dmn-table-complete::numeric_thresholds_are_probed_on_both_sides
  Scenario: A numeric threshold is probed on both sides
    Given a FIRST table over number n with rules "> 3" and "< 3"
    When the table is checked
    Then the "dmn-table-complete" finding names "{n: 3}"

  @test:scripts/tests/dmn-qa.test.ts::dmn-rule-shadowed::under_FIRST,_a_rule_covered_by_earlier_rules_never_fires
  Scenario: Under FIRST, a rule covered by earlier rules is shadowed
    Given a FIRST table whose first rule is all "-", followed by a rule for true and a last catch-all
    When the table is checked
    Then "dmn-rule-shadowed" reports rule "R2" only

  @test:scripts/tests/dmn-qa.test.ts::dmn-rule-shadowed::a_last_all-`-`_catch-all_under_FIRST_is_not_hidden,_though_earlier_rules_cover_every_case
  Scenario: A last all-"-" catch-all under FIRST is not reported as shadowed
    Given a FIRST table with rules for true and false, all cited, and a last all-"-" rule returning "unknown"
    When the table is checked
    Then there are no findings

  @test:scripts/tests/dmn-qa.test.ts::dmn-rule-shadowed::under_UNIQUE,_overlapping_rules_are_reported,_a_catch-all_included
  Scenario: Under UNIQUE, overlapping rules are reported, a catch-all included
    Given a UNIQUE table with rules for true, for false and a last all-"-" catch-all
    When the table is checked
    Then "dmn-rule-shadowed" reports 2 findings
    And the first names "UNIQUE"

  @test:scripts/tests/dmn-qa.test.ts::dmn-unknown-last::a_last_rule_that_returns_something_else_is_an_error
  Scenario: A last rule that does not return "unknown" is an error
    Given a FIRST table whose last rule is all "-" and returns "B"
    When the table is checked
    Then the only finding is "dmn-unknown-last"
    And with requireUnknown false there are no findings

  @test:scripts/tests/dmn-qa.test.ts::dmn-rule-cites-source::a_rule_with_no_annotation,_or_one_naming_no_source,_is_a_warning
  Scenario: A rule with no annotation, or one naming no source, is a warning
    Given a FIRST table whose rule R1 has no annotation and R2 is annotated "because it is so"
    When the table is checked
    Then "dmn-rule-cites-source" warns on R1 and R2

  @test:scripts/tests/dmn-qa.test.ts::dmn-structure-matches-folio::reads_a_rule_table's_backticked_header_names
  Scenario: A folio rule table's backticked header names are read
    Given a markdown rule table with header "`a` (Fig. 1) | `b` | Rationale" and 2 rows
    When its folio structure is read
    Then the names are "a" and "b" and the rows are 2

  @test:scripts/tests/dmn-qa.test.ts::dmn-structure-matches-folio::reads_a_Decision_structure_section
  Scenario: A Decision structure section is read
    Given a markdown block whose "Decision structure" section lists input "x", output "out" and 3 rules, followed by another section naming "nope"
    When its folio structure is read
    Then the names are "x" and "out" and the rows are 3

  @test:scripts/tests/dmn-qa.test.ts::dmn-structure-matches-folio::names_the_columns_that_differ,_and_a_rule_count_that_differs
  Scenario: Columns and a rule count that differ from the folio block are named
    Given a FIRST table over boolean b with 2 rules
    When it is checked against a block with columns "b" and "out" and 2 rows
    Then there are no findings
    And against a block with columns "c" and "out" and 3 rows there are 2 findings
    And the first says "Missing from the block: `b`" and "not the DMN: `c`"
    And with no block at all the first finding is a warning

  @test:scripts/tests/dmn-qa.test.ts::dmn-check_over_an_instance::reads_tables_beside_folio_blocks_and_flags_a_second_copy_elsewhere
  Scenario: dmn-check reads tables beside folio blocks and flags a second copy elsewhere
    Given an instance with "folio/doc/ch1/dt-two.dmn" beside its matching block, and the same table again at "processes/decisions/Two.dmn"
    When dmn-check runs over the instance
    Then "folio/doc/ch1/dt-two.dmn" has no findings
    And "processes/decisions/Two.dmn" has the single finding "dmn-one-copy"
