# Headings come from the paper's own LaTeX: the sectioning commands are read
# and each is placed on its PDF page. Each Scenario names the test that executes it.
Feature: Headings read from the LaTeX source

  @test:scripts/tests/latex-headings.test.ts::reading_the_source::numbers_as_article_does:_sections,_subsections,_starred,_appendix_letters
  Scenario: Sectioning commands are numbered as the article class numbers them
    Given a LaTeX source with sections, a starred section, a subsection with a short title, a subsubsection, an appendix and a section after the bibliography
    When its headings are read
    Then the numbered sections are 1, 2, 2.1, 2.1.1 and 3, the starred section has no number, and the appendix sections are A and A.1
    And user macros in titles are expanded, \emph is stripped, and the section after the bibliography is not a heading

  @test:scripts/tests/latex-headings.test.ts::placing_the_headings_on_pages::the_source_is_the_spine;_the_body_supplies_pages;_a_lost_heading_is_flagged,_not_dropped
  Scenario: The source is the spine, the body supplies the pages, and a lost heading is flagged
    Given layout lines over five pages and five source headings, one of which has no line in the PDF
    When the headings are placed on pages
    Then each found heading is on its page with confidence 1.0 from the latex and body sources
    And the lost heading takes the page of the heading before it with confidence 0.5 from latex alone
    And the share of source headings found is 0.8

  @test:scripts/tests/latex-headings.test.ts::placing_the_headings_on_pages::a_run-in_heading_and_a_small-capitals_numbered_heading_are_found;_small_body_text_is_not
  Scenario: A run-in heading and a small-capitals numbered heading are found; small body text is not
    Given the 2.1 heading run in to its paragraph on page 4, the A heading set in small capitals, and a small-print paragraph mentioning Proofs on page 2
    When the headings are placed on pages
    Then 2.1 is on page 4 and A on page 5, both with confidence 1.0, and the small-print mention is not taken for A

  @test:scripts/tests/latex-headings.test.ts::placing_the_headings_on_pages::pdf-structure_prefers_the_source_over_the_font_guess,_and_trusts_it
  Scenario: pdf-structure prefers the LaTeX source over the font guess
    Given the layout lines and source headings that match them
    When pdf-structure infers the table of contents
    Then the method is "latex" with five entries
    And with source headings that match nothing, the method falls back to "font"
    And no LaTeX source is found for a nonexistent PDF or an empty source path
