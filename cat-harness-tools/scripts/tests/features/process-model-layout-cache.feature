# The layer layout loadProcessModel resolves calls against is memoised per
# layer root, and resolved again when the layout changes (bean sff8). Each
# Scenario names the test that executes it.
Feature: The process model's layout memo is invalidated by a layout change

  @test:scripts/tests/process-model-layout-cache.test.ts::the_per-instance_layout_memo_is_invalidated_by_a_layout_change::a_declaration_rewritten_to_NEED_a_dependency_is_read_again
  Scenario: A declaration rewritten to need a dependency is read again
    Given a parent diagram calling a process held by a layer it does not yet need
    Then the call is opaque when the parent is loaded
    When the parent's layer is rewritten to need that layer
    Then loading the parent again resolves the call to the child process

  @test:scripts/tests/process-model-layout-cache.test.ts::the_per-instance_layout_memo_is_invalidated_by_a_layout_change::a_dependency's_instance_root_APPEARING_beside_the_instance_is_seen
  Scenario: A dependency's layer root appearing beside the instance is seen
    Given a parent layer that needs a layer not yet on disk
    Then the call is opaque when the parent is loaded
    When the needed layer is written beside it
    Then loading the parent again resolves the call to the child process
