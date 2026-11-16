# A checkout that mounts the harness keeps the mount as pinned: uml:overview
# lists its roots through the layer output overlay and renders a stale SVG at
# the output root (cat-tools-sm8r, item 4). Each Scenario names the test that executes it.
Feature: uml:overview writes a mounted harness's output root

  @test:scripts/tests/uml-overview-output-root.test.ts::uml:overview_through_the_layer_output_root::walkOverlay_names_the_pinned_and_the_computed_files_at_their_pinned_paths,_once_each
  Scenario: walkOverlay lists the pinned and the computed files at their pinned paths
    Given a mounted layer with pinned and computed files under one directory
    When the directory is walked through the overlay
    Then each file is named once, at its pinned path

  @test:scripts/tests/uml-overview-output-root.test.ts::uml:overview_through_the_layer_output_root::a_stale_SVG_of_a_mounted_layer_is_rendered_at_the_output_root;_a_current_pinned_one_is_not_rendered
  Scenario: A stale SVG of a mounted layer is rendered at the output root
    Given a mounted layer with one current and one missing SVG
    When the jobs to render are chosen
    Then only the missing one is rendered, at the output root

  @test:scripts/tests/uml-overview-output-root.test.ts::uml:overview_through_the_layer_output_root::an_SVG_already_rendered_at_the_output_root_is_read_there,_so_it_is_not_rendered_again
  Scenario: An SVG already at the output root is not rendered again
    Given a mounted layer whose output root holds a current SVG over a stale pinned one
    When the jobs to render are chosen
    Then none is rendered

  @test:scripts/tests/uml-overview-output-root.test.ts::uml:overview_through_the_layer_output_root::a_local_layer's_stale_SVG_is_rendered_in_place,_as_before
  Scenario: A local layer's stale SVG is rendered in place
    Given a checkout with no lock
    When a stale SVG's job is chosen
    Then it is rendered at its own path
