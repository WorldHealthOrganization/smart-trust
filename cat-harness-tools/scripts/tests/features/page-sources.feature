# markdownHeadings decides which sections of a plain page are its own text
# (owner, 2026-11-13). Each Scenario names the test that executes it.
Feature: The headings a page writes itself

  @test:scripts/tests/page-sources.test.ts::markdownHeadings:_the_headings_a_page_writes_itself::ATX_headings_with_their_1-based_source_lines,_front_matter_skipped
  Scenario: ATX headings come with their 1-based source lines, front matter skipped
    Given a page with front matter, a level-1 heading, a closed level-2 heading and a level-3 heading with an id
    When its headings are read
    Then they are Top at line 5, Second at line 7 and Third at line 8

  @test:scripts/tests/page-sources.test.ts::markdownHeadings:_the_headings_a_page_writes_itself::a_heading_inside_fenced_code_is_not_a_heading
  Scenario: A heading inside fenced code is not a heading
    Given headings inside backtick and tilde fences between two real headings
    When its headings are read
    Then only the two real headings are found

  @test:scripts/tests/page-sources.test.ts::markdownHeadings:_the_headings_a_page_writes_itself::a_link_keeps_its_text;_a_Liquid_heading_is_left_out,_since_its_rendered_text_is_unknown
  Scenario: A link keeps its text and a Liquid heading is left out
    Given a heading holding a link, a heading of Liquid output, and an include
    When its headings are read
    Then only "See the guide first" at line 1 is found

  @test:scripts/tests/page-sources.test.ts::markdownHeadings:_the_headings_a_page_writes_itself::an_include_draws_no_heading_of_this_file's_own
  Scenario: An include draws no heading of this file's own
    When the headings of a page holding only an include are read
    Then there are none
