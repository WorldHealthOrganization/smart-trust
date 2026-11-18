# scripts/pdf-structure.py matches outline headings to page lines by _match_key in split_sections and locate_heading,
# tolerating spacing accents, appendix letters on their own line and long run-in headings.
# Each Scenario names the test that executes it.
Feature: Matching PDF outline headings to page lines

  @test:scripts/tests/heading-key.test.ts::matching_outline_headings_to_page_lines::spacing_and_combining_accents_compare_equal_to_the_composed_letter
  Scenario: Spacing and combining accents compare equal to the composed letter
    When _match_key is applied to "L¨ubeck", "Lübeck", a combining-diaeresis "Lübeck" and "  Erd˝os  "
    Then the keys are "lubeck", "lubeck", "lubeck" and "erdos"

  @test:scripts/tests/heading-key.test.ts::matching_outline_headings_to_page_lines::a_heading_printed_with_a_spacing_accent_still_opens_its_section
  Scenario: A heading printed with a spacing accent still opens its section
    Given four pages whose third begins "3. Application II: L¨ubeck formula"
    And an outline of four entries spelling it "Application II: Lübeck formula" on page 3
    When split_sections is run
    Then the sections are Intro 1-2, Application I 2-3, Application II: Lübeck formula 3-4, End 4-4

  @test:scripts/tests/heading-key.test.ts::matching_outline_headings_to_page_lines::an_appendix_letter_on_its_own_line_still_opens_its_section
  Scenario: An appendix letter on its own line still opens its section
    Given a second page with "A" on its own line before "Properties of analytic functions", and "B.1" before "Polarization"
    And outline entries "1 Intro" on page 1, and "A Properties of analytic functions" and "B.1 Polarization" on page 2
    When split_sections is run
    Then the sections start at pages 1, 2 and 2 with those titles

  @test:scripts/tests/heading-key.test.ts::matching_outline_headings_to_page_lines::a_run-in_heading_longer_than_120_characters_still_opens_its_section
  Scenario: A run-in heading longer than 120 characters still opens its section
    Given a page line where "3C1. Lie type in cross-characteristic for p = 3." runs into its paragraph, longer than 120 characters
    And outline entries spelling the math unspaced as "p=3" on pages 1, 2 and 3
    When split_sections is run
    Then the run-in line is the expected length and over 120 characters
    And the sections "3C. The case p=3", "3C1. …" and "3C2. …" start on pages 1, 2 and 3

  @test:scripts/tests/heading-key.test.ts::matching_outline_headings_to_page_lines::a_long_line_that_only_MENTIONS_a_title_mid-sentence_is_not_a_heading
  Scenario: A long line that only mentions a title mid-sentence is not a heading
    Given a page whose first line, over 120 characters, mentions "3C1. Lie type in cross-characteristic for p = 3" mid-sentence
    When locate_heading looks for that outline entry
    Then nothing is found

  @test:scripts/tests/heading-key.test.ts::matching_outline_headings_to_page_lines::a_run-in_prefix_must_end_at_a_boundary,_not_inside_a_longer_token
  Scenario: A run-in prefix must end at a boundary
    Given a page line beginning "3C1. Lie type in cross-characteristic for p = 31 and every larger prime"
    When locate_heading looks for "3C1. Lie type in cross-characteristic for p=3"
    Then nothing is found

  @test:scripts/tests/heading-key.test.ts::matching_outline_headings_to_page_lines::an_unlabelled_title_gets_no_run-in_match
  Scenario: An unlabelled title gets no run-in match
    Given a long page line beginning "Introduction of the auxiliary operator"
    When locate_heading looks for the outline entry "Introduction"
    Then nothing is found
