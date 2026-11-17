# A workflow instance page's drawings load lazily on screen and completely in
# print (owner, 2026-11-14: "do lazy load content and libs"; "make sure printing
# loads all of the content before it renders the PDF on the browser").
# Each Scenario names the test that executes it.
Feature: Workflow page drawings, lazy on screen and complete in print

  @test:scripts/tests/state-visualizer-lazy.test.ts::lazy_on_screen::no_drawing_is_fetched_at_load;_each_is_fetched_once_as_it_nears_the_viewport
  Scenario: Drawings are fetched as they near the viewport
    Given a workflow page with three drawings and an IntersectionObserver
    When the page loads
    Then no drawing is fetched and every figure is observed
    When the second figure nears the viewport twice
    Then only its drawing is fetched, once, and inlined, and it is no longer observed

  @test:scripts/tests/state-visualizer-lazy.test.ts::lazy_on_screen::a_drawing_inside_a_closed_<details>_is_fetched_when_it_is_opened
  Scenario: A drawing in a closed disclosure is fetched when it is opened
    Given a drawing inside a closed details element
    When the details element is opened
    Then that drawing is fetched and inlined, and no other

  @test:scripts/tests/state-visualizer-lazy.test.ts::lazy_on_screen::with_no_IntersectionObserver_every_drawing_is_fetched_at_load
  Scenario: Without an observer every drawing is fetched at load
    Given a browser with no IntersectionObserver
    When the page loads
    Then every drawing is fetched and inlined

  @test:scripts/tests/state-visualizer-lazy.test.ts::complete_in_print::beforeprint_opens_what_holds_a_drawing_and_fetches_every_one;_afterprint_closes_it_again
  Scenario: Printing fetches every drawing and opens what holds one
    Given one drawing already on screen
    When the browser fires beforeprint
    Then the closed details element is opened and every drawing is fetched and inlined
    When the browser fires afterprint
    Then the details element is closed again

  @test:scripts/tests/state-visualizer-lazy.test.ts::complete_in_print::Ctrl+P_and_a_Print_button's_wvPrintPrep_wait_for_every_drawing_before_printing
  Scenario: A keyboard print or a Print button waits for every drawing
    When Ctrl+P is pressed
    Then the browser's own print is held back until every drawing is inlined, and then the page prints once
    And the promise wvPrintPrep returns resolves only once every drawing is inlined
