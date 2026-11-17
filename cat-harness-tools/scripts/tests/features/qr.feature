# The vendored QR encoder (docs/assets/js/vendor/qrcode.js) cross-checked by a
# decoder written here, independently, from the structure of the standard:
# error-correction level M, versions 1-10, byte mode. Each Scenario names the
# test that executes it.
Feature: The docs QR code decodes to the page URL

  @test:scripts/tests/qr.test.ts::level-M_block_geometry_is_internally_consistent
  Scenario: Level-M block geometry is internally consistent
    Then for versions 1 to 10 the data codewords are positive
    And the short/long block split sums to the data codewords
    And data plus error-correction codewords fill the symbol

  @test:scripts/tests/qr.test.ts::derived_byte_capacities_match_the_published_1-M_…_10-M_values
  Scenario: Derived byte capacities match the published values
    Then the byte capacities of versions 1-M to 10-M are 14, 26, 42, 62, 84, 106, 122, 152, 180 and 213

  @test:scripts/tests/qr.test.ts::function_patterns_land_where_the_standard_puts_them
  Scenario: Function patterns land where the standard puts them
    When "https://example.org/a" is encoded
    Then each finder pattern has a dark outer ring, a light ring inside it and a dark core
    And the timing row alternates dark and light
    And the always-dark module is dark

  @test:scripts/tests/qr.test.ts::an_independent_decoder_recovers_the_encoded_string
  Scenario: An independent decoder recovers the encoded string
    Given URLs, "a", a string with non-ASCII characters, and 150 "x"s
    When each is encoded and decoded
    Then the mode is byte, the level is M, and the text is the input

  @test:scripts/tests/qr.test.ts::the_URL_of_every_real_docs_page_round-trips
  Scenario: The URL of each listed docs page round-trips
    # Gap: the pages are a hand-written list of 14 paths, not read from the site, so a real page outside it is not checked.
    Given 14 docs page URLs under the published base
    When each is encoded and decoded
    Then the text is the URL

  @test:scripts/tests/qr.test.ts::createSvgTag_emits_a_well-formed_tag_and_the_URL_never_reaches_the_markup
  Scenario: The SVG tag is well formed and carries no part of the URL
    When a URL containing "<b>" is encoded and rendered as an SVG tag
    Then it starts "<svg" and ends "</svg>"
    And it contains neither "<b>" nor "litlfred"
