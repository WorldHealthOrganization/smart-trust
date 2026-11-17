# scripts/check-escaped-markup.ts scans a built site's HTML pages for block-level markup that was escaped into
# visible text, and for markdown tables printed as text, while ignoring markup displayed inside code and pre.
# Each Scenario names the test that executes it.
Feature: A built page carries no escaped block markup or leaked markdown table

  @test:scripts/tests/check-escaped-markup.test.ts::escapedTagsIn::finds_the_opening_tag_the_broken_build_shipped
  Scenario: The escaped opening article tag that shipped is found
    Given the landing page as the broken build published it, with an escaped article tag whose attributes are welded
    When escaped tags are found in it
    Then exactly one escaped "article" opening tag is reported
    And its excerpt contains "fa-landing-sticky"

  @test:scripts/tests/check-escaped-markup.test.ts::escapedTagsIn::finds_the_closing_tag_too_—_Kramdown_escapes_the_whole_span,_not_just_the_start
  Scenario: The escaped closing article tag is found too
    Given the landing page as the broken build published it
    When escaped tags are found in it
    Then exactly one escaped "article" closing tag is reported

  @test:scripts/tests/check-escaped-markup.test.ts::escapedTagsIn::a_correctly_rendered_article_is_not_a_finding
  Scenario: The same page with real markup is clean
    Given the shipped landing page with every escaped bracket turned back into a real one
    When escaped tags are found in it
    Then there are none

  @test:scripts/tests/check-escaped-markup.test.ts::escapedTagsIn::escaped_markup_inside_<code>_is_DISPLAYED_markup,_not_leaked_markup
  Scenario: Escaped markup inside code is displayed markup, not a finding
    Given a page quoting "&lt;section&gt;/&lt;block&gt;/…" and an escaped table tag, each inside code
    When escaped tags are found in it
    Then there are none

  @test:scripts/tests/check-escaped-markup.test.ts::escapedTagsIn::...and_inside_<pre>_likewise
  Scenario: Escaped markup inside pre is not a finding
    Given a page with an escaped article opening and closing tag inside pre and code
    When escaped tags are found in it
    Then there are none

  @test:scripts/tests/check-escaped-markup.test.ts::escapedTagsIn::the_SAME_tag_outside_a_code_region_is_still_reported
  Scenario: The same escaped tag outside a code region is still reported
    Given a page with an escaped article tag inside code and another, with class "x", inside a div
    When escaped tags are found in it
    Then exactly one is reported
    And its excerpt contains 'class="x"'

  @test:scripts/tests/check-escaped-markup.test.ts::escapedTagsIn::a_prose_word_that_merely_starts_with_a_tag_name_is_not_a_tag
  Scenario: A word that starts with a tag name is not a tag
    Given a paragraph with "&lt;articles" and "&lt;tabled"
    When escaped tags are found in it
    Then there are none

  @test:scripts/tests/check-escaped-markup.test.ts::escapedTagsIn::an_excerpt_quotes_the_real_page,_not_the_blanked_copy_scanned_over
  Scenario: An excerpt quotes the real page rather than the blanked copy
    Given a page with an escaped ul inside code followed by an escaped article tag carrying "keep-me"
    When escaped tags are found in it
    Then exactly one is reported
    And its excerpt contains "keep-me"

  @test:scripts/tests/check-escaped-markup.test.ts::blankCodeRegions::preserves_length,_so_every_later_offset_still_points_at_the_real_page
  Scenario: Blanking code regions preserves the page length
    Given a page with a code region between two paragraphs
    When its code regions are blanked
    Then the result has the same length as the page

  @test:scripts/tests/check-escaped-markup.test.ts::blankCodeRegions::leaves_everything_outside_code_and_pre_untouched
  Scenario: Blanking leaves a page with no code region unchanged
    Given a div holding an escaped article tag and no code or pre
    When its code regions are blanked
    Then the result is identical to the page

  @test:scripts/tests/check-escaped-markup.test.ts::BLOCK_TAGS::covers_structure_and_deliberately_omits_the_inline_elements_this_repo_documents
  Scenario: The block tag list covers structure and omits picture and source
    Then the block tags include "article"
    And they do not include "picture" or "source"

  @test:scripts/tests/check-escaped-markup.test.ts::checkEscapedMarkup::reports_the_page_a_finding_is_on,_and_counts_pages_scanned
  Scenario: The tree scan names the page a finding is on and counts only HTML pages
    Given a tree with the shipped index.html, a clean sub/ok.html and a data.json holding escaped markup
    When the tree is checked
    Then 2 pages are scanned
    And every finding is on "index.html"

  @test:scripts/tests/check-escaped-markup.test.ts::checkEscapedMarkup::a_clean_tree_is_clean_—_the_check_is_not_merely_always_red
  Scenario: A clean tree has no findings
    Given a tree whose only page holds a real article
    When the tree is checked
    Then there are no findings

  @test:scripts/tests/check-escaped-markup.test.ts::checkEscapedMarkup::an_empty_tree_yields_zero_pages_—_which_the_CLI_treats_as_could-not-determine
  Scenario: An empty tree scans zero pages
    # Gap: the CLI's treatment of zero pages as could-not-determine is not exercised
    Given an empty directory
    When the tree is checked
    Then 0 pages are scanned

  @test:scripts/tests/check-escaped-markup.test.ts::htmlPages::walks_nested_directories_and_takes_only_.html/.htm
  Scenario: The page walk descends nested directories and takes only .html and .htm
    Given "a/b/deep.html", "a/page.htm" and "a/styles.css"
    When the HTML pages are listed
    Then 2 pages are found

  @test:scripts/tests/check-escaped-markup.test.ts::a_markdown_table_printed_as_text_—_bean_`7w1a`::finds_the_table_that_shipped,_and_names_it_by_its_header_row
  Scenario: The markdown table printed as text is found and named by its header row
    Given the methodologies page head as the broken build published it, a pipe table inside a paragraph
    When leaked tables are found in it
    Then exactly one is reported on "methodologies/index.html"
    And its excerpt is "| methodology | applies when | origin held? | declared by |"

  @test:scripts/tests/check-escaped-markup.test.ts::a_markdown_table_printed_as_text_—_bean_`7w1a`::accepts_the_other_spellings_a_converter_may_emit
  Scenario: Other delimiter row spellings are recognised
    Given leaked tables whose delimiter rows are "|---|---|", "| :---: | --- |", "|&mdash;|&mdash;|" and "---|---"
    When leaked tables are found in each
    Then each yields one finding

  @test:scripts/tests/check-escaped-markup.test.ts::a_markdown_table_printed_as_text_—_bean_`7w1a`::a_table_that_RENDERED_is_not_a_finding
  Scenario: A rendered HTML table is not a finding
    Given a real table element with a header and a body row
    When leaked tables are found in it
    Then there are none

  @test:scripts/tests/check-escaped-markup.test.ts::a_markdown_table_printed_as_text_—_bean_`7w1a`::a_table's_SOURCE_shown_in_a_code_block_is_documentation,_not_a_leak
  Scenario: A table's source shown in a code block is not a leak
    Given a pipe table inside pre and code
    When leaked tables are found in it
    Then there are none

  @test:scripts/tests/check-escaped-markup.test.ts::a_markdown_table_printed_as_text_—_bean_`7w1a`::the_tree_scan_reports_it
  Scenario: The tree scan reports a leaked table
    Given a tree whose index.html is the shipped methodologies table
    When the tree is checked
    Then one leaked table is reported

  @test:scripts/tests/check-escaped-markup.test.ts::a_markdown_table_printed_as_text_—_bean_`7w1a`::a_prose_pipe,_a_dash_rule_or_a_lone_dash_is_not_a_delimiter_row
  Scenario: A prose pipe, a lone dash or a horizontal rule is not a leaked table
    Given paragraphs "a | b", "—" and "a — b | c" and an hr element
    When leaked tables are found in them
    Then there are none

  @test:scripts/tests/check-escaped-markup.test.ts::a_markdown_table_printed_as_text_—_bean_`7w1a`::a_HEADER-ONLY_table_—_no_body_row,_so_the_delimiter_closes_the_paragraph_on_its_line
  Scenario: A header-only table whose delimiter closes the paragraph is found
    Given a paragraph holding "| role | file | |" and "|—|—|—|" ending in the closing p tag
    When leaked tables are found in "tools/x/index.html"
    Then there is exactly one finding for that page
    And its excerpt is "| role | file | |"

  @test:scripts/tests/check-escaped-markup.test.ts::a_markdown_table_printed_as_text_—_bean_`7w1a`::a_table_straight_under_a_heading_—_read_as_one_paragraph_with_mixed_dash_runs
  Scenario: A table joined to the paragraph under a heading is found with mixed dash runs
    Given an h5 heading followed by a paragraph holding a header, a delimiter and a body row
    And delimiter rows "|——-|——-|——-|", "| —– | :—-: |" and "|&mdash;&ndash;|&#8212;-|"
    When leaked tables are found in each
    Then each yields one finding

  @test:scripts/tests/check-escaped-markup.test.ts::a_markdown_table_printed_as_text_—_bean_`7w1a`::a_row_that_opens_straight_after_a_tag,_or_shares_a_line_with_its_header
  Scenario: A delimiter right after a tag or after a line break in the header's line is found
    Given a paragraph that is only "|—|—|"
    When leaked tables are found in it
    Then there is one finding
    And given a paragraph "| a | b |" then a br and "|—|—|" on the same line
    Then there is one finding whose excerpt is "| a | b |"

  @test:scripts/tests/check-escaped-markup.test.ts::a_markdown_table_printed_as_text_—_bean_`7w1a`::one_cell_is_enough_—_a_one-column_table_leaks_as_`|—|`
  Scenario: A one-column leaked table is found
    Given a paragraph holding "| only |" and "|—|"
    When leaked tables are found in it
    Then there is one finding

  @test:scripts/tests/check-escaped-markup.test.ts::a_markdown_table_printed_as_text_—_bean_`7w1a`::a_delimiter_inside_<script>,_<style>_or_<textarea>_is_data,_not_a_leak
  Scenario: A table inside script, style or textarea is not a leak
    Given a header and delimiter row inside each of script, style and textarea
    When leaked tables are found in each
    Then there are none

  @test:scripts/tests/check-escaped-markup.test.ts::a_markdown_table_printed_as_text_—_bean_`7w1a`::a_RENDERED_table_is_still_not_a_finding,_whatever_its_cells_hold
  Scenario: A rendered table is not a finding even when its cells hold dashes or pipes
    Given a real table element whose cells hold "—", "-" and a code "|---|"
    When leaked tables are found in it
    Then there are none

  @test:scripts/tests/check-escaped-markup.test.ts::a_markdown_table_printed_as_text_—_bean_`7w1a`::a_row_after_a_`>`_is_found_even_when_an_earlier_pipe_shares_its_line
  Scenario: A row that starts after a `>` is found though an earlier pipe sits on its line
    Given the text "<p>| a |> -| &mdash;</p>"
    When leaked tables are found in it
    Then one row is found, named "| a |", the text above it

  @test:scripts/tests/check-escaped-markup.test.ts::a_markdown_table_printed_as_text_—_bean_`7w1a`::a_long_page_with_pipes_but_no_row_is_read_in_one_pass
  Scenario: A long page full of prose pipes is scanned in linear time
    Given 50,000 paragraphs holding a prose pipe and one leaked one-column table
    When leaked tables are found in it
    Then the one table is found within two seconds

  @test:scripts/tests/check-escaped-markup.test.ts::a_markdown_table_printed_as_text_—_bean_`7w1a`::a_report_excerpt_is_plain_text,_with_no_angle_bracket_left
  Scenario: A report excerpt keeps the text and drops every tag and angle bracket
    Given text holding tags, a nested tag and stray angle brackets
    When it is reduced to plain text
    Then the text survives and no "<" or ">" is left
