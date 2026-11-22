# Specifies methodologyRows, page, pageRelPath and short
# (scripts/gen-methodologies-viz.ts) over the checkout's real methodology
# corpus, with checkMethodologyEvidence's report.
Feature: The methodologies page over the real corpus has working links, sound tables and true counts

  @test:test/coordinator/methodologies-viz-checkout.test.ts::the_page_a_reader_gets_—_over_the_REAL_corpus::the_graph_is_found_at_all_—_`undetermined`_is_not_a_clean_run
  Scenario: The methodology graph is found and has rows
    Given the methodology evidence report of the cat-harness instance
    When the page rows are built
    Then the report is not undetermined
    And there is at least one row

  @test:test/coordinator/methodologies-viz-checkout.test.ts::the_page_a_reader_gets_—_over_the_REAL_corpus::every_row's_link_resolves_to_an_anchor_ON_THIS_PAGE
  Scenario: Every row's link resolves to an anchor on the page
    Given the page as rendered now and the page as committed under the declared path
    When the links and the anchors (explicit "<a id>" or kramdown heading ids) of each are collected
    Then each page has one link per row
    And every link targets an anchor on the same page

  @test:test/coordinator/methodologies-viz-checkout.test.ts::the_page_a_reader_gets_—_over_the_REAL_corpus::no_cell_breaks_the_table_it_sits_in
  Scenario: Every table row has its header's number of columns
    Given the rendered page
    When the rows after the "| methodology |" header are split on unescaped pipes
    Then the header is found
    And each row has as many columns as the header

  @test:test/coordinator/methodologies-viz-checkout.test.ts::the_page_a_reader_gets_—_over_the_REAL_corpus::no_row_leaves_a_code_span_open_—_the_defect_that_printed_the_table_as_text
  Scenario: No table row leaves a code span open
    Given the page as rendered now and as committed
    When the table rows after the "| methodology |" header are read
    Then the header is found and there is one table row per methodology row
    And every table row has an even number of backticks

  @test:test/coordinator/methodologies-viz-checkout.test.ts::the_page_a_reader_gets_—_over_the_REAL_corpus::a_cut_that_lands_inside_a_code_span_or_a_bold_run_backs_out_of_it
  Scenario: A cut inside a code span or bold run backs out of it
    Given a 130-character run followed by a code span, and another followed by a bold phrase
    When each is shortened to 140 characters
    Then the shortened code text has an even number of backticks and ends with "…"
    And the shortened bold text has an even number of "**"
    And 200 "z"s shortened to 150 are the first 150 followed by "…"

  @test:test/coordinator/methodologies-viz-checkout.test.ts::the_page_a_reader_gets_—_over_the_REAL_corpus::the_page_is_DECLARED,_not_composed_—_and_under_the_docs_tree
  Scenario: The page path is declared and under the docs tree
    Given the checkout
    When the page's relative path is read
    Then it is defined
    And it does not start with ".."

  @test:test/coordinator/methodologies-viz-checkout.test.ts::the_page_a_reader_gets_—_over_the_REAL_corpus::the_counts_on_the_page_are_the_counts_in_the_rows
  Scenario: The counts on the page are the counts in the rows
    Given the rendered page
    When its "adopted methodologies", "with the source held here" and "cited, not ingested" figures are read
    Then they equal the number of rows, of "ingested" rows and of "cited-only" rows
