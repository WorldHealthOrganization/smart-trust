# pipeline/svg-label-po.ts reads each label of an inline SVG drawing (its tspan
# lines joined) as one msgid and re-wraps a translation into centred lines.
# Each Scenario names the test that executes it.
Feature: gettext over an inline drawing's labels

  @test:pipeline/svg-label-po.test.ts::extractSvgLabels::joins_a_label's_lines_into_one_msgid_and_reads_<title>s
  Scenario: extractSvgLabels: Joins a label's lines into one msgid and reads <title>s
    Given the fixture in svg-label-po.test.ts
    When extractSvgLabels runs on it
    Then it joins a label's lines into one msgid and reads <title>s

  @test:pipeline/svg-label-po.test.ts::injectSvgLabels::re-wraps_a_translation_into_centred_lines_around_the_English_block's_middle
  Scenario: injectSvgLabels: Re-wraps a translation into centred lines around the English block's middle
    Given the fixture in svg-label-po.test.ts
    When injectSvgLabels runs on it
    Then it re-wraps a translation into centred lines around the English block's middle

  @test:pipeline/svg-label-po.test.ts::injectSvgLabels::keeps_a_middle-anchored_label_centred_on_its_x,_reading_a_font-size_attribute
  Scenario: injectSvgLabels: Keeps a middle-anchored label centred on its x, reading a font-size attribute
    Given the fixture in svg-label-po.test.ts
    When injectSvgLabels runs on it
    Then it keeps a middle-anchored label centred on its x, reading a font-size attribute

  @test:pipeline/svg-label-po.test.ts::injectSvgLabels::keeps_a_left-aligned_block_left-aligned
  Scenario: injectSvgLabels: Keeps a left-aligned block left-aligned
    Given the fixture in svg-label-po.test.ts
    When injectSvgLabels runs on it
    Then it keeps a left-aligned block left-aligned

  @test:pipeline/svg-label-po.test.ts::injectSvgLabels::grows_a_label_down_or_up_from_its_line,_within_the_width_it_declares
  Scenario: injectSvgLabels: Grows a label down or up from its line, within the width it declares
    Given the fixture in svg-label-po.test.ts
    When injectSvgLabels runs on it
    Then it grows a label down or up from its line, within the width it declares

  @test:pipeline/svg-label-po.test.ts::injectSvgLabels::shrinks_a_name_that_asks_to_fit_rather_than_take_more_lines,_keeping_its_left_edge
  Scenario: injectSvgLabels: Shrinks a name that asks to fit rather than take more lines, keeping its left edge
    Given the fixture in svg-label-po.test.ts
    When injectSvgLabels runs on it
    Then it shrinks a name that asks to fit rather than take more lines, keeping its left edge

  @test:pipeline/svg-label-po.test.ts::injectSvgLabels::leaves_a_drawing_untouched_when_nothing_is_translated
  Scenario: injectSvgLabels: Leaves a drawing untouched when nothing is translated
    Given the fixture in svg-label-po.test.ts
    When injectSvgLabels runs on it
    Then it leaves a drawing untouched when nothing is translated

  @test:pipeline/svg-label-po.test.ts::injectSvgLabels::replaces_a_<title>_and_escapes_it
  Scenario: injectSvgLabels: Replaces a <title> and escapes it
    Given the fixture in svg-label-po.test.ts
    When injectSvgLabels runs on it
    Then it replaces a <title> and escapes it
    And a drawing's own <title id> is read and keeps its id

  @test:pipeline/svg-label-po.test.ts::wrap::breaks_a_CJK_run_between_characters
  Scenario: wrap: Breaks a CJK run between characters
    Given the fixture in svg-label-po.test.ts
    When wrap runs on it
    Then it breaks a CJK run between characters
