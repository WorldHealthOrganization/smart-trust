# The site build mounts a layer's directories from a subscription's
# materialised tree (bean g8jp). Each Scenario names the test that executes it.
Feature: Subscribed trees

  Background:
    Given a repository with one subscriber layer "host" subscribed to substrate "iris-like" at a pinned sha, fetched without network

  @test:scripts/tests/subscribed-trees.test.ts::subscribedTrees:_three_states,_never_two::a_materialised,_verified_subgraph_is_held,_at_its_tree
  Scenario: A materialised, verified subgraph is held
    Given subgraph "iris-site" is chosen and materialised with a matching digest at the pin
    When the subscribed trees are read
    Then "iris-site" of "iris-like" is "held" at its materialised tree directory
    And its declared entry keeps "instanceRoot"

  @test:scripts/tests/subscribed-trees.test.ts::subscribedTrees:_three_states,_never_two::chosen_but_never_materialised_is_could-not-determine,_naming_the_command
  Scenario: A chosen but unmaterialised subgraph cannot be determined
    Given subgraph "iris-site" is chosen but not materialised
    When the subscribed trees are read
    Then its state is "could-not-determine" and the reason names "kg:materialize iris-like iris-site"

  @test:scripts/tests/subscribed-trees.test.ts::subscribedTrees:_three_states,_never_two::bytes_edited_in_place,_or_held_at_another_pin,_are_could-not-determine
  Scenario: Edited bytes or another pin cannot be determined
    Given a materialised subgraph whose file was edited after its digest was taken
    Then its reason says "fixity mismatch"
    Given a materialised subgraph recorded at another sha
    Then its reason says "re-materialise"

  @test:scripts/tests/subscribed-trees.test.ts::subscribedTrees:_three_states,_never_two::a_part_its_gates_refused_is_referenced_—_a_determined_absence,_not_a_problem
  Scenario: A part its gates refused is referenced
    Given a subgraph recorded as "referenced" with a refused copyright gate
    When the subscribed trees are read
    Then its state is "referenced" and the reason says "refused: copyright"

  @test:scripts/tests/subscribed-trees.test.ts::subscribedTrees:_three_states,_never_two::a_chosen_subgraph_the_substrate_does_not_declare_is_could-not-determine
  Scenario: A chosen subgraph the substrate does not declare cannot be determined
    Given the subscription chooses subgraph "nope"
    When the subscribed trees are read
    Then "nope" is "could-not-determine"

  @test:scripts/tests/subscribed-trees.test.ts::mount-instance-docs_reads_a_subscribed_instance_like_an_in-tree_one::held_directories_mount_at_the_substrate's_own_routes,_the_declared_root_at_/<instance>/
  Scenario: Held directories mount at the substrate's routes
    Given "iris-site" and "iris-docs" are materialised
    When the subscribed mount entries are read
    Then there are no problems and nothing shadowed, and two entries named "iris-like"
    And the site entry resolves to the held tree itself
    And the routes are "iris-like" for the root and "docs/iris-like" for the docs sibling

  @test:scripts/tests/subscribed-trees.test.ts::mount-instance-docs_reads_a_subscribed_instance_like_an_in-tree_one::a_page_embedding_from_another_held_directory_resolves_through_the_instance's_layout
  Scenario: An embed from another held directory resolves
    Given a held site page whose image is "../library/cover.png" and a held library holding "cover.png"
    When the site's referenced assets are read
    Then there are no problems and the one asset is "library/cover.png"

  @test:scripts/tests/subscribed-trees.test.ts::mount-instance-docs_reads_a_subscribed_instance_like_an_in-tree_one::a_chosen_subgraph_not_held_is_reported,_never_an_empty_pass
  Scenario: A chosen subgraph not held is a problem
    Given "iris-site" is chosen but not materialised
    When the subscribed mount entries are read
    Then there are no entries and one problem naming "host → iris-like/iris-site"

  @test:scripts/tests/subscribed-trees.test.ts::mount-instance-docs_reads_a_subscribed_instance_like_an_in-tree_one::an_instance_both_staged_and_subscribed_publishes_the_staged_copy,_and_says_so
  Scenario: A staged instance shadows its subscription
    Given "iris-site" is held and an "iris-like" instance is also staged in the tree
    When the subscribed mount entries are read
    Then there are no entries and the shadowed note says "also staged in this tree"

  @test:scripts/tests/subscribed-trees.test.ts::compose-docs_composes_a_subscribed_instance's_composed_directories::a_held_directory_the_substrate_declares_`composed`_is_composed_under_the_substrate's_name
  Scenario: A held composed directory is composed under the substrate's name
    Given "iris-notes", declared composed, and "iris-docs", not composed, are materialised
    When the composed instances are read
    Then only "iris-notes" is composed, as "iris-like" under "iris-like" rooted at its held tree

  @test:scripts/tests/subscribed-trees.test.ts::compose-docs_composes_a_subscribed_instance's_composed_directories::an_instance_also_staged_in_the_tree_is_composed_from_the_staged_copy_alone
  Scenario: A staged instance is not composed from its subscription
    Given "iris-notes" is held and "iris-like" is also staged in the tree with no directories
    When the composed instances are read
    Then there are none

  @test:scripts/tests/subscribed-trees.test.ts::the_navbar_tile_of_a_subscribed_harness_(GAP_2)::a_held_themed_root_makes_the_tile_a_link_to_/<instance>/,_and_its_own_avatar_is_read_at_the_pin
  Scenario: A held themed root makes the navbar tile a link
    Given "iris-site" and "iris-docs" are held and the harness is instantiated
    When its navbar tile is built
    Then it is instantiated and links to "/iris-like/" as a folio
    And it uses the substrate's own avatar tone 199, not a generic one, with no findings
    And both subgraphs are remote and materialised, and the docs visualisation says "held here"

  @test:scripts/tests/subscribed-trees.test.ts::the_navbar_tile_of_a_subscribed_harness_(GAP_2)::chosen_but_not_held:_no_link,_and_a_finding_—_never_an_empty_tile_that_looks_fine
  Scenario: A chosen but unheld root gives no link and a finding
    Given "iris-site" is chosen but nothing is held
    When its navbar tile is built
    Then it has no link, a finding says "could not be determined", and no remote subgraph is materialised
