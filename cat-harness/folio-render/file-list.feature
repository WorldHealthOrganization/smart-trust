# The harness's minimal folio renderer. Each Scenario names the test that
# executes it, in the grammar @test:<file>::<scope>::<name> (skill
# test-engineer, "Every test has a Gherkin").
Feature: The folio is rendered as the list of files it holds

  @test:folio-render/file-list.test.ts::folioFileList::lists_every_file,_recursively_and_sorted,_but_not_the_page_or_dot-files
  Scenario: Every file is listed, recursively and sorted, except the page and dot-files
    Given a folio holding cat-harness.json, notes/a b.md, render/file-list.ts, the folio page and a dot-file
    When its files are listed
    Then the list is cat-harness.json, notes/a b.md and render/file-list.ts, in that order, each with its size in bytes
    And neither the folio page nor the dot-file is listed

  @test:folio-render/file-list.test.ts::folioFileList::a_folio_directory_that_does_not_exist_lists_nothing,_rather_than_throwing
  Scenario: A folio directory that does not exist lists nothing
    Given a folio directory that does not exist
    When its files are listed
    Then the list is empty and nothing is thrown

  @test:folio-render/file-list.test.ts::renderFolioPage::is_a_just-the-docs_page_that_says_what_a_folio_is_and_links_each_file_relatively
  Scenario: The folio page is a just-the-docs page that links each file relatively
    Given the instance title "C@T Harness" and one 2048-byte file notes/a b.md
    When the folio page is rendered
    Then it opens with front matter of layout default and title "C@T Harness — folio"
    And it says what a folio is
    And its table row links notes/a b.md relatively, with the space encoded, and gives its size as 2.0 KB

  @test:folio-render/file-list.test.ts::renderFolioPage::an_empty_folio_says_so_instead_of_drawing_an_empty_table
  Scenario: An empty folio says so instead of drawing an empty table
    Given a folio with no files
    When the folio page is rendered
    Then it says the folio holds no files
    And it has no file table

  @test:folio-render/file-list.test.ts::renderFolioPage::sizes_read_as_a_person_would_say_them
  Scenario: Sizes read as a person would say them
    When 12 bytes, 1536 bytes and 5 MiB are formatted
    Then they read "12 B", "1.5 KB" and "5.0 MB"
