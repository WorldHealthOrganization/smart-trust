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

  @test:pipeline/svg-label-po.test.ts::wrap::breaks_a_CJK_run_between_characters
  Scenario: wrap: Breaks a CJK run between characters
    Given the fixture in svg-label-po.test.ts
    When wrap runs on it
    Then it breaks a CJK run between characters
