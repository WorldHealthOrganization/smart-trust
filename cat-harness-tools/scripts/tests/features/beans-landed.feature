# scripts/beans-landed.ts finds open beans named by merges and ranks them by how much of their
# Done-when checklist is ticked. Each Scenario names the test that executes it.
Feature: Open beans that merges say have landed

  @test:scripts/tests/beans-landed.test.ts::doneWhen::counts_only_the_Done-when_checklist
  Scenario: Only the Done-when checklist is counted
    Given a bean body with a ticked box before "## Done when", two ticked and one unticked under it, and one unticked under "## Later"
    When its Done-when checklist is counted
    Then it has 2 ticked and 1 unticked

  @test:scripts/tests/beans-landed.test.ts::findings::a_bean_named_in_a_titled_merge's_subject_is_found
  Scenario: A bean named in a titled merge's subject is found
    Given merges including "b2", whose subject names "abcd"
    When the findings for open bean "abcd" are computed
    Then the only finding is merge "b2"

  @test:scripts/tests/beans-landed.test.ts::findings::a_bean_named_only_in_a_default_merge's_first_body_line_(the_PR_title)_is_found
  Scenario: A bean named only in a default merge's first body line is found
    Given merges including "a1", whose first body line names "wxyz"
    When the findings for open bean "wxyz" are computed
    Then the only finding is merge "a1"

  @test:scripts/tests/beans-landed.test.ts::findings::a_short_id_inside_a_longer_token_does_not_match
  Scenario: A short id inside a longer token does not match
    Given merges including one mentioning "abcdef"
    When the findings for open bean "cdef" are computed
    Then there are none

  @test:scripts/tests/beans-landed.test.ts::findings::ranked:_every_box_ticked_first,_then_partly_ticked,_then_no_checklist
  Scenario: Findings are ranked all ticked first, then partly ticked, then no checklist
    Given open beans "wxyz" with no checklist, "abcd" partly ticked and "efgh" fully ticked, each named by a merge
    When the findings are computed
    Then they are "efgh" done-ticked, "abcd" partly-ticked, then "wxyz" no-checklist

  @test:scripts/tests/beans-landed.test.ts::findings::a_bean_no_merge_names_is_not_a_finding
  Scenario: A bean no merge names is not a finding
    Given open bean "zzzz", which no merge names
    When the findings are computed
    Then there are none
