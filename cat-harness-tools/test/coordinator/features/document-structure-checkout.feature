# Specifies structureOf (schemas/content/document-structure.ts) over every
# structure.json committed in the checkout, as gitCorpus lists them.
Feature: structureOf reads every committed structure as its own variant

  @test:test/coordinator/document-structure-checkout.test.ts::structureOf_reads_every_committed_structure,_each_as_its_own_variant::there_are_committed_files_to_read_—_the_guard_every_assertion_below_needs
  Scenario: There are committed structure files to read
    Given the committed files ending in "/structure.json"
    When they are counted
    Then there are more than 10

  @test:test/coordinator/document-structure-checkout.test.ts::structureOf_reads_every_committed_structure,_each_as_its_own_variant::each_reads_as_a_declared_variant,_with_that_variant's_locator
  Scenario: Each structure reads as a declared variant with that variant's locator
    Given every committed structure file
    When each is read with structureOf
    Then none is unreadable
    And every section's locator is "pages" for pdf, "cells" for notebook and "lines" for text

  @test:test/coordinator/document-structure-checkout.test.ts::structureOf_reads_every_committed_structure,_each_as_its_own_variant::every_variant_is_present_in_the_corpus,_so_none_is_vacuous
  Scenario: Every variant is present in the corpus
    Given every committed structure file
    When the variants they read as are collected
    Then they are exactly notebook, pdf and text
