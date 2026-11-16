Feature: the library site's entry pages

  @test:scripts/build-library-site.test.ts::build-library-site_(bean_zcak)::entryTitleSaysSource
  Scenario: the entry title says what the source is: public comment by default, the folio's own label when it gives one
    When the entry view is made without and with a source label
    Then the title says public comment by default, or the folio's own label

  @test:scripts/build-library-site.test.ts::build-library-site_(bean_zcak)::sectionMapsToFolioBlock
  Scenario: a section maps to the first folio block of the section with its number; one with no counterpart maps to nothing
    When sections are mapped to edits into the folio
    Then a numbered section maps to the first block of that number
    And an unnumbered section maps by title, or to nothing
    And another entry has no mapping

  @test:scripts/build-library-site.test.ts::build-library-site_(bean_zcak)::entryPageUnderHandlerRoute
  Scenario: the entry page is published under the handler route, with links to the library's files and edits into the folio
    When the library site is built
    Then the entry is listed with three sections, two editable
    And its view links the library's files and edits into the folio
    And its page is under en/ and loads the view and block URLs, and the index links it
    And no page is written outside en/

  @test:scripts/build-library-site.test.ts::build-library-site_(bean_zcak)::saysWhatItReads
  Scenario: it says what it reads: the library and the folio
    When what the site reads is asked
    Then it is library and folio

  @test:scripts/build-library-site.test.ts::build-library-site_(bean_zcak)::sectionsDeclaredToRail
  Scenario: the page declares its sections to the rail: top level as rows, the next level as their children
    When the entry's contents are made and the site is built
    Then the top-level sections are rows pointing at #sec- anchors
    And the page carries the rail declaration

  @test:scripts/build-library-site.test.ts::build-library-site_(bean_zcak)::themedWithLayout
  Scenario: with --layout, every library page is a Jekyll page in the site's layout, so it carries the site theme
    When the library site is built with a layout
    Then the entry page and the index start with front matter naming that layout
    And the content sits in a Liquid raw block inside the library class, with no standalone shell
    And without a layout the page is the standalone one, and a bad layout name is refused
