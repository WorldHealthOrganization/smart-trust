# pipeline/render-dmn-table.ts draws a decision-table block from its .dmn file as an HTML table
# with plain-language cells and linked citations, placed at the block's marker line.
# Each Scenario names the test that executes it.
Feature: Rendering DMN decision tables

  @test:pipeline/render-dmn-table.test.ts::renderDmnFile::draws_inputs,_outputs,_hit_policy_and_one_row_per_rule,_escaped
  Scenario: The table shows inputs, outputs, hit policy and one row per rule, escaped
    Given a DMN file with decision "Pick a <colour> & size", hit policy FIRST, inputs "Light" and "count", output "Action to take"
    And rule R1 ("red", "> 0" gives "stop", described "Stop on red.") and rule R2 ("-", "-" gives "go")
    When the DMN file is rendered
    Then the render succeeds
    And the wrapper div carries the decision id "Decision_T", the file name "ok.dmn" and the hit policy "FIRST"
    And the escaped decision name is followed by "The first rule that matches applies."
    And input and output headers show their labels with the fact names as hover titles
    And the input side is headed "When" across 2 columns
    And "red" shows as a chip without quotes, "> 0" as written, and "-" as "any"
    And the output "stop" shows as a coloured output chip
    And the description "Stop on red." shows as a row under its rule
    And the HTML contains no blank line

  @test:pipeline/render-dmn-table.test.ts::renderDmnFile::is_deterministic
  Scenario: Rendering is deterministic
    Given a DMN file with decision "Pick a <colour> & size", hit policy FIRST, inputs "Light" and "count", output "Action to take"
    And rule R1 ("red", "> 0" gives "stop", described "Stop on red.") and rule R2 ("-", "-" gives "go")
    When the same DMN file is rendered twice
    Then both results are equal

  @test:pipeline/render-dmn-table.test.ts::renderDmnFile::refuses_FEEL_the_reader_cannot_read,_naming_the_cell
  Scenario: FEEL the reader cannot read is refused, naming the cell
    Given a DMN file with decision "Pick a <colour> & size", hit policy FIRST, inputs "Light" and "count", output "Action to take"
    And rule R1's second input is the range "[1..5]"
    When the DMN file is rendered
    Then the render fails
    And the reason names "R1 input column 2"

  @test:pipeline/render-dmn-table.test.ts::renderDmnFile::refuses_a_hit_policy_the_reader_does_not_implement
  Scenario: A hit policy the reader does not implement is refused
    Given a DMN file with decision "Pick a <colour> & size", hit policy FIRST, inputs "Light" and "count", output "Action to take"
    And rule R1 ("red", "> 0" gives "stop", described "Stop on red.") and rule R2 ("-", "-" gives "go")
    And the hit policy is "COLLECT"
    When the DMN file is rendered
    Then the render fails

  @test:pipeline/render-dmn-table.test.ts::renderDmnFile::a_file_with_two_decisions_needs_the_block_to_name_one
  Scenario: A file with two decisions needs the block to name one
    Given a DMN file with decision "Pick a <colour> & size", hit policy FIRST, inputs "Light" and "count", output "Action to take"
    And rule R1 ("red", "> 0" gives "stop", described "Stop on red.") and rule R2 ("-", "-" gives "go")
    And a second decision "Decision_U" in the same file
    When the DMN file is rendered without naming a decision
    Then the render fails
    When it is rendered naming "Decision_U"
    Then the render succeeds with decision id "Decision_U"

  @test:pipeline/render-dmn-table.test.ts::reader-facing_text::a_header's_trailing_citation_becomes_linked_marks
  Scenario: A header's trailing citation becomes linked marks
    Given a DMN file with decision "Pick a <colour> & size", hit policy FIRST, inputs "Light" and "count", output "Action to take"
    And rule R1 ("red", "> 0" gives "stop", described "Stop on red.") and rule R2 ("-", "-" gives "go")
    And the input label is "Light (fr:A, fr:B)"
    And refs "fr:A" titled "Requirement A" and "fr:B" titled "Requirement B"
    When the DMN file is rendered with those refs
    Then the header reads "Light" followed by a superscript with one arrow link per ref, titled by the ref

  @test:pipeline/render-dmn-table.test.ts::reader-facing_text::a_block_label_becomes_a_link_reading_as_the_block's_title;_an_unknown_one_stays
  Scenario: A known block label becomes a link with the block's title, an unknown one stays
    Given a ref "freq:FR-ID-01" titled "Unique identifier"
    When "Check (freq:FR-ID-01, freq:FR-XX-09, Section 7.1)" is linked
    Then "freq:FR-ID-01" becomes a link reading "Unique identifier"
    And "freq:FR-XX-09" and "Section 7.1" stay as text

  @test:pipeline/render-dmn-table.test.ts::reader-facing_text::cells_read_as_words
  Scenario: Cells read as words
    When input cells are rendered as plain text
    Then the quoted list a, b reads as chip "a", the word "or", chip "b"
    And not of quoted red reads as the word "not" then chip "red"
    And " - " reads as "any"
    And quoted go as an output cell reads as one output chip "go" carrying a hue class

  @test:pipeline/render-dmn-table.test.ts::placing_the_table_in_the_block::at_the_marker_line,_else_after_the_body
  Scenario: The table goes at the marker line, else after the body
    When the table is placed in a body with the marker line between two paragraphs
    Then the marker line is replaced by the table
    When the table is placed in a body with no marker
    Then the table follows the body after a blank line

  @test:pipeline/render-dmn-table.test.ts::placing_the_table_in_the_block::renderBlockMarkdown_puts_it_in_the_block_body
  Scenario: renderBlockMarkdown puts the table in the block body
    Given a decision-table block whose body has the marker line between "Purpose" and "Notes"
    When the block markdown is rendered with a DMN table
    Then the table sits between "Purpose" and "Notes"
    And the marker does not appear in the output
