# Slide decks, PPTX and ODP: two-slide fixtures shaped like real exports,
# judged for accessibility and written as an L1 entry. Each Scenario names the
# test that executes it.
Feature: Slide deck structure and accessibility

  Background:
    Given a two-slide deck where slide 1 has a title placeholder and slide 2 only a loose text box
    And pictures with one real alt text, one editor auto-caption and one with none, and speaker notes on slide 2
    And an ODP copy of the same deck without alt text

  @test:scripts/tests/slides-structure.test.ts::routing::both_formats_route_to_the_slides_rung_by_their_declared_package_type
  Scenario: Both formats route to the slides rung
    When the ingest plan is made for the PPTX and the ODP
    Then each plan's rung is "slides" and its first step runs slides-structure.py

  @test:scripts/tests/slides-structure.test.ts::accessibility_report::PPTX:_title_placeholder_only,_alt_verdicts,_per-run_language
  Scenario: PPTX accessibility report
    When the PPTX's accessibility is reported
    Then slide titles pass 1 and fail 1, failing slide 2
    And of 3 pictures 1 has alt text, 1 is missing it and 1 is auto-generated
    And the language is en-GB, set per run, and passes
    And the document title fails and slide 2 has speaker notes
    And reading order, images of text and contrast are "undetermined"

  @test:scripts/tests/slides-structure.test.ts::accessibility_report::ODP_export_without_alt_text,_language_only_on_the_default_style
  Scenario: ODP accessibility report
    When the ODP's accessibility is reported
    Then slide titles pass 1, failing slide 2
    And all 3 pictures are missing alt text
    And the language is set only on the default style and passes
    And slide 2 has speaker notes

  @test:scripts/tests/slides-structure.test.ts::L1_entry::writes_pdf-structure/v1_at_slide_granularity,_and_schema-valid_images
  Scenario: The L1 entry is written at slide granularity
    When slides-structure.py writes the PPTX's entry
    Then it exits 0 and structure.json validates with slide granularity from a zip package
    And the sections are "The layers" and "Slide 2"
    And slide 2's section says "title_source: none", has speaker notes and omits the slide number
    And images.json validates with 2 images, the first placed on slides 1 and 2, every one a figure

  @test:scripts/tests/slides-structure.test.ts::verdict_attribution::a_document's_own_attribution_wins_over_the_file's
  Scenario: A document's own attribution wins
    Given a verdict file attributed to an agent with a per-document attribution for "deck"
    Then "deck" is attributed at the document's date
    And another document at the file's date
