# scripts/docs-declarations.ts reads which docs page documents a directory from the pages themselves
# (#1168 B7c): a "documents" front-matter list or meta element. Each Scenario names the test that executes it.
Feature: Docs pages declare the directories they document

  @test:scripts/tests/docs-declarations.test.ts::reading_the_declarations::the_meta_element,_split_on_whitespace_or_commas
  Scenario: The documents meta element is split on whitespace or commas
    Given the meta element content "a, b c"
    When its documents are read
    Then they are "a", "b" and "c"
    And a page with no documents meta declares none

  @test:scripts/tests/docs-declarations.test.ts::reading_the_declarations::markdown_front_matter_and_HTML_meta;_a_page_declaring_nothing_is_not_a_docs_page
  Scenario: Docs pages are read from markdown front matter and HTML meta, and a page declaring nothing is not one
    Given markdown pages declaring documents in front matter, an HTML page with a documents meta, and a markdown page declaring nothing
    When the docs pages are read
    Then they are "domain/docs/index.html", "platform/docs/beans.md", "platform/docs/tool-graph.md" and "stranger/docs/beans.md"
    And the HTML page belongs to instance "domain" and documents "catalogue"

  @test:scripts/tests/docs-declarations.test.ts::which_pages_document_a_directory::a_kind_claim_reaches_every_directory_of_that_kind_within_reach,_and_no_further
  Scenario: A kind claim documents every directory of that kind within reach, and no further
    Given "platform" and "stranger" each hold a page declaring kind "beans", and only "domain" and "platform" are within reach
    When the pages documenting domain's "beans" directory are found
    Then they are only "platform/docs/beans.md"

  @test:scripts/tests/docs-declarations.test.ts::which_pages_document_a_directory::a_directory_claim_names_one_directory,_whatever_its_kind
  Scenario: A directory claim documents one named directory only
    Given a page declaring "platform/tools"
    When the pages documenting platform's "tools" directory are found
    Then they are "platform/docs/tool-graph.md"
    And domain's "tools" directory has no documenting page

  @test:scripts/tests/docs-declarations.test.ts::which_pages_document_a_directory::a_directory_nothing_declares_is_undocumented
  Scenario: A directory no page declares is undocumented
    When the pages documenting domain's "voices" directory are found
    Then there are none
