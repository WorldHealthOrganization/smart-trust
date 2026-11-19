# Specifies owningDirectory and resolveDirectories (schemas/kg/cat-harness.ts)
# and scanSubgraphs (scripts/check-subgraphs.ts) over the real checkout.
Feature: Subgraph containment and attribution are derived from declared paths

  @test:test/coordinator/subgraphs-checkout.test.ts::subgraph_containment_is_derived_from_declared_paths::a_repository-scoped_directory_is_not_a_child_of_an_instance-relative_one
  Scenario: smart-base's repository-scoped methodologies is not a child of cat-harness's
    Given the checkout's directories stacked on cat-harness, and cat-harness's own methodologies directory
    When the owner of a file in smart-base/methodologies is found among the two
    Then smart-base's methodologies resolves
    And the owner is smart-base's methodologies directory

  @test:test/coordinator/subgraphs-checkout.test.ts::the_entanglement_report::the_dangling_category_exists_and_is_computed,_not_skipped
  Scenario: The dangling-link category is computed, and the real corpus is clean
    Given the subgraph scan of the checkout
    When its dangling links are read
    Then they are a list
    Given a throwaway instance declaring a "code" directory "notes/" holding "n.md" with a link "./no-such-file.md" to nothing
    When the subgraph scan sweeps that instance
    Then its dangling links are exactly "notes/n.md → ./no-such-file.md"
    And the real scan's dangling list is empty

  @test:test/coordinator/subgraphs-checkout.test.ts::repository-scoped_directories_are_attributed::fsh-guts_is_exempt_because_it_DECLARES_an_unpublished_kind
  Scenario: fsh-guts is exempt, and few directories are
    Given the subgraph scan of the checkout
    When its exempt directories are read
    Then one is labelled fsh-guts
    And there are fewer than 3

  @test:test/coordinator/subgraphs-checkout.test.ts::repository-scoped_directories_are_attributed::the_x4v4_separation_survives_the_change
  Scenario: smart-base's methodologies is no directory's child
    Given the subgraph scan of the checkout
    When its containment tree is read
    Then no entry has "smart-base-methodologies" as a child
    And smart-base's methodologies resolves through the checkout
    And the tree is a computed list
