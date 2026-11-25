Feature: Ingesting an IG template's CSS chrome, layer by layer

  @test:scripts/tests/ingest-ig-chrome.test.ts::rootTokens::readsEveryRootBlock
  Scenario: reads every :root block, so a layer that splits its palette in two is not half-read
    Given CSS with two :root blocks around another rule
    Then the root tokens are "--a" and "--b"

  @test:scripts/tests/ingest-ig-chrome.test.ts::rootTokens::commentSemicolonNoEnd
  Scenario: a `;` inside a comment does not end a declaration
    Given a :root block with a comment holding a semicolon
    Then the tokens are "--a" with "1" and "--b" with "2"

  @test:scripts/tests/ingest-ig-chrome.test.ts::ruleFor::absentSelectorUndefined
  Scenario: an ABSENT selector returns undefined — the fact that makes the yellow box HL7's
    Given CSS that styles "#ig-status" only
    Then the rule for "#publish-box" is undefined

  @test:scripts/tests/ingest-ig-chrome.test.ts::ruleFor::noSuffixSelectorMatch
  Scenario: does not match a selector that merely ENDS with the one asked for
    Given CSS that styles "#not-ig-status"
    Then the rule for "#ig-status" is undefined

  @test:scripts/tests/ingest-ig-chrome.test.ts::ruleFor::readsCompoundSelector
  Scenario: reads a compound selector with a class
    Given CSS with a rule for an id with a class
    Then that rule's declaration is read

  @test:scripts/tests/ingest-ig-chrome.test.ts::overlay::lastLayerWinsShadowRecorded
  Scenario: the LAST layer wins, and the shadowed value is recorded
    Given a base layer and a top layer both setting "--navbar-bg-color"
    When they are overlaid
    Then the token takes the top layer's value, from the top layer, with the base layer's value recorded as overridden

  @test:scripts/tests/ingest-ig-chrome.test.ts::overlay::oneLayerEmptyOverrides
  Scenario: `overrides: []` means ONE layer decided it — the yellow-box case
    Given a base layer setting "--publish-box-bg-color" and a top layer that does not
    When they are overlaid
    Then the token comes from the base layer with no overrides

  @test:scripts/tests/ingest-ig-chrome.test.ts::overlay::identicalValueNotOverride
  Scenario: a lower layer declaring the IDENTICAL value is not an override
    Given two layers setting "--x" to the same value
    Then the token has no overrides

  @test:scripts/tests/ingest-ig-chrome.test.ts::overlay::lastDeclarationInLayerWins
  Scenario: within one layer the LAST declaration wins, as CSS says
    Given one layer setting "--x" twice
    Then the value is the second and there are no overrides

  @test:scripts/tests/ingest-ig-chrome.test.ts::overlay::detectsShapeConflict
  Scenario: a SHAPE conflict is detected — the --toc-box-border case, measured
    Given a base layer setting "--toc-box-border" to "1px solid navy" and a top layer setting it to "navy"
    When they are overlaid
    Then one shape conflict is recorded with both values

  @test:scripts/tests/ingest-ig-chrome.test.ts::overlay::agreeingLayersNoConflict
  Scenario: agreeing layers raise NO conflict — the detector must not fire on every token
    Given layers whose shared token values agree in shape
    Then no conflict is recorded

  @test:scripts/tests/ingest-ig-chrome.test.ts::overlay::malformedRecordedOnLayer
  Scenario: a MALFORMED value is recorded against the ONE layer that ships it
    Given one layer setting a colour with a doubled hash
    Then one malformed conflict is recorded against that layer and value

  @test:scripts/tests/ingest-ig-chrome.test.ts::overlay::malformedStillMirrored
  Scenario: the malformed value is still MIRRORED — a mirror that corrects its subject is not a mirror
    Given one layer setting a colour with a doubled hash
    Then the token's value is the doubled-hash value as written

  @test:scripts/tests/ingest-ig-chrome.test.ts::overlay::ruleToTopmostLayer
  Scenario: a rule is attributed to the TOPMOST layer that declares it
    Given a base layer with rules for "#publish-box" and "#ig-status p", and a top layer with a rule for "#ig-status p"
    When they are overlaid
    Then "#ig-status p" is attributed to the top layer and "#publish-box" to the base layer

  @test:scripts/tests/ingest-ig-chrome.test.ts::malformation::malformationDoubledHashOnly
  Scenario: catches the doubled hash and nothing else
    Then a doubled hash is reported as doubled
    And a colour, a name, a border shorthand, an rgba value and a data URI are not malformed

  @test:scripts/tests/ingest-ig-chrome.test.ts::declarations_inside_strings_and_parentheses::dataUriOneDeclaration
  Scenario: a data-URI value stays one declaration
    Given a rule whose background image is a data URI with an svg
    Then the rule's declarations are background-image, background-size and background-repeat
    And the background image value is the whole data URI

  @test:scripts/tests/ingest-ig-chrome.test.ts::declarations_inside_strings_and_parentheses::firstColonOutsideString
  Scenario: the first colon outside a string separates property from value
    Given declarations including a URL holding a semicolon
    Then they are read as three declarations, the URL kept whole

  @test:scripts/tests/ingest-ig-chrome.test.ts::declarations_inside_strings_and_parentheses::quotedSemicolonKept
  Scenario: custom properties in :root keep a quoted semicolon
    Given a :root block with a token whose quoted value holds a semicolon
    Then that token keeps its quoted value and the next token is read
