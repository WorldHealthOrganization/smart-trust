# Specifies processRows, pageRelPath and publishedIndex
# (scripts/gen-processes-viz.ts) over every instance's diagrams in the
# checkout.
Feature: The committed processes page is current

  @test:test/coordinator/processes-viz-checkout.test.ts::the_committed_page_is_current::and_matches_what_the_generator_produces_now
  Scenario: The processes page matches what the generator produces now
    Given the processes page under the base docs layer (the test is skipped where the site is not built)
    When it is read and the index is regenerated from the checkout's process rows
    Then the page equals the regenerated index
