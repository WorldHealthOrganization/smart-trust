# The fsh-guts trashcan is kept but not published: its content stays out of the declared site directory, its one
# index page is withheld from the canonical deploy (scripts/compose-docs.ts), and its nodes declare themselves.
# Each Scenario names the test that executes it.
Feature: The fsh-guts trashcan stays out of the render pipeline

  @test:scripts/tests/fsh-guts-not-rendered.test.ts::fsh-guts_stays_out_of_the_render_pipeline::the_declared_trashcan_exists
  Scenario: The declared fsh-guts trashcan exists at the repository root
    # Skipped: when the trashcan's content is not mounted (a layer standing alone)
    Given the trashcan directory fshGutsDirectory resolves for the repository root
    Then it exists
    And its path relative to the repository root is "fsh-guts"

  @test:scripts/tests/fsh-guts-not-rendered.test.ts::fsh-guts_stays_out_of_the_render_pipeline::its_CONTENT_is_not_inside_the_declared_site_directory
  Scenario: No trashcan content is inside the declared site directory
    Given the declared site directory of the harness
    When its "fsh-guts" subdirectory is listed
    Then it holds nothing but "index.md"

  @test:scripts/tests/fsh-guts-not-rendered.test.ts::fsh-guts_stays_out_of_the_render_pipeline::and_the_index_that_IS_there_is_withheld_from_the_canonical_deploy
  Scenario: The fsh-guts index page is withheld from the canonical deploy
    Given the fsh-guts page path declared for the repository root
    Then that path is withheld from the canonical deploy
    And when no page is declared the site directory has no "fsh-guts" subdirectory

  @test:scripts/tests/fsh-guts-not-rendered.test.ts::fsh-guts_stays_out_of_the_render_pipeline::its_nodes_declare_themselves
  Scenario: Every fsh-guts node declares the fsh-guts schema
    # Skipped: when the trashcan's content is not mounted (a layer standing alone)
    Given every markdown node in the trashcan, skipping frozen subtrees and directory READMEs
    Then there is at least one node
    And every node contains "$schema: folio-fsh-guts/v1"

  @test:scripts/tests/fsh-guts-not-rendered.test.ts::fsh-guts_stays_out_of_the_render_pipeline::no_node_here_is_an_orphan_—_each_says_what_put_it_here
  Scenario: Every fsh-guts node states its provenance
    # Skipped: when the trashcan's content is not mounted (a layer standing alone)
    Given every markdown node in the trashcan, skipping frozen subtrees and directory READMEs
    Then every node has a movedFrom line, or an issue or bean line

  @test:scripts/tests/fsh-guts-not-rendered.test.ts::fsh-guts_stays_out_of_the_render_pipeline::a_frozen_subtree's_note_says_what_the_copy_is,_so_skipping_its_files_hides_nothing
  Scenario: Every frozen subtree's note carries the frozen-subtree provenance fields
    # Skipped: when the trashcan's content is not mounted (a layer standing alone)
    Given every frozen subtree in the trashcan
    Then each note sets every one of FROZEN_SUBTREE_FIELDS to a non-empty value

  @test:scripts/tests/fsh-guts-not-rendered.test.ts::fsh-guts_stays_out_of_the_render_pipeline::a_node_that_says_it_moved_says_when
  Scenario: Every moved fsh-guts node says when it moved
    # Skipped: when the trashcan's content is not mounted (a layer standing alone)
    Given every markdown node in the trashcan, skipping frozen subtrees and directory READMEs
    Then every node with a movedFrom line also has a movedOn line
