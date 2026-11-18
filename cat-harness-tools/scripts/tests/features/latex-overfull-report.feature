# The Overfull \hbox reporter reads each box's size and source line from a
# LaTeX log and attributes it to the file TeX had open. Each Scenario names
# the test that executes it.
Feature: Overfull hbox report from a LaTeX log

  @test:scripts/tests/latex-overfull-report.test.ts::latex-overfull-report::parses_boxes_and_tracks_the_source_file_across_(file_…)_nesting
  Scenario: Boxes are attributed to the file open at the time, across nesting
    Given a log that opens intro.tex, then tables.tex inside it, closes tables.tex, and reports a box in each state
    When the overfull boxes are parsed
    Then three boxes are found
    And the 187.34pt box is attributed to tables.tex at line 200
    And the 5pt box after tables.tex closes is attributed to intro.tex

  @test:scripts/tests/latex-overfull-report.test.ts::latex-overfull-report::a_clean_log_yields_no_boxes
  Scenario: A clean log yields no boxes
    When a log with no Overfull warnings is parsed
    Then no boxes are found
