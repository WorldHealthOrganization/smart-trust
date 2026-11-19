# Specifies the generated skill reference pages (reference/skill-instructions
# under the cat-harness site): every source and edit link on a published page
# names a file in the checkout. Skipped where the site is not built.
Feature: Generated skill pages link sources that exist

  @test:test/coordinator/skill-doc-source-links-checkout.test.ts::generated_skill_pages_link_a_source_that_exists::the_corpus_is_not_empty_—_the_guard_every_assertion_below_needs
  Scenario: More than 100 skill pages are published
    Given the generated skill reference index
    When the pages it links are collected
    Then there are more than 100

  @test:test/coordinator/skill-doc-source-links-checkout.test.ts::generated_skill_pages_link_a_source_that_exists::every_source_and_edit_link_on_a_published_page_resolves
  Scenario: Every source and edit link on a published page resolves
    Given every published skill page
    When its GitHub blob and edit links to folio-assistant main are read
    Then each linked path, without its fragment, exists in the checkout and does not climb with ".."
    And more than 100 links were checked
