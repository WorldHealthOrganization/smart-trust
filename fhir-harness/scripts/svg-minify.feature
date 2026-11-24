Feature: An IG's SVG images are published without their editor's records

  @test:scripts/svg-minify.test.ts::minifySvg::editorRecordsDropped
  Scenario: Visio's and Inkscape's own elements, attributes, namespaces and comments go
    Given a drawing saved by Visio and Inkscape
    When it is minified
    Then no editor element, attribute, namespace declaration or generator comment is left

  @test:scripts/svg-minify.test.ts::minifySvg::drawingKeptByteForByte
  Scenario: what a renderer reads is copied through
    Given a drawing saved by Visio and Inkscape
    When it is minified
    Then the root keeps its size, view box and the namespaces still used
    And a shape keeps every attribute value, with the whitespace between attributes collapsed
    And the characters inside text, tspan, style and title are unchanged
    And a licence or copyright comment is kept

  @test:scripts/svg-minify.test.ts::minifySvg::idempotent
  Scenario: a second run changes nothing
    Then minifying the minified drawing returns it unchanged
    And the minified drawing is under half the size of the saved one

  @test:scripts/svg-minify.test.ts::minifySvg::unreadableLeftAlone
  Scenario: anything not read with certainty is returned unchanged
    Then a drawing with a DOCTYPE, an unterminated comment, an unclosed element, an attribute with no value, or a prefix bound twice is returned as given

  @test:scripts/svg-minify.test.ts::minifySvg::prefixMatchedByNamespace
  Scenario: an editor is recognised by its namespace, not its prefix
    Then a "v:" prefix bound to another namespace is kept
    And Inkscape's namespace under another prefix is dropped

  @test:scripts/svg-minify.test.ts::minifySvgBytes::notUtf8LeftAlone
  Scenario: bytes that are not UTF-8 are published as they are
    Then a file with a Latin-1 byte is returned unchanged
    And a file whose XML declaration names another encoding is returned unchanged
    And a UTF-8 file is minified
