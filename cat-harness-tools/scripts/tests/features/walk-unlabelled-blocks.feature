# walkBlocks answers "what is in the graph?" and, with includeUnlabelled,
# "what prose ships?" (qou/3fui). Each Scenario names the test that executes it.
Feature: Walking unlabelled prose blocks

  Background:
    Given a chapter with a labelled proposition "prop:a", an unlabelled prose block "outro" with its .md, and a script holding a builder call inside a template literal

  @test:scripts/tests/walk-unlabelled-blocks.test.ts::walkBlocks:_unlabelled_prose::by_default_an_unlabelled_prose_block_is_not_yielded
  Scenario: By default only labelled blocks are walked
    Then walking the chapter yields only "prop:a"

  @test:scripts/tests/walk-unlabelled-blocks.test.ts::walkBlocks:_unlabelled_prose::with_includeUnlabelled_it_is_yielded_under_its_slug
  Scenario: includeUnlabelled yields the prose block under its slug
    Then walking with includeUnlabelled yields "outro" and "prop:a"

  @test:scripts/tests/walk-unlabelled-blocks.test.ts::walkBlocks:_unlabelled_prose::the_unlabelled_block_still_carries_its_.md,_so_criteria_can_read_it
  Scenario: The unlabelled block carries its .md
    Then the walked "outro" block's md path ends "outro.md" and its kind is "prose"

  @test:scripts/tests/walk-unlabelled-blocks.test.ts::walkBlocks:_unlabelled_prose::the_looser_path_does_NOT_readmit_a_builder_inside_a_string_literal
  Scenario: A builder in a string literal is not a block
    # Gap: the default-mode half looks for the slug "audit-script", which the default mode (keyed by label) could not yield even if it readmitted the script; only the includeUnlabelled half can fail.
    Then neither walk yields "audit-script"

  @test:scripts/tests/walk-unlabelled-blocks.test.ts::walkBlocks:_unlabelled_prose::readUnlabelledBlockManifest_declines_a_block_that_HAS_a_label
  Scenario: The unlabelled reader declines a labelled block
    Then reading "labelled.ts" as an unlabelled manifest gives nothing

  @test:scripts/tests/walk-unlabelled-blocks.test.ts::walkBlocks:_unlabelled_prose::readUnlabelledBlockManifest_declines_a_non-manifest
  Scenario: The unlabelled reader declines a non-manifest
    Then reading the script and a missing file as unlabelled manifests gives nothing
