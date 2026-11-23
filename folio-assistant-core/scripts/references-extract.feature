Feature: a document's reference lists split into its own bibliography

  @test:scripts/references-extract.test.ts::splitEntries::a_numbered_list_splits_on_its_own_numbers,_with_the_number_on_its_own_line
  Scenario: a numbered list
    When a reference list numbers its entries, with the number on a line of its own
    Then each number opens one entry and the wrapped lines join into it

  @test:scripts/references-extract.test.ts::splitEntries::an_unnumbered_list_splits_where_an_entry_closes_and_the_next_opens
  Scenario: an unnumbered list
    When a reference list does not number its entries
    Then an entry ends where a line closes a citation and the next line opens with a capital

  @test:scripts/references-extract.test.ts::splitEntries::a_page_number_and_a_running_head_between_entries_are_skipped
  Scenario: page furniture between entries
    When a page number or a running head sits between two entries
    Then it is not part of either entry

  @test:scripts/references-extract.test.ts::joinLines_keeps_a_wrapped_web_address_whole
  Scenario: a web address wrapped over two lines
    When an entry's web address is broken at a line end
    Then the address is joined without a space

  @test:scripts/references-extract.test.ts::toReference::reads_only_what_is_unambiguous:_address,_year_of_the_work_(not_of_access),_access_date
  Scenario: only fields read without guessing
    When an entry is turned into a reference node
    Then it keeps the printed text, the address, the work's year and the access date
    And no title is parsed

  @test:scripts/references-extract.test.ts::toReference::a_journal_citation_is_an_article,_with_its_DOI
  Scenario: a journal article
    When an entry has a journal's year;volume:pages
    Then the node is an article-journal with its DOI

  @test:scripts/references-extract.test.ts::toReference::French_access_dates_are_access_dates
  Scenario: an access date in French
    When an entry says consulté le
    Then that date is the access date and not the work's year

  @test:scripts/references-extract.test.ts::irisHandle_reads_handle_and_bitstream_addresses
  Scenario: a cited IRIS item
    When an entry's address is an IRIS handle or bitstream
    Then the handle is read as the catalogue's item id

  @test:scripts/references-extract.test.ts::listsOf::a_whole_References_section,_and_a_chapter-end_list_under_a_heading_inside_a_section
  Scenario: where a list is
    When a section is titled References, or a section holds a References heading
    Then each is a list, and an annex heading ends the one inside the section

  @test:scripts/references-extract.test.ts::listsOf::a_contents_line_naming_References_is_not_a_list
  Scenario: a contents page
    When a contents page names References with a page number
    Then no list is read from it

  @test:scripts/references-extract.test.ts::listsOf::a_list_at_a_page's_foot_reads_on_into_the_next_page,_which_then_holds_no_list_of_its_own
  Scenario: a list over a page break
    When an entry is read one page per section and a list runs onto the next page
    Then it is one list, read once

  @test:scripts/references-extract.test.ts::listsOf::a_whole_References_section_that_opens_with_the_previous_page's_footnote_reads_the_list_after_its_heading
  Scenario: a References section that opens with a stray footnote
    When an inferred split puts the page before's footnote above the References heading
    Then the list is read from after the heading, every entry of it

  @test:scripts/references-extract.test.ts::listsOf::headings_in_the_six_UN_languages
  Scenario: headings in other languages
    When the heading is Références, Referencias, Литература, المراجع or 参考文献
    Then the list under it is read

  @test:scripts/references-extract.test.ts::control_characters_in_the_text_layer::a_BEL_before_an_entry_is_dropped,_not_kept_in_`printed`
  Scenario: a control character in the text layer
    When an entry's text opens with a BEL character
    Then the reference's printed text is the entry without it
