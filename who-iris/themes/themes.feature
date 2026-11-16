Feature: The WHO themes agree with the sources they were measured from
  The two measured WHO themes (iris-web from the captured IRIS stylesheet,
  who-wpro-publication from the WPRO style guide's ingested pages) and the
  derived iris-sticky theme, checked against those sources rather than against
  copies of their constants.

  Background:
    Given the captured client-theme.css read out of the committed capture zip
    And the ingested page text of the WPRO style guide
    And the iris-web, who-wpro-publication and iris-sticky themes

  @test:themes/themes.test.ts::both_themes_exist_and_resolve::resolvesThreeThemesByKind
  Scenario: resolves three themes: two measured (webpage, publication) and one derived sticky
    When the WHO themes are listed
    Then their ids are exactly iris-sticky, iris-web and who-wpro-publication
    And iris-web is of kind webpage, who-wpro-publication of kind publication and iris-sticky of kind sticky

  @test:themes/themes.test.ts::both_themes_exist_and_resolve::eachPassesResolvedSchema
  Scenario: each passes the platform's RESOLVED schema, where requiredness lives
    When each WHO theme is parsed with the platform's resolved theme schema
    Then none of them throws

  @test:themes/themes.test.ts::both_themes_exist_and_resolve::keyedByInstance
  Scenario: is keyed by instance, because ids are not unique across instances
    When the theme key is made from the theme instance and the iris-web id
    Then the key is "who-iris:iris-web"

  @test:themes/themes.test.ts::iris-web_is_what_the_captured_stylesheet_actually_says::captureIsDspaceTheme
  Scenario: the capture is present and is the DSpace theme
    When the captured stylesheet is read
    Then it is longer than 500,000 characters
    And it contains "--ds-header-logo-height"

  @test:themes/themes.test.ts::iris-web_is_what_the_captured_stylesheet_actually_says::accentIsPrimaryNotBlue
  Scenario: `accent` is `--primary`, NOT the prettier `--blue`
    When the stylesheet's --primary and --blue custom properties are read
    Then --primary is "#008dc9" and --blue is "#2B4E72"
    And iris-web's accent is "#008dc9"
    And iris-web's accent is not the --blue value

  @test:themes/themes.test.ts::iris-web_is_what_the_captured_stylesheet_actually_says::edgeIsNavbarBottomBorder
  Scenario: `edge` is the navbar's own bottom border
    When the stylesheet's --ds-header-navbar-border-bottom-color is read
    Then it is "#ced4da"
    And iris-web's edge is "#ced4da"

  @test:themes/themes.test.ts::iris-web_is_what_the_captured_stylesheet_actually_says::inkAndSurfaceFromBody
  Scenario: `ink` and `surface` are the body's declared colour and background
    When the stylesheet's body rule is read
    Then it declares color #212529 and background-color #fff
    And iris-web's ink is "#212529" and its surface is "#ffffff"

  @test:themes/themes.test.ts::iris-web_is_what_the_captured_stylesheet_actually_says::declaresNoGradient
  Scenario: declares no gradient, because the source declares none
    Then iris-web's palette has no gradientFrom and no gradientTo

  @test:themes/themes.test.ts::iris-web_is_what_the_captured_stylesheet_actually_says::minWidthsAreColumnWidths
  Scenario: `minWidth` values are real COLUMN widths, not breakpoints
    When the stylesheet's .container max-widths are collected
    Then they are 540, 720, 960 and 1140 pixels
    And iris-web's laptop layout has minWidth "1140px"
    And the stylesheet's --ds-sidebar-items-width is "250px"
    And iris-web's card layout has minWidth "250px"
    And no iris-web layout has minWidth "992px"

  @test:themes/themes.test.ts::iris-web_is_what_the_captured_stylesheet_actually_says::paddingIsContentSpacing
  Scenario: `padding` is the theme's one declared content spacing
    When the stylesheet's --ds-content-spacing is read
    Then it is "1.5rem"
    And every iris-web layout has padding "1.5rem"

  @test:themes/themes.test.ts::iris-web_is_what_the_captured_stylesheet_actually_says::webFontScaleIsOne
  Scenario: `fontScale` is 1 everywhere, and that is MEASURED — the source declares no per-breakpoint scale
    Then the stylesheet contains "font-size:1rem"
    And every iris-web layout has fontScale 1

  @test:themes/themes.test.ts::who-wpro-publication_is_what_the_style_guide's_own_pages_say::accentIsWproLogoBlue
  Scenario: `accent` is the WPRO logo blue, and pages 6 and 12 agree on the RGB
    Then style guide page 6 contains "R: 0 G: 147 B: 213"
    And style guide page 12 contains "B: 213"
    And who-wpro-publication's accent is "#0093D5"

  @test:themes/themes.test.ts::who-wpro-publication_is_what_the_style_guide's_own_pages_say::printFormatsFromPage18
  Scenario: the three PRINT formats are page 18's, in the source's own units
    When style guide page 18 is read
    Then it contains "Frequently used formats and specs", "21 cm x 29.7 cm" and "14.8 cm x 21 cm"
    And who-wpro-publication's layouts are exactly a4 (21cm x 29.7cm), a5 (14.8cm x 21cm) and a5Landscape (21cm x 14.8cm), each with margin 1cm and fontScale 1

  @test:themes/themes.test.ts::who-wpro-publication_is_what_the_style_guide's_own_pages_say::marginIsLogoExclusionZone
  Scenario: `margin` is the 1 cm logo EXCLUSION ZONE from page 7, not an invented page margin
    Then style guide page 7 contains "at least 1cm"
    And every who-wpro-publication layout has margin "1cm"

  @test:themes/themes.test.ts::who-wpro-publication_is_what_the_style_guide's_own_pages_say::guideStatesNoEdgeColour
  Scenario: the guide states NO rule, border or divider colour — which is why `edge` is a choice
    When every ingested page of the style guide is listed
    Then there are 33 pages
    And no page, lower-cased, contains "rule colour", "border colour", "divider" or "line colour"

  @test:themes/themes.test.ts::who-wpro-publication_is_what_the_style_guide's_own_pages_say::edgeIsInPrimaryPalette
  Scenario: `edge` is nonetheless INSIDE the palette the guide does state
    Then the WPRO primary palette contains who-wpro-publication's edge
    And that edge is "#74CEE2"

  @test:themes/themes.test.ts::who-wpro-publication_is_what_the_style_guide's_own_pages_say::primaryPaletteHasTwelveColours
  Scenario: the primary palette is twelve colours, and page 12 carries all twelve RGB triples
    Then the WPRO primary palette has 12 colours
    And for each colour, style guide page 12 contains its "R: ", "G: " and "B: " decimal values

  @test:themes/themes.test.ts::who-wpro-publication_is_what_the_style_guide's_own_pages_say::printFontScaleIsOne
  Scenario: `fontScale` is 1 on every format — page 14 gives all four typefaces at 10pt, with no per-format size
    Then style guide page 14 contains "News Gothic MT", "DIN OT", "PT Sans" and "Calibri"
    And page 14 contains "(10pt)"
    And every who-wpro-publication layout has fontScale 1

  @test:themes/themes.test.ts::the_source's_contradictions_are_recorded,_not_resolved_away::bothContradictionsDeclared
  Scenario: both are still declared
    When the recorded contradictions are listed
    Then their ids are exactly "black-logo-k100-vs-rgb-100" and "logo-blue-c95-vs-c90"

  @test:themes/themes.test.ts::the_source's_contradictions_are_recorded,_not_resolved_away::page6StatesBothBlackLogos
  Scenario: page 6 really does state BOTH readings of the black logo
    Then style guide page 6 contains "K: 100" and "R: 100 G: 100 B: 100"
    And who-wpro-publication's ink is "#000000"

  @test:themes/themes.test.ts::the_source's_contradictions_are_recorded,_not_resolved_away::pages6And12DifferOnCyan
  Scenario: pages 6 and 12 really do give different CYAN for the one logo blue
    Then style guide page 6 contains "C: 95 M: 25"
    And style guide page 12 contains "C: 90" and "M: 25"

  @test:themes/themes.test.ts::the_source's_contradictions_are_recorded,_not_resolved_away::contradictionsAreDescribed
  Scenario: each contradiction says where it is, what the problem is, and what we took
    Then every recorded contradiction has a "where" longer than 5 characters
    And a "problem" longer than 30 characters
    And a "weTook" longer than 30 characters

  @test:themes/themes.test.ts::j66n's_fourth_clause:_a_missing_layout_stays_INVALID,_never_degraded::refusesPublicationMissingFormat
  Scenario: refuses a publication theme missing a format rather than filling it in
    Given who-wpro-publication with its a5Landscape layout removed
    When it is parsed with the resolved theme schema
    Then parsing throws

  @test:themes/themes.test.ts::j66n's_fourth_clause:_a_missing_layout_stays_INVALID,_never_degraded::refusesWebpageMissingViewport
  Scenario: refuses a webpage theme missing a viewport
    Given iris-web with its card layout removed
    When it is parsed with the resolved theme schema
    Then parsing throws

  @test:themes/themes.test.ts::j66n's_fourth_clause:_a_missing_layout_stays_INVALID,_never_degraded::refusesSwappedLayoutKinds
  Scenario: refuses print geometry on a webpage theme, and viewports on a publication theme
    When iris-web is parsed with who-wpro-publication's layouts
    Then parsing throws
    When who-wpro-publication is parsed with iris-web's layouts
    Then parsing throws

  @test:themes/themes.test.ts::iris-sticky_is_DERIVED_from_iris-web,_not_restated_(bean_v8n5)::stickyPaletteMatchesStylesheet
  Scenario: its palette equals what the captured DSpace stylesheet says, role by role
    Then iris-sticky's accent is the stylesheet's --primary, normalised to six-digit lower-case hex
    And its edge is the stylesheet's --ds-header-navbar-border-bottom-color, normalised
    And its ink is the body rule's color, normalised
    And its surface is the body rule's background-color, normalised

  @test:themes/themes.test.ts::iris-sticky_is_DERIVED_from_iris-web,_not_restated_(bean_v8n5)::stickyPaletteEqualsIrisWeb
  Scenario: its palette IS iris-web's — every role, and no role of its own
    Then iris-sticky's palette equals iris-web's palette

  @test:themes/themes.test.ts::iris-sticky_is_DERIVED_from_iris-web,_not_restated_(bean_v8n5)::stickyDeclaresNoColourLiteral
  Scenario: declares no colour literal of its own: the palette arrives by inheritance
    Given the source of themes.ts between "const IRIS_STICKY" and "const RAW"
    Then that declaration inherits from the IRIS_WEB theme of THEME_REPOSITORY
    And it contains no hex colour literal
    And it does not contain "palette:"

  @test:themes/themes.test.ts::iris-sticky_is_DERIVED_from_iris-web,_not_restated_(bean_v8n5)::stickyDescriptionSaysDerived
  Scenario: says in its description that it is derived from iris-web
    Then iris-sticky's description contains "derived from iris-web"

  @test:themes/themes.test.ts::iris-sticky_is_DERIVED_from_iris-web,_not_restated_(bean_v8n5)::stickyTakesBoardGeometry
  Scenario: takes the note board's geometry, since IRIS has no sticky surface to measure
    Given the platform's default theme
    Then the default theme is of kind sticky
    And iris-sticky's layouts equal the default theme's layouts

  @test:themes/themes.test.ts::iris-sticky_is_DERIVED_from_iris-web,_not_restated_(bean_v8n5)::stickyCarriesNoBackdrop
  Scenario: carries no backdrop — IRIS imagery is somebody else's artefact
    Then iris-sticky has no backdrop
