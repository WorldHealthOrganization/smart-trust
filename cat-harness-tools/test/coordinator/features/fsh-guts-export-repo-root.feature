# Specifies buildFshGutsExport and fshGutsDirs (scripts/fsh-guts-export.ts)
# over the checkout's root-declared trashcan, and over a throwaway instance
# that declares none.
Feature: The fsh-guts export reads the declared trashcan and keeps every summary

  @test:test/coordinator/fsh-guts-export-repo-root.test.ts::the_real_corpus::every_committed_node_is_in_the_document
  Scenario: Every committed node of the real trashcan is in the export
    Given the checkout
    When the fsh-guts export is built
    Then its node count is more than zero
    And its @graph has exactly that many nodes
    And it scans "fsh-guts"
    And at least one file on disk in a scanned directory (the mounted branch), outside a frozen subtree, is a markdown or JSON node
    And every such file has a node in the @graph whose sourcePath is its path

  @test:test/coordinator/fsh-guts-export-repo-root.test.ts::the_real_corpus::the_directory_is_resolved_from_the_declaration,_not_spelled
  Scenario: The trashcan directory is resolved from the declaration
    Given the checkout, and a throwaway instance that declares no trashcan
    When their fsh-guts directories are resolved
    Then the checkout's is exactly "fsh-guts" at the checkout root
    And the throwaway instance has none

  @test:test/coordinator/fsh-guts-export-repo-root.test.ts::the_folded_block_scalar_the_corpus_actually_uses::every_real_node's_summary_survived_the_parse
  Scenario: No real node's summary is left as the folded-scalar marker
    Given the fsh-guts export of the checkout
    When the nodes with a description are taken
    Then there is at least one
    And no description is ">-"
