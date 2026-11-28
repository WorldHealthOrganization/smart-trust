# The id-unique and id-stable QA criteria: one label per block across the
# folio, and no undeclared relabel against a base ref (QA_ID_BASE_REF). Each
# Scenario names the test that executes it.
Feature: Block ids are unique and stable

  @test:scripts/tests/qa-checkers-ids.test.ts::id-unique::distinct_labels_pass
  Scenario: Distinct labels pass id-unique
    Given a folio with blocks labelled "def:a" and "def:b"
    When id-unique checks block "a"
    Then the result is "pass"

  @test:scripts/tests/qa-checkers-ids.test.ts::id-unique::two_blocks_declaring_one_label_FAIL,_from_both_sides
  Scenario: Two blocks declaring one label fail from both sides
    Given a folio with blocks "a" and "b" both labelled "def:shared"
    When id-unique checks each
    Then both fail, each hit naming the other block's file

  @test:scripts/tests/qa-checkers-ids.test.ts::id-unique::taking_a_label_another_block_retired_in_renamedFrom_FAILS
  Scenario: Taking a label another block retired fails
    Given a block labelled "def:new" with renamedFrom "def:old", and a block labelled "def:old"
    When id-unique checks the block labelled "def:old"
    Then it fails with a hit mentioning "retired id"
    And the renamed block passes

  @test:scripts/tests/qa-checkers-ids.test.ts::id-unique::no_folio_to_index_is_n/a,_never_a_pass
  Scenario: No folio to index is n/a
    Given the id index pointed at a folio that does not exist
    When id-unique checks a block
    Then the result is "n/a"

  @test:scripts/tests/qa-checkers-ids.test.ts::id-stable::an_unchanged_block_passes
  Scenario: An unchanged block is stable
    Given a folio committed with block "a" labelled "def:a", the commit as base ref
    When id-stable checks it
    Then it passes with notes saying "unchanged"

  @test:scripts/tests/qa-checkers-ids.test.ts::id-stable::a_relabel_WITHOUT_renamedFrom_fails;_the_same_relabel_WITH_it_passes
  Scenario: A relabel fails without renamedFrom and passes with it
    Given a committed block "a" labelled "def:a"
    When it is relabelled "def:a-renamed" without renamedFrom
    Then id-stable fails with a hit suggesting 'renamedFrom: ["def:a"]'
    When it is relabelled with renamedFrom "def:a"
    Then id-stable passes with notes saying "renamed from"

  @test:scripts/tests/qa-checkers-ids.test.ts::id-stable::a_moved_AND_relabelled_block_is_still_compared_with_its_old_self
  Scenario: A moved and relabelled block is compared with its old self
    Given a committed block "a" labelled "def:a"
    When it is moved to "moved.ts", relabelled "def:b" and staged
    Then id-stable fails with a hit naming "def:a"

  @test:scripts/tests/qa-checkers-ids.test.ts::id-stable::a_new_block_is_an_addition_—_including_one_not_yet_git-added
  Scenario: A new block is an addition, even unstaged
    Given a committed folio and a new untracked block "fresh"
    When id-stable checks it
    Then it passes with notes saying "new since"

  @test:scripts/tests/qa-checkers-ids.test.ts::id-stable::an_unreachable_base_ref_is_n/a,_never_stable
  Scenario: An unreachable base ref is n/a
    Given a committed block and QA_ID_BASE_REF set to "no-such-ref"
    When id-stable checks it
    Then the result is "n/a" with notes saying "not reachable"

  @test:scripts/tests/qa-checkers-ids.test.ts::registration::both_criteria_are_registered,_automated,_and_discoverable_by_name
  Scenario: Both id criteria are registered, automated and discoverable
    Then "id-unique" and "id-stable" are automated, sourced from "pipeline/qa-checkers-ids.ts", and the module exports each checker function
    And "id-unique" is critical by default
