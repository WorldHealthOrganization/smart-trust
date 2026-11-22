# scripts/gen-docs-pages.ts: the BPMN figure image is lazy, and keeps what docs-ui.js needs
# to inline it and to print it. Each Scenario names the test that executes it.
Feature: The BPMN figure image loads when a reader nears it

  @test:scripts/tests/ui/bpmn-figure-lazy.test.ts::the_BPMN_figure_image::is_loaded_lazily_and_decoded_off_the_main_thread
  Scenario: The image is lazy and decoded asynchronously
    Given a figure for p1 with a Liquid-addressed SVG
    Then its div has id figure-p1 and its img carries loading="lazy" and decoding="async"

  @test:scripts/tests/ui/bpmn-figure-lazy.test.ts::the_BPMN_figure_image::keeps_its_alt_text,_quotes_escaped
  Scenario: The alt text is kept with quotes escaped
    Given alt text holding double quotes
    Then the alt attribute carries them as &quot;

  @test:scripts/tests/ui/bpmn-figure-lazy.test.ts::the_BPMN_figure_image::keeps_the_src_docs-ui.js_selects_to_inline_it,_so_printing_inlines_it_too
  Scenario: The src still ends in .svg, so docs-ui.js inlines it and prints it
    Then the img line carries a src ending in .svg
