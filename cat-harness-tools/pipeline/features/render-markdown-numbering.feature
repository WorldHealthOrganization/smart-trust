# pipeline/render-markdown.ts gives figure and table headings their source number and a link icon,
# frames numbered blocks, and draws structured blocks (requirements, indicators) as light cards.
# Each Scenario names the test that executes it.
Feature: Block headings, frames and cards in the Markdown render

  @test:pipeline/render-markdown-numbering.test.ts::captionNumber::reads_the_source's_own_number_in_its_common_forms
  Scenario: A caption's own number is read in its common forms
    When caption numbers are read
    Then "Fig. 1. Product master data" gives number "1" and rest "Product master data"
    And "Fig 6. WHO SMART Guidelines approach" gives number "6"
    And "Figure 2.13: m4RH monitoring data" gives number "2.13"
    And "Table 3. Roles" gives number "3" and rest "Roles"

  @test:pipeline/render-markdown-numbering.test.ts::captionNumber::a_caption_naming_two_figures_keeps_its_text_and_gives_a_range
  Scenario: A caption naming two figures gives a range and keeps its text
    When the caption number of "Fig. 26. Current state in Ethiopia; Fig. 27. Future state in Ethiopia" is read
    Then the number is "26–27"
    And the rest still contains "Fig. 27."

  @test:pipeline/render-markdown-numbering.test.ts::captionNumber::invents_nothing_when_the_source_has_no_number
  Scenario: No number is invented when the caption has none
    When the caption number of "Target users of this handbook across Chapters 1–7" is read
    Then there is no number

  @test:pipeline/render-markdown-numbering.test.ts::renderBlockMarkdown_headings::a_numbered_figure:_number_in_the_heading,_a_link_icon,_no_duplicate_number
  Scenario: A numbered figure heading carries the number and a link icon, without repeating it
    Given a figure "fig:1" captioned "Fig. 1. Product master data"
    When the block markdown is rendered
    Then it contains the anchor "fig:1"
    And the heading "**Figure 1.**"
    And a block-anchor link to "#fig:1"
    And the caption "*Product master data*" without the "Fig. 1." prefix

  @test:pipeline/render-markdown-numbering.test.ts::renderBlockMarkdown_headings::a_numbered_figure_says_its_caption_once,_on_the_heading_line
  Scenario: A numbered figure says its caption once, on the heading line
    Given a figure "fig:5" captioned "Fig. 5. WHO SMART Guidelines Approach"
    When the block markdown is rendered
    Then it contains "**Figure 5.** *WHO SMART Guidelines Approach*"
    And the caption text appears exactly once

  @test:pipeline/render-markdown-numbering.test.ts::renderBlockMarkdown_headings::an_unnumbered_table_keeps_its_plain_heading_and_still_gets_the_link_icon
  Scenario: An unnumbered table keeps its plain heading and still gets the link icon
    Given a table "tbl:target-users" captioned "Target users"
    When the block markdown is rendered
    Then it contains "**Table.**"
    And a link to "#tbl:target-users"
    And the caption "*Target users*"

  @test:pipeline/render-markdown-numbering.test.ts::renderBlockMarkdown_headings::no_anchors_means_no_link_icon
  Scenario: Without anchors there is no link icon
    Given a figure "fig:2" captioned "Fig. 2. X"
    When the block markdown is rendered with anchors off
    Then it contains no "block-anchor"

  @test:pipeline/render-markdown-numbering.test.ts::the_numbered-block_frame::a_figure,_diagram_or_table_sits_in_one_frame,_Markdown_kept_inside
  Scenario: A figure or table sits in one frame with Markdown kept inside
    # Gap: a diagram is not rendered
    Given a figure captioned "Fig. 1. Product master data"
    When the block markdown is rendered
    Then it starts with a "fa-numbered fa-numbered-figure" div marked markdown="1" and a blank line
    And it ends with a blank line and the closing div
    And a rendered table carries the class "fa-numbered fa-numbered-table"

  @test:pipeline/render-markdown-numbering.test.ts::the_numbered-block_frame::prose_has_no_frame
  Scenario: Prose has no frame
    Given a prose block
    When the block markdown is rendered
    Then it contains no "fa-numbered"

  @test:pipeline/render-markdown-numbering.test.ts::structured_blocks:_a_light_card::kind_label,_id_chip_and_the_body_on_one_line;_the_id_and_the_cut_title_are_said_once
  Scenario: A card shows kind, id chip and body on one line, saying the id and title once
    Given a functional requirement "FR-AN-01" whose title is cut with "…" and whose body opens "**FR-AN-01.**" and ends with "*Priority:*" and "*Linked use cases:*" lines
    When the block markdown is rendered
    Then it starts with a "fa-block fa-block-functional-requirement" div
    And it shows "Functional requirement", the id chip "FR-AN-01" and the body text on one line
    And the bold lead "**FR-AN-01.**" is gone
    And the cut title "stock…" does not appear

  @test:pipeline/render-markdown-numbering.test.ts::structured_blocks:_a_light_card::trailing_*Label:*_lines_become_the_metadata_row
  Scenario: Trailing *Label:* lines become the metadata row
    Given a functional requirement "FR-AN-01" whose title is cut with "…" and whose body opens "**FR-AN-01.**" and ends with "*Priority:*" and "*Linked use cases:*" lines
    When the block markdown is rendered
    Then the "*Priority:*" and "*Linked use cases:*" line sits in a "fa-block-meta" div

  @test:pipeline/render-markdown-numbering.test.ts::structured_blocks:_a_light_card::an_id_with_a_title_in_its_bold_lead_keeps_the_title
  Scenario: An id with a title in its bold lead keeps the title
    Given a non-functional requirement "NFR-01" whose body opens "**NFR-01 Security.**"
    When the block markdown is rendered
    Then it shows "Non-functional requirement", the id chip "NFR-01", then "**Security.** Data are protected."

  @test:pipeline/render-markdown-numbering.test.ts::structured_blocks:_a_light_card::a_list_body_keeps_the_heading_on_its_own_line,_and_the_text_is_otherwise_unchanged
  Scenario: A list body keeps the heading on its own line and the text unchanged
    Given a user scenario titled "X" whose body is a list followed by a code block with blank lines
    When the block markdown is rendered
    Then the kind "User scenario" and "**X.**" are followed by a blank line and the body unchanged

  @test:pipeline/render-markdown-numbering.test.ts::structured_blocks:_a_light_card::an_indicator_shows_its_id,_its_calculation_as_a_fraction,_and_its_module_and_disaggregation
  Scenario: An indicator shows its id, its calculation as a fraction, and its module and disaggregation
    Given an indicator "1-01" titled "Density of health workers" with numerator, denominator, unit "10 000", module "1" and disaggregation "occupation; sex"
    When the block markdown is rendered
    Then it shows "Indicator", the id chip "1-01", the bold title and the body on one line
    And the numerator "Active health workers" is labelled "Numerator"
    And the unit reads "× 10 000"
    And the row reads "*Module:* 1 · *Disaggregation:* occupation; sex"

  @test:pipeline/render-markdown-numbering.test.ts::structured_blocks:_a_light_card::an_indicator_whose_text_already_gives_the_numerator_is_not_repeated
  Scenario: An indicator whose text already gives the numerator is not repeated
    Given an indicator with numerator "A" and denominator "B" whose body already has "*Numerator:* A. *Denominator:* B."
    When the block markdown is rendered
    Then it contains no "fa-block-ratio"

  @test:pipeline/render-markdown-numbering.test.ts::structured_blocks:_a_light_card::prose_and_numbered_kinds_are_not_cards
  Scenario: Prose and numbered kinds are not cards
    When a prose block is rendered
    Then it contains no "fa-block"
    When a numbered figure is rendered
    Then it contains no "fa-block " card class
