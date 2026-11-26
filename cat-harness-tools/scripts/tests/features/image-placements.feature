# schemas/content/document-image.ts DocumentImageSchema: one entry per distinct image, with an
# optional placements array whose first entry is the placement basis describes.
# Each Scenario names the test that executes it.
Feature: Document image placements

  @test:scripts/tests/image-placements.test.ts::placements_—_the_array_is_optional_and_its_first_entry_is_`basis`::a_singly-placed_image_needs_none
  Scenario: A singly-placed image needs no placements
    Given a figure image whose geometry basis is on page 1
    And no placements array
    When it is validated against the document image schema
    Then it is accepted

  @test:scripts/tests/image-placements.test.ts::placements_—_the_array_is_optional_and_its_first_entry_is_`basis`::placements[0]_must_be_the_placement_`basis`_describes
  Scenario: A first placement on a different page from the basis is refused
    Given a figure image whose geometry basis is on page 3
    And a single placement on page 7
    When it is validated against the document image schema
    Then it is refused

  @test:scripts/tests/image-placements.test.ts::placements_—_the_array_is_optional_and_its_first_entry_is_`basis`::the_same_image_on_several_pages_is_accepted,_first_placement_leading
  Scenario: The same image placed on several pages is accepted with the first placement leading
    Given a figure image whose geometry basis is on page 28 with a drafted narrative
    And placements on page 28 and on page 42 with a note
    When it is validated against the document image schema
    Then it is accepted

  @test:scripts/tests/image-placements.test.ts::placements_—_the_array_is_optional_and_its_first_entry_is_`basis`::an_empty_placements_array_is_refused_—_absent_means_singly_placed
  Scenario: An empty placements array is refused
    Given a figure image with a basis on page 1 and an empty placements array
    When it is validated against the document image schema
    Then it is refused

  @test:scripts/tests/image-placements.test.ts::placements_—_the_array_is_optional_and_its_first_entry_is_`basis`::a_note_may_not_be_empty_—_an_unsaid_thing_is_an_absent_field
  Scenario: An empty placement note is refused
    Given a figure image with one placement on page 1 whose note is the empty string
    When it is validated against the document image schema
    Then it is refused
