# Diagrams load as they near the viewport, and printing still gets all of them.
# Each Scenario names the test that executes it, in the grammar
# @test:<file>::<scope>::<name> (skill test-engineer, "Every test has a Gherkin").
Feature: Diagrams are drawn as a reader reaches them, and all of them before printing

  @test:scripts/tests/lazy-diagrams.test.ts::diagrams_are_inlined_as_they_near_the_viewport::nothing_is_fetched_at_load,_and_the_figures_are_mounted_at_once
  Scenario: Nothing is fetched at load, and the figures are mounted at once
    Given a page with three SVG drawings and an IntersectionObserver
    When docs-ui inlines its diagrams
    Then no drawing is fetched, the figures are mounted once, and each drawing is observed and marked pending

  @test:scripts/tests/lazy-diagrams.test.ts::diagrams_are_inlined_as_they_near_the_viewport::a_drawing_is_fetched_when_it_nears_the_viewport,_once,_and_its_figure_is_mounted_then
  Scenario: A drawing is fetched when it nears the viewport, once
    When the second drawing is reported near the viewport twice
    Then only it is fetched, once, it is no longer pending, and the figures are mounted again

  @test:scripts/tests/lazy-diagrams.test.ts::diagrams_are_inlined_as_they_near_the_viewport::without_IntersectionObserver_every_drawing_is_inlined_at_load,_as_before
  Scenario: Without IntersectionObserver every drawing is inlined at load
    Given a browser with no IntersectionObserver
    Then every drawing is fetched at load

  @test:scripts/tests/lazy-diagrams.test.ts::diagrams_are_inlined_as_they_near_the_viewport::a_drawing_added_after_load_is_queued_too,_once,_and_a_drawing_already_tried_is_left_alone
  Scenario: A drawing added after load is inlined too
    Given a whole-document page that fills a block holding a drawing after load
    When mountFigures runs, twice
    Then the new drawing is marked pending and observed once, an inlined drawing is not queued again, and it is fetched when it nears the viewport

  @test:scripts/tests/lazy-diagrams.test.ts::printing_gets_every_drawing::beforeprint_turns_lazy_images_eager_and_inlines_every_drawing_still_waiting
  Scenario: beforeprint loads every drawing
    Given one of three lazy drawings already inlined
    When beforeprint fires
    Then every image is eager, every drawing has been fetched, and none is pending

  @test:scripts/tests/lazy-diagrams.test.ts::printing_gets_every_drawing::a_Print_button_can_wait:_faInlineAllDiagrams_resolves_once_all_are_in
  Scenario: A Print button can wait for every drawing
    When faInlineAllDiagrams is awaited
    Then every drawing has replaced its image

  @test:scripts/tests/lazy-diagrams.test.ts::printing_gets_every_drawing::mountFigures_leaves_a_drawing_still_waiting_for_its_inlining
  Scenario: mountFigures leaves a pending drawing for later
    Then a pending image, and a BPMN figure holding one, are skipped by mountFigures

  @test:scripts/tests/lazy-diagrams.test.ts::Mermaid_and_Graphviz_are_drawn_nearest_first,_and_all_before_printing::Mermaid:_per_diagram_through_an_IntersectionObserver,_the_rest_on_idle_and_on_beforeprint,_with_a_preconnect
  Scenario: Mermaid draws per diagram, the rest on idle and before printing
    Then the include preconnects to the CDN, observes each diagram, runs Mermaid on the nodes near the viewport, draws the rest on idle and on beforeprint, and announces each drawing to docs-ui.js

  @test:scripts/tests/lazy-diagrams.test.ts::Mermaid_and_Graphviz_are_drawn_nearest_first,_and_all_before_printing::Graphviz:_shown_graphs_mount_as_they_near_the_viewport,_the_rest_on_idle_and_on_beforeprint
  Scenario: Graphviz lays out shown graphs nearest first, the rest on idle and before printing
    Then kg-graph.js observes each shown graph, mounts the rest on idle and on beforeprint, and exposes faMountAllGraphs
