# Specifies viewersOf (scripts/viewer-declarations.ts) for the folio
# directory declared in cat-harness.json.
Feature: The folio directory's declared viewer is a page that exists

  @test:test/coordinator/folio-viz-checkout.test.ts::the_generated_artefacts_are_the_ones_declared::the_folio_directory's_viewer_—_read_from_the_harness_declaration_—_is_the_page_that_exists
  Scenario: The folio directory's viewer resolves to an existing file
    Given the "folio" directory in cat-harness.json
    When its first viewer's ref is read
    Then the directory and its viewer are defined
    And the viewer's ref names a file that exists in the checkout
