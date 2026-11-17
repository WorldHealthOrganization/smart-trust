# The keyword viewer page (scripts/lib/keywords-page.ts): keyword variants side by side, an A-Z
# index of the default variant, and agreement with headings, author keywords and glossaries,
# drawn over a fixture model. Each Scenario names the test that executes it.
Feature: Keyword viewer page

  @test:scripts/tests/keywords-page.test.ts::author_keyword_lines::reads_Keywords:_and_Index_Terms—_lines,_split_on_commas_and_semicolons
  Scenario: Author keyword lines are read from Keywords: and Index Terms lines
    Given text with a "Keywords:" line separated by commas and a semicolon
    When its author keywords are read
    Then they are "SWOT Matrix", "TOWS Analysis" and "Planning", without the trailing full stop
    And an "Index Terms—" line gives "rdm" and "research data management"
    And prose merely containing the word keywords gives none

  @test:scripts/tests/keywords-page.test.ts::agreement::heading_share_is_over_sections;_author_share_over_entries_with_a_line;_glossary_over_document_keywords
  Scenario: Agreement shares are taken over sections, author lines and document keywords
    Given a fixture model with variants "a" and "b" over two entries, one with an author keyword line
    When agreement is computed
    Then variant "a" has a heading share of 0.5 and "b" of 0
    And variant "a" has an author share of 1 and "b" of 0
    And one entry carries an author line
    And variant "a" has a glossary share of 0.5

  @test:scripts/tests/keywords-page.test.ts::agreement::a_variant_overlaps_itself_fully
  Scenario: A variant overlaps itself fully
    Given the agreement over the fixture model
    Then the overlap of "a" with "a" is 1
    And the overlap of "a" with "b" is 0.5

  @test:scripts/tests/keywords-page.test.ts::the_page::names_every_variant_and_links_its_method_on_the_evidence_page
  Scenario: The page names every variant and links its method on the evidence page
    Given the page rendered from the fixture model
    Then it has a row for "a" marked default linking "lsi" to "../#lsi"
    And it links "correspondence-analysis" to "../#correspondence-analysis"

  @test:scripts/tests/keywords-page.test.ts::the_page::indexes_the_default_variant_A–Z,_linking_each_entry
  Scenario: The page indexes the default variant A-Z, linking each entry
    Given the page rendered from the fixture model
    Then it has the heading "### D {#kw-d}"
    And "decision table" links to paper-one's library page
    And "glossary" names paper-two without a link, since it has no href

  @test:scripts/tests/keywords-page.test.ts::the_page::shows_each_entry's_variants_side_by_side,_with_its_author_keywords
  Scenario: The page shows each entry's variants side by side with its author keywords
    Given the page rendered from the fixture model
    Then it lists "author keywords: Decision Table, Sweep algorithm"
    And a row shows "decision table" beside "notation | pipe" with the pipe escaped

  @test:scripts/tests/keywords-page.test.ts::the_page::a_backslash_in_a_term_is_escaped,_so_it_cannot_unescape_the_cell_bar_after_it
  Scenario: A backslash in a term is escaped so it cannot unescape the cell bar after it
    Given an entry whose default-variant term ends in a backslash
    When the page is rendered
    Then the row shows the backslash doubled before the cell bar

  @test:scripts/tests/keywords-page.test.ts::the_page::every_table_row_has_as_many_cells_as_its_header
  Scenario: Every table row has as many cells as its header
    Given the page rendered from the fixture model
    When each table's rows are counted, ignoring escaped bars
    Then every row has the same number of cells as its table's first row

  @test:scripts/tests/keywords-page.test.ts::the_page::each_entry's_details_block_lets_kramdown_read_the_table_inside_it
  Scenario: Each entry's details block lets kramdown read the table inside it
    Given the page rendered from the fixture model
    When each entry's details block is opened
    Then it carries markdown="1", so the variants table renders as a table
