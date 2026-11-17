# The library viewer's rows and banner for a withheld entry (issue #1794),
# evaluated from the same browser code the page embeds.
Feature: The library viewer for a withheld entry

  @test:scripts/tests/library/library-withheld-view.test.ts::a_row_of_a_withheld_entry::with_a_summary_renders_the_summary,_marked_as_a_summary
  Scenario: A withheld entry's summarised row shows the summary
    Given a withheld entry and a block with no content and a drafted summary
    When the row body is rendered
    Then it shows the summary text and says it is "not its text"
    And it says neither "Withheld" nor "no content carried"

  @test:scripts/tests/library/library-withheld-view.test.ts::a_row_of_a_withheld_entry::without_one_renders_the_gate's_own_words_and_links_the_catalogue_record_page
  Scenario: A withheld entry's unsummarised row names the gate and links the record
    Given a withheld entry refused by the copyright gate, with a published record page
    And a block with no content and no summary
    When the row body is rendered
    Then it says "Withheld — copyright not granted"
    And it links the record page under the site root
    And it does not say "no content carried"

  @test:scripts/tests/library/library-withheld-view.test.ts::a_row_of_a_withheld_entry::names_every_refusing_gate,_not_only_copyright
  Scenario: Every refusing gate is named
    Given a withheld entry refused by the copyright and restrictions gates
    When an unsummarised row body is rendered
    Then it says "Withheld — copyright and restrictions not granted"

  @test:scripts/tests/library/library-withheld-view.test.ts::a_row_of_a_withheld_entry::falls_back_to_the_upstream_URI_when_no_record_page_is_published
  Scenario: The upstream URI is linked when no record page is published
    Given a withheld entry whose record has an upstream URI and no page
    When an unsummarised row body is rendered
    Then it links the upstream URI

  @test:scripts/tests/library/library-withheld-view.test.ts::a_row_of_a_withheld_entry::says_the_recorded_sentence,_and_links_nothing,_when_the_list_carried_no_structure
  Scenario: An unstructured withheld sentence is shown without a link
    Given an entry withheld with the bare sentence "copyright refused"
    When an unsummarised row body is rendered
    Then it says "Withheld — copyright refused"
    And it holds no link

  @test:scripts/tests/library/library-withheld-view.test.ts::a_row_of_an_entry_that_is_NOT_withheld::an_empty_block_keeps_the_neutral_text_—_emptiness_is_not_withholding
  Scenario: An empty block of an open entry keeps the neutral text
    Given an entry that is not withheld and a block with no content or summary
    When the row body is rendered
    Then it says "(no content carried)" and not "Withheld"

  @test:scripts/tests/library/library-withheld-view.test.ts::a_row_of_an_entry_that_is_NOT_withheld::a_summary_with_no_content_is_still_shown
  Scenario: An open entry's summary with no content is shown
    Given an entry that is not withheld and a block with a summary but no content
    When the row body is rendered
    Then it shows the summary text

  @test:scripts/tests/library/library-withheld-view.test.ts::a_row_of_an_entry_that_is_NOT_withheld::content_is_shown_beside_its_summary,_as_before
  Scenario: An open entry's content is shown beside its summary
    Given an entry that is not withheld and a block with both content and a summary
    When the row body is rendered
    Then it shows the content and an "Agent summary"

  @test:scripts/tests/library/library-withheld-view.test.ts::the_withheld_banner::appears_on_a_withheld_entry:_why,_which_gate,_the_record,_and_the_summary_count
  Scenario: A withheld entry has a banner
    Given a withheld entry with three blocks, one summarised
    When its banner is rendered
    Then it is a wh-banner saying "not published" and "copyright not granted"
    And it links the record page
    And it says 1 of 3 sections summarised

  @test:scripts/tests/library/library-withheld-view.test.ts::the_withheld_banner::does_not_appear_on_any_other_entry,_empty_or_not
  Scenario: No other entry has a banner
    When the banner is rendered for an open entry, or for no entry
    Then it is empty

  @test:scripts/tests/library/library-withheld-view.test.ts::the_generated_viewer_uses_this_code::embeds_it_verbatim
  Scenario: The viewer script embeds the withheld-view code verbatim
    Given the generated viewer script
    Then it contains the withheld-view code

  @test:scripts/tests/library/library-withheld-view.test.ts::the_generated_viewer_uses_this_code::routes_every_row_through_blockBody_and_puts_the_banner_above_the_rows
  Scenario: The viewer script calls blockBody and withheldBanner
    # Gap: the title claims the banner is placed ABOVE the rows and EVERY row goes through blockBody; the body checks only that the three call strings occur, not their order or that no other row path exists.
    Given the generated viewer script
    Then it contains the blockBody call for a row, the withheldBanner call and the loadBlocks call
