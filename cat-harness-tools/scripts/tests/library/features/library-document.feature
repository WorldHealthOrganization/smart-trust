# The document view of an ingested library entry (issue #2302, bean turh).
# Each Scenario names the test that executes it.
Feature: The document view of a library entry

  @test:scripts/tests/library/library-document.test.ts::readEntryDocument::reads_the_schema;_TOC_entries_link_to_their_sections;_summary_by_file,_else_extract
  Scenario: The view links TOC to sections, matches summaries by file, else extracts
    Given a pdf-structure entry of two sections, a summary for the methods section's file, and page and figure labels
    When its document view is read
    Then the TOC entries link to the two sections, keeping the second's confidence 0.55
    And the introduction has no summary and its whole short text as an uncut extract
    And the methods section carries its summary text
    And the second page label is "1", the figure's page label is "2", and the figure sequence gap is "table 2"

  @test:scripts/tests/library/library-document.test.ts::readEntryDocument::the_summary_badge_reads_the_narrative_list's_state,_so_a_confirmed_summary_is_not_shown_as_draft
  Scenario: A summary's status comes from its narrative list's state
    Given summaries whose narratives are a draft and a confirmed one
    When the document view is read
    Then the first section's summary status is draft and the second's is confirmed

  @test:scripts/tests/library/library-document.test.ts::readEntryDocument::a_withheld_entry_publishes_no_extract,_and_keeps_structure_and_summaries
  Scenario: A withheld entry publishes no extract
    # Gap: the title says summaries are kept; the entry has no summaries.json and no summary is checked.
    Given an entry with section text, read as withheld
    Then the section's extract is null and the view is marked withheld
    And the TOC still holds two entries

  @test:scripts/tests/library/library-document.test.ts::readEntryDocument::a_field_an_older_ingestion_lacks_is_absent,_not_empty;_no_structure.json_is_null
  Scenario: Fields an older ingestion lacks are absent, and no structure.json is null
    Given an entry whose structure has no pages and no figures
    Then its view has no pageLabels and no figures keys
    And a directory with no structure.json has a null view

  @test:scripts/tests/library/library-document.test.ts::readEntryDocument::an_extract_is_cut_at_a_word_and_says_so
  Scenario: An extract is cut at a word boundary and marked cut
    When the extract of "alpha beta gamma delta" is taken at 12 characters
    Then it is "alpha beta", marked cut

  @test:scripts/tests/library/library-document.test.ts::keywords_in_the_document_view::document_and_section_keywords_from_keywords.json,_heading_evidence_kept;_absent_file_leaves_the_field_absent
  Scenario: Keywords come from keywords.json with their heading evidence
    Given an entry whose keywords.json gives document keywords and keywords for the methods section
    Then the view's keywords are the terms, each marked whether a heading is evidence
    And the methods section's keywords are given and the other section's are empty
    And an entry with no keywords.json has no keywords field

  @test:scripts/tests/library/library-document.test.ts::a_text_source_is_shown_by_its_own_headings,_not_as_a_PDF_(litlfred/dth-hrh)::the_view_says_it_is_a_text_source_and_keeps_its_sections
  Scenario: A text source's view says it is text and keeps its sections
    Given a text-structure/v1 entry with two sections
    When its document view is read
    Then it is not null, its variant is "text" and its sections are the two section ids

  @test:scripts/tests/library/library-document.test.ts::a_text_source_is_shown_by_its_own_headings,_not_as_a_PDF_(litlfred/dth-hrh)::a_PDF_entry_still_says_pdf
  Scenario: A PDF entry's view says pdf
    Given a pdf-structure entry
    When its document view is read
    Then its variant is "pdf"

  @test:scripts/tests/library/library-document.test.ts::plainHeading_—_a_text_heading_as_a_reader_sees_it_(litlfred/dth-hrh)::strips_emphasis_and_escapes,_keeps_the_words
  Scenario: A heading loses emphasis, escapes and code marks
    When headings with **bold**, __bold__, *emphasis*, backtick code and escaped dots are made plain
    Then each keeps only its words and literal punctuation

  @test:scripts/tests/library/library-document.test.ts::plainHeading_—_a_text_heading_as_a_reader_sees_it_(litlfred/dth-hrh)::an_escaped_star_stays_a_star;_words_with_underscores_are_untouched
  Scenario: Escaped stars and underscored words survive
    When "Rating \\*\\*\\* stars", a file name with underscores, and a plain heading are made plain
    Then the stars become literal "***", and the other two are unchanged

  @test:scripts/tests/library/library-document.test.ts::a_Markdown_section's_extract_(litlfred/dth-hrh,_twg-outline)::drops_its_own_heading_and_reads_as_plain_text
  Scenario: A heading-unit section's extract drops its heading and reads as plain text
    Given a text section of unit "heading" whose file starts with front matter and its own heading
    When the document view is read
    Then the section title is the plain heading "Part 4. Examples"
    And its extract is the body as plain text, without links, emphasis or list marks

  @test:scripts/tests/library/library-document.test.ts::a_Markdown_section's_extract_(litlfred/dth-hrh,_twg-outline)::a_whole_verbatim_file_is_left_as_it_is
  Scenario: A whole-file section's extract keeps its Markdown
    # Gap: the title says the file is left as it is; only the start of the extract is checked, not the rest of the text.
    Given a text section of unit "file" with the same Markdown
    When the document view is read
    Then its extract starts with the raw heading "# **Part 4\\. Examples**"

  @test:scripts/tests/library/library-document.test.ts::a_Markdown_table_in_an_extract_(litlfred/dth-hrh,_'Handbook_at_a_glance')::drops_the_delimiter_row_and_reads_each_row_as_its_cells
  Scenario: A Markdown table reads as its rows of cells
    Given a section with a heading and a Markdown table with a delimiter row, bold text and an escaped pipe
    When it is made plain and its whitespace collapsed
    Then the delimiter row is gone and each row reads as its cells joined by "; "

  @test:scripts/tests/library/library-document.test.ts::kept_figures_and_transcribed_tables_(who-iris#224)::a_figure_with_its_WebP_on_disk_is_shown_with_every_language;_others_are_not
  Scenario: Only a figure whose WebP is on disk is shown, with every language of its narrative
    Given an entry listing a figure WebP that is on disk, a decorative PNG, and a figure WebP that is not on disk
    When the entry's document view is read
    Then its images are only "img-p002-1"
    And that image's narratives are "A bar chart." in en and "Un graphique." in fr

  @test:scripts/tests/library/library-document.test.ts::kept_figures_and_transcribed_tables_(who-iris#224)::a_table's_cells_come_from_its_CSV,_header_row_dropped,_quotes_and_newlines_kept
  Scenario: A table's cells come from its CSV, header row dropped, quotes and newlines kept
    Given an entry whose table-1.csv has a header row, a quoted cell with a comma and doubled quotes, and a cell with a newline
    When the entry's document view is read
    Then the table's rows are 'a, "quoted"' and "2", then "x" and "two" newline "lines"
    And its first column is titled "A" in group "G"

  @test:scripts/tests/library/library-document.test.ts::kept_figures_and_transcribed_tables_(who-iris#224)::a_withheld_entry_shows_neither
  Scenario: A withheld entry shows neither figures nor tables
    Given the same entry with figures and tables on disk
    When its document view is read as withheld
    Then it has no images and no tables

  @test:scripts/tests/library/library-document.test.ts::kept_figures_and_transcribed_tables_(who-iris#224)::the_view_the_generator_writes,_with_figures_and_tables,_is_one_the_schema_accepts
  Scenario: The view the generator writes, with figures and tables, passes the strict document schema
    Given the same entry, read with repository links
    When its document view is round-tripped through JSON and checked against the library document schema
    Then it has one image and one table
    And the schema reports no issues

  @test:scripts/tests/library/library-document.test.ts::kept_figures_and_transcribed_tables_(who-iris#224)::the_site_copies_exactly_the_files_the_page_shows
  Scenario: The site copies exactly the files the page shows
    Given the same entry
    When its figure files are listed
    Then they are "images/img-p002-1.webp" and "tables/table-1.csv"

  @test:scripts/tests/library/library-document.test.ts::the_Contents_tree::toc_present:_the_tree_is_the_outline,_as_before
  Scenario: With a table of contents, the Contents tree is the PDF's outline
    Given a document view with a three-entry outline and a section "Not in the outline" that no entry names
    When its Contents tab is rendered
    Then it says "Source: the PDF’s own outline. 3 entries." and offers "Expand all"
    And the entry "1 One" links to section "s1"
    And "Not in the outline" does not appear
    And opening the first node shows "1.1 One A"

  @test:scripts/tests/library/library-document.test.ts::the_Contents_tree::an_inferred_contents_gains_the_sections_it_does_not_list,_at_their_place
  Scenario: Sections an inferred contents does not list are still in the tree
    When the contents were inferred and some sections are named by no entry
    Then each is placed by its first page at its own level, marked as not listed, and the note counts them

  @test:scripts/tests/library/library-document.test.ts::the_Contents_tree::toc_absent:_the_tree_is_built_from_the_sections,_nested_by_level
  Scenario: Without a table of contents, the Contents tree is built from the sections, nested by level
    Given a document view with no outline and two level-1 sections "Page 1" and "Page 2"
    When its Contents tab is rendered
    Then it says "so its sections are listed. 2 sections." and not "No table of contents"
    And both sections are linked by their ids
    When a view with "Part A", level-2 "Chapter A1" and "Part B" is rendered
    Then "Part A" and "Part B" are at the top
    And opening the first node shows "Chapter A1"

  @test:scripts/tests/library/library-document.test.ts::the_Contents_tree::blocks_appear_as_leaves_under_their_own_section,_by_contains_or_by_target
  Scenario: Blocks appear as leaves under their own section, by the section's contains or by the block's target
    Given section "Page 1" containing a prose block, section "Page 2" containing none, and a prose block targeting Page 2's file and a figure naming no section
    When the Contents tree is rendered and both nodes are opened
    Then Page 1 shows its prose block as a leaf titled by its first words, "Opening words of the first page…"
    And Page 1 does not show Page 2's prose block
    And Page 2 shows its prose block, placed by target
    And the figure appears under neither section

  @test:scripts/tests/library/library-document.test.ts::the_Contents_tree::children_are_built_only_when_a_node_is_first_opened
  Scenario: A tree node's children are built only when it is first opened
    Given two sections, the first containing a block
    When the Contents tree is rendered
    Then node 0 is a closed details element with an empty children list and no block rows
    And opening node 0 builds its block rows
    When a view with a single section is rendered
    Then that node is open at once and its children are already built

  @test:scripts/tests/library/library-document.test.ts::the_Contents_tree::the_generator_reads_each_section's_blocks_from_its_node,_and_the_viewer_anchors_each_block_row
  Scenario: The generator reads each section's blocks from its node, and the viewer anchors each block row
    # Gap: the viewer half is a source-text check of the viewer script, not a rendered page
    Given an entry whose first section's node contains two blocks and a sub-section
    When the entry's document view is read
    Then the first section's blocks are "e/blocks/prose-sec-000" and "e/blocks/figure-1", without the sub-section
    And the second section has no blocks field
    And the view passes the library document schema
    And the viewer script stores the loaded blocks and gives each block table row an anchor id

  @test:scripts/tests/library/library-document.test.ts::kept_figures_and_transcribed_tables_(who-iris#224)::a_vector_figure_kept_as_PNG_is_shown_and_copied
  Scenario: A vector figure kept as PNG is shown and copied
    Given a vector figure rendered as a PNG file
    When the entry's document view is built
    Then the figure is included in the view and its PNG is copied

  @test:scripts/tests/library/library-document.test.ts::what_was_extracted_(coverage)::a_References_heading_is_found_but_its_entries_are_not_extracted;_no_glossary_heading_is_'none'
  Scenario: A References heading is found without extracted entries and an absent glossary heading is none
    Given an entry with a References section heading and no glossary heading
    When extraction coverage is computed
    Then references is found-not-extracted and glossary is none

  @test:scripts/tests/library/library-document.test.ts::what_was_extracted_(coverage)::a_page-split_entry_says_its_contents_were_not_extracted_and_its_sections_are_pages
  Scenario: A page-split entry reports unextracted contents and page sections
    Given an entry whose sections are page-split
    When extraction coverage is computed
    Then it reports that contents were not extracted and its sections are pages

  @test:scripts/tests/library/library-document.test.ts::what_was_extracted_(coverage)::the_ingest's_extraction.json_wins_for_the_kinds_it_names
  Scenario: The ingest's extraction.json overrides inferred coverage for the kinds it names
    Given an entry carrying an extraction.json record
    When extraction coverage is computed
    Then the kinds named in extraction.json take their status from that record

  @test:scripts/tests/library/library-document.test.ts::what_was_extracted_(coverage)::the_view_with_coverage_is_one_the_schema_accepts
  Scenario: A document view carrying extraction coverage validates against the schema
    Given a document view with extraction coverage populated
    When it is validated against the library document schema
    Then validation succeeds
