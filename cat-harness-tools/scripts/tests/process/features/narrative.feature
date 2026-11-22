# A business-process task's narrative lives in the .md beside its diagram, one
# heading per task; narrativeText returns that section.
Feature: A task's narrative is read from the Markdown beside its diagram

  @test:scripts/tests/process/narrative.test.ts::narrativeText::finds_a_section_by_the_<a_name>_anchor_before_its_heading,_without_the_next_anchor
  Scenario: A section is found by the anchor before its heading
    Given a diagram X.bpmn with an X.md whose headings are preceded by <a name> anchors
    When the narrative for "X.md#A.P.Interest" is read
    Then it is exactly the section's paragraph, without the next section's anchor

  @test:scripts/tests/process/narrative.test.ts::narrativeText::keeps_sub-headings,_stops_at_the_next_heading_of_its_level
  Scenario: A section keeps its sub-headings and stops at the next heading of its level
    Given the same X.md, whose "A.S.Check" section holds a "### Detail" sub-heading
    When the narrative for "X.md#A.S.Check" is read
    Then it holds the paragraph, the "### Detail" sub-heading and its text
    And nothing from the next "##" section

  @test:scripts/tests/process/narrative.test.ts::narrativeText::also_matches_a_{#id}_or_the_heading's_slug
  Scenario: A section is also found by a {#id} or by the heading's slug
    Given the same X.md
    When the narrative for "X.md#check" is read
    Then it contains "WHO validates"
    When the narrative for "X.md#reject-by-email" is read
    Then it is "Rejected."

  @test:scripts/tests/process/narrative.test.ts::narrativeText::is_undefined_for_a_missing_file_or_heading
  Scenario: A missing file or heading gives no narrative
    Given the same X.md
    When the narrative for "Y.md#A.P.Interest" or "X.md#nope" is read
    Then each is undefined
