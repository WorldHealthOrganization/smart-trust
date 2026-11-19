# The source side of check:escaped-markup (scripts/check-escaped-markup.ts) finds markdown lines that open at column 0 with a
# placeholder written like an HTML tag, which kramdown reads as a block; real elements, autolinks, fences and generated trees are left alone.
# Each Scenario names the test that executes it.
Feature: Escaped markup in markdown sources

  @test:scripts/tests/escaped-markup-source.test.ts::leakingLinesIn_—_must_fire::catches_the_#1730_defect:_a_code_span_wrapped_so_a_line_begins_<slide>
  Scenario: A code span wrapped so a line begins with <slide> is caught
    Given two lines from library-ingestion.md where a code span wraps so the second line begins "<slide>`"
    When the lines are scanned for leaking markup
    Then exactly one finding is reported
    And its tag is "slide" and it is on line 2

  @test:scripts/tests/escaped-markup-source.test.ts::leakingLinesIn_—_must_fire::catches_a_DOTTED_placeholder,_which_is_never_an_element
  Scenario: A dotted placeholder at the start of a line is caught
    When the line "<file.json> is the sidecar" is scanned
    Then one finding is reported

  @test:scripts/tests/escaped-markup-source.test.ts::leakingLinesIn_—_must_fire::catches_a_close_tag_too_—_kramdown_reads_either_as_a_block
  Scenario: A close tag at the start of a line is caught
    When the line "</agentId> ends it" is scanned
    Then one finding is reported

  @test:scripts/tests/escaped-markup-source.test.ts::leakingLinesIn_—_must_NOT_fire_(all_four_are_real_corpus_lines)::an_autolink_is_valid_markdown,_not_a_tag
  Scenario: An autolink at the start of a line is not a finding
    When a line opening with a "https://creativecommons.org/…" autolink is scanned
    And a line holding only a "mailto:" autolink is scanned
    Then neither yields a finding

  @test:scripts/tests/escaped-markup-source.test.ts::leakingLinesIn_—_must_NOT_fire_(all_four_are_real_corpus_lines)::a_REAL_html_element_is_allowed_to_open_a_line
  Scenario: A real HTML element may open a line
    When a line opening with "<caption>" is scanned
    And the line '<details markdown="1">' is scanned
    Then neither yields a finding

  @test:scripts/tests/escaped-markup-source.test.ts::leakingLinesIn_—_must_NOT_fire_(all_four_are_real_corpus_lines)::a_placeholder_inside_a_code_span,_mid-line,_is_the_safe_spelling
  Scenario: A placeholder inside a mid-line code span is not a finding
    When the line "written to `library/<slug>/` by the ingester" is scanned
    Then no finding is reported

  @test:scripts/tests/escaped-markup-source.test.ts::leakingLinesIn_—_must_NOT_fire_(all_four_are_real_corpus_lines)::a_fenced_region_is_not_markdown,_so_its_contents_cannot_trip_this
  Scenario: A placeholder inside a backtick fence is not a finding
    Given a yaml fenced block holding a line starting "<slide>", followed by text after the fence
    When it is scanned
    Then no finding is reported

  @test:scripts/tests/escaped-markup-source.test.ts::leakingLinesIn_—_must_NOT_fire_(all_four_are_real_corpus_lines)::a_tilde_fence_closes_only_on_a_tilde_fence
  Scenario: A placeholder inside a tilde fence is not a finding
    Given a tilde-fenced block holding the line "<slide>"
    When it is scanned
    Then no finding is reported

  @test:scripts/tests/escaped-markup-source.test.ts::leakingLinesIn_—_must_NOT_fire_(all_four_are_real_corpus_lines)::front_matter_is_YAML_and_kramdown_never_sees_it
  Scenario: A placeholder in front matter is not a finding
    Given front matter whose title is "<slide> something", followed by a body
    When it is scanned
    Then no finding is reported

  @test:scripts/tests/escaped-markup-source.test.ts::leakingLinesIn_—_must_NOT_fire_(all_four_are_real_corpus_lines)::an_html_comment_is_not_a_tag
  Scenario: An HTML comment at the start of a line is not a finding
    When the line "<!-- marker:begin -->" is scanned
    Then no finding is reported

  @test:scripts/tests/escaped-markup-source.test.ts::leakingLinesIn_—_must_NOT_fire_(all_four_are_real_corpus_lines)::an_INDENTED_code_block_cannot_trip_it_—_the_column-0_rule_pays_for_itself
  Scenario: A placeholder in an indented code block is not a finding
    When a line indented four spaces and opening with "<slide>" is scanned
    Then no finding is reported

  @test:scripts/tests/escaped-markup-source.test.ts::scope::excludes_the_generated_trees,_because_those_must_never_be_hand-edited
  Scenario: The generated trees are excluded from the scanned sources
    Then the generated segments include "/reference/skill-instructions/"
    When the markdown sources under "cat-harness/docs" are listed
    Then more than 50 files are found
    And none of them is under "docs/reference/skill-instructions/"

  @test:scripts/tests/escaped-markup-source.test.ts::scope::the_html_allow-list_carries_the_elements_this_corpus_actually_opens_lines_with
  Scenario: The HTML allow-list holds the elements the corpus opens lines with
    Then the allow-list contains "caption", "details", "summary", "div", "table" and "figure"
    And it does not contain "slide"

  @test:scripts/tests/escaped-markup-source.test.ts::brokenTablesIn_—_must_fire::a_header-only_table:_a_delimiter_with_no_row_under_it
  Scenario: A header-only table with no body row is a no-body finding
    Given a heading, a blank line, the header "| role | file | |" and a delimiter row with nothing under it
    When broken tables are found in it
    Then there is exactly one finding, on line 3, with defect "no-body"
    And its excerpt is "| role | file | |"

  @test:scripts/tests/escaped-markup-source.test.ts::brokenTablesIn_—_must_fire::...also_at_the_end_of_the_file,_and_when_the_next_line_is_prose
  Scenario: A header-only table is caught at the end of the file and before prose
    Given a header and delimiter that end the file
    And a header and delimiter followed by the line "prose after"
    When broken tables are found in each
    Then the first finding of each has defect "no-body"

  @test:scripts/tests/escaped-markup-source.test.ts::brokenTablesIn_—_must_fire::a_table_straight_under_a_heading_—_the_heading_does_not_stand_in_for_a_blank_line
  Scenario: A table straight under a heading is a no-blank-line finding
    Given the heading "##### Content Review Skills" followed directly by a table with a body row
    When broken tables are found in it
    Then there is exactly one finding, on line 2, with defect "no-blank-line"
    And its excerpt is "| Skill | Personas |"

  @test:scripts/tests/escaped-markup-source.test.ts::brokenTablesIn_—_must_fire::a_table_straight_under_a_paragraph_line
  Scenario: A table straight under a paragraph line is a no-blank-line finding
    Given the line "Integration points:" followed directly by a table with a body row
    When broken tables are found in it
    Then the first finding has defect "no-blank-line"

  @test:scripts/tests/escaped-markup-source.test.ts::brokenTablesIn_—_must_fire::alignment_colons_and_a_one-column_table_count
  Scenario: A one-column table with an aligned delimiter is recognised
    Given a one-column header-only table whose delimiter is "| :---: |"
    When broken tables are found in it
    Then there is exactly one finding

  @test:scripts/tests/escaped-markup-source.test.ts::brokenTablesIn_—_must_NOT_fire::a_well-formed_table_after_a_blank_line,_with_a_body
  Scenario: A well-formed table after a blank line is not a finding
    Given a heading, a blank line and a table with a header, delimiter and body row
    When broken tables are found in it
    Then there are none

  @test:scripts/tests/escaped-markup-source.test.ts::brokenTablesIn_—_must_NOT_fire::a_table_that_opens_the_file,_or_opens_the_body_after_front_matter
  Scenario: A table at the start of the file or right after front matter is not a finding
    Given a table that opens the file
    And a table that opens the body straight after a front-matter block
    When broken tables are found in each
    Then there are none in either

  @test:scripts/tests/escaped-markup-source.test.ts::brokenTablesIn_—_must_NOT_fire::a_body_row_of_dashes_inside_a_table_is_not_a_second_delimiter
  Scenario: A body row of dashes is not read as a second delimiter
    Given a well-formed table with a body row "| - | - |" between two other body rows
    When broken tables are found in it
    Then there are none

  @test:scripts/tests/escaped-markup-source.test.ts::brokenTablesIn_—_must_NOT_fire::a_table_SHOWN_in_a_fence_is_not_a_table
  Scenario: A table shown inside a code fence is not judged
    Given a fenced md block holding a heading followed directly by a header-only table
    When broken tables are found in it
    Then there are none

  @test:scripts/tests/escaped-markup-source.test.ts::brokenTablesIn_—_must_NOT_fire::rows_generated_by_Liquid_are_not_judged_from_the_source
  Scenario: Body rows produced by a Liquid loop are not judged from the source
    Given a header and delimiter followed by a "{% for %}" loop that emits the rows
    When broken tables are found in it
    Then there are none

  @test:scripts/tests/escaped-markup-source.test.ts::brokenTablesIn_—_must_NOT_fire::a_setext_heading_underline_or_a_thematic_break_is_not_a_delimiter
  Scenario: A setext underline or a thematic break is not a delimiter
    Given a setext heading underlined with "-----" and a "---" thematic break between paragraphs
    When broken tables are found in it
    Then there are none
