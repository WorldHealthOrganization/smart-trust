Feature: a document page built into the site's theme layout

  @test:scripts/document-layout.test.ts::--document-layout::jekyllPageRawBody
  Scenario: the page is a Jekyll page in the layout, its body raw and rendered unchanged
    Given a block with literal Liquid text
    When the site is built with layout "default"
    Then there are no errors
    And the page starts with front matter and a raw block
    And the body keeps the Liquid text, the block anchor and the document class, and ends with the end marker
    And it carries no document-level tags and keeps the edit link

  @test:scripts/document-layout.test.ts::--document-layout::rulesScopedUnderPageClass
  Scenario: every rule on the page, KaTeX and block actions included, is scoped under the page class
    When the themed site is built with math and block actions
    Then KaTeX and the block-action styles are present
    And no selector is outside the page class and no colour-scheme query is carried

  @test:scripts/document-layout.test.ts::--document-layout::headingIdsForOnThisPage
  Scenario: anchored headings get ids for the theme's On this page; the anchors keep theirs
    When the themed site is built
    Then an anchored heading gets an h- id after its anchor
    And the rail declaration is not carried

  @test:scripts/document-layout.test.ts::--document-layout::headingIdsUniqueStable
  Scenario: headingIds: unique against the page, stable, and leaves an id alone
    When heading ids are added to a page that already uses h-s and mine
    Then the new id is h-s-2, the existing id is kept
    And running again gives the same result

  @test:scripts/document-layout.test.ts::--document-layout::lazyKeepsDataHooks
  Scenario: a lazy page keeps its data hooks; its one-page version stays standalone
    When the themed site is built lazily
    Then the body keeps its blocks hooks, placeholder, data path and hydrated link
    And the hydrated page is a standalone document

  @test:scripts/document-layout.test.ts::--document-layout::noFlagStandalone
  Scenario: without the flag the page is the standalone one
    When the site is built without a layout
    Then the page is a standalone document with no end marker and no heading ids

  @test:scripts/document-layout.test.ts::--document-layout::badLayoutRefused
  Scenario: a layout that is not a bare name is refused
    When the site is built with a layout holding a newline, and a page with layout "a b" is made
    Then both are refused as not a layout name

  @test:scripts/document-layout.test.ts::--document-layout::scopeCssEverything
  Scenario: scopeCss puts every rule, media queries included, under the scope
    When CSS with selectors, :root and a media query is scoped
    Then each rule, :root and the media query's rules are under the scope
    And no selector is unscoped

  @test:scripts/document-layout.test.ts::--document-layout::scopeCssRootStateAndPanel
  Scenario: scopeCss keeps a root state class on the root and leaves the block panel global
    When CSS using the root state class and the block panel is scoped
    Then the root state stays on html with the scope after it
    And the block panel rules stay global, and a lookalike class is scoped

  @test:scripts/document-layout.test.ts::public-comment_notes_land_on_either_kind_of_document_page::standaloneNotesBeforeBody
  Scenario: standalone: before the closing body tag
    When a note is added to a standalone page
    Then it goes before the closing body tag

  @test:scripts/document-layout.test.ts::public-comment_notes_land_on_either_kind_of_document_page::themedNotesBeforeMarker
  Scenario: themed: before the end marker, escaped for the raw block it lands in
    When a note with Liquid and $& is added to a themed page
    Then it goes before the end marker, escaped for the raw block

  @test:scripts/document-layout.test.ts::public-comment_notes_land_on_either_kind_of_document_page::neitherIsError
  Scenario: a page with neither is an error, not a page without its notes
    When a note is added to a page with no body and no marker
    Then it throws saying there is nowhere to add it

  @test:scripts/document-layout.test.ts::public-comment_notes_land_on_either_kind_of_document_page::realThemedBuildNotes
  Scenario: on a real themed build
    When a note is added to a real themed page
    Then it lands before the end marker and no selector is unscoped
