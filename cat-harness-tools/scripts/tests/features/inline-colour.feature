# scripts/tests/inline-colour.test.ts sweeps every client script of every site layer (assets/js, vendor excluded) for colours or opacity written into an inline style, so every colour stays a token in the stylesheet.
# Each Scenario names the test that executes it.
Feature: No colour is written into an inline style in the client

  @test:scripts/tests/inline-colour.test.ts::no_colour_is_written_into_an_inline_style_in_the_client::the_detector_finds_the_literals_this_bean_removed
  Scenario: The detector flags the colour literals that were removed
    Given four synthetic lines carrying inline colours: two style attributes with hex colours and an opacity, a style.background write, and an rgba background
    When the inline style sites are filtered for offenders
    Then lines 1, 2, 3 and 4 are all flagged

  @test:scripts/tests/inline-colour.test.ts::no_colour_is_written_into_an_inline_style_in_the_client::geometry_is_NOT_flagged_—_a_position_is_not_a_colour
  Scenario: Inline geometry is not flagged
    Given synthetic lines writing style.left, style.zIndex and style.width
    When the inline style sites are filtered for offenders
    Then nothing is flagged

  @test:scripts/tests/inline-colour.test.ts::no_colour_is_written_into_an_inline_style_in_the_client::there_ARE_client_scripts,_so_the_sweep_is_over_something
  Scenario: There are client scripts to sweep
    Given the site layers' assets/js directories
    When their .js files are listed
    Then there is at least one client script

  @test:scripts/tests/inline-colour.test.ts::no_colour_is_written_into_an_inline_style_in_the_client::the_client_has_inline_styles_at_all,_so_the_sweep_has_a_subject
  Scenario: The client scripts contain inline styles to sweep
    Given every client script
    When their inline style sites are counted
    Then there are more than 3 in total

  @test:scripts/tests/inline-colour.test.ts::no_colour_is_written_into_an_inline_style_in_the_client::%s:_none_of_them_carries_a_colour_or_an_opacity
  Scenario: No client script's inline styles carry a colour or an opacity
    Given each client script in turn, one row per file
    When its inline style sites are filtered for offenders
    Then no line carries a hex, rgb or hsl colour, a colour property, or an opacity
