# scripts/check-node-kinds.ts holds each layer's unkinded node families to that layer's own baseline,
# and the cross-layer node-kind table is built at publish; these tests ask this checkout's corpus.
# Each Scenario names the test that executes it.
Feature: Node-kind baselines and the published node-kind table

  @test:scripts/tests/check-node-kinds.test.ts::the_table_is_built_at_publish::cat-harness_declares_docs/_data/node-kinds.json_builtAtPublish,_written_by_node-kinds,_and_ignores_it
  Scenario: cat-harness declares the node-kind table as built at publish and ignores it
    Given cat-harness's declaration on this checkout
    Then the node-kind table is reported as built at publish
    And its builtAtPublish entry is written by "node-kinds" and reads "typologies" and "validators"
    And cat-harness's .gitignore holds the ignore line for that entry

  @test:scripts/tests/check-node-kinds.test.ts::the_table_is_built_at_publish::the_node-kind_pages_that_render_it_are_declared_after_it,_so_derive:publish_writes_it_first
  Scenario: The node-kind pages are declared after the table they render
    Given cat-harness's builtAtPublish list
    Then an entry written by "node-kinds" exists
    And the first entry written by "node-kind:pages" comes after it
    And "docs/en/cat-harness/node-kind-index/" is written by "node-kind:pages"

  @test:scripts/tests/check-node-kinds.test.ts::the_table_is_built_at_publish::the_combined_build_is_a_node-kind-index_whose_unkinded_families_are_exactly_the_instances'_baselines
  Scenario: The combined build is a valid node-kind index matching the baselines
    Given the node-kind index built from this checkout's typologies
    When it is rendered and parsed
    Then it validates as a node-kind-index file
    And every unkinded family in it is held by some layer's baseline
    And every family in a non-mounted layer's baseline is still unkinded
    # Gap: families in a mounted layer's baseline may be kinded here without failing

  @test:scripts/tests/check-node-kinds.test.ts::each_instance's_baseline,_on_this_checkout::every_declared_baseline_parses,_and_every_one_names_only_its_own_instance's_families
  Scenario: Every declared baseline parses and names only its own layer's families
    When the baselines of this checkout are read
    Then none reports a parse error
    And every entry's typology is owned by the layer whose baseline lists it

  @test:scripts/tests/check-node-kinds.test.ts::each_instance's_baseline,_on_this_checkout::DAY_ONE:_the_gate_passes_exactly_as_the_shared_baseline_did_—_nothing_new,_gone,_foreign_or_unattributed
  Scenario: The gate passes on this checkout with nothing new, gone, foreign or unattributed
    Given the node-kind index built from this checkout
    When the ratchet is run against each layer's baseline
    Then no unkinded family is unattributed
    And no layer has a fresh or foreign family, nor a gone family unless the layer is mounted

  @test:scripts/tests/check-node-kinds.test.ts::each_instance's_baseline,_on_this_checkout::a_NEW_unkinded_family_fails_in_the_layer_that_declares_its_typology,_and_nowhere_else
  Scenario: A new unkinded family fails only in the layer owning its typology
    Given the real index plus an unkinded family "a-family-nobody-baselined/v1" under a typology owned by a layer other than cat-harness
    When the ratchet is run against each layer's baseline
    Then the only layer with fresh families is that typology's owner, listing just the added family

  @test:scripts/tests/check-node-kinds.test.ts::a_mounted_layer's_baseline_is_its_own_repository's::readBaselines_marks_an_instance_a_lock_laid_down_as_mounted,_and_the_checkout's_own_as_not
  Scenario: A layer laid down by the lock is marked mounted
    Given a checkout with layers "lower" and "own", and an index lock listing "lower/"
    When the baselines are read
    Then "lower" is mounted
    And "own" is not
