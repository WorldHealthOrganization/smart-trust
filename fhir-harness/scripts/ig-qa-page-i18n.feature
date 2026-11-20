Feature: The QA report in each language an IG translates into

  @test:scripts/ig-qa-page-i18n.test.ts::ig-qa-page-i18n::everyLocaleTranslatesEveryStringOfThePage
  Scenario: every UN locale translates every string of the QA page and its script
    Given this layer's catalogues for ar, es, fr, ru and zh
    When each is read against the page's English strings
    Then none is refused and none is missing

  @test:scripts/ig-qa-page-i18n.test.ts::ig-qa-page-i18n::aStaleOrBrokenEntryShowsTheEnglish
  Scenario: a stale entry, or one that drops a variable, shows the English (fail closed)
    Given a catalogue with an entry whose English changed and one that drops {verdict}
    When the page's strings are read
    Then both are refused with why, the English is shown for them, and a sound entry is used

  @test:scripts/ig-qa-page-i18n.test.ts::ig-qa-page-i18n::aTranslatedPageSaysWhatStaysEnglishAndPointsAtItsOwnMessages
  Scenario: a translated QA page draws its own locale's messages and marks what stays English
    Given the Publisher's messages and an empty KG report
    When the page is rendered in French
    Then its headings are French, it loads qa-messages.fr.json and links the where-used report
    And the KG half, written in English by cat-harness-tools, is marked lang="en" and says it is English only

  @test:scripts/ig-qa-page-i18n.test.ts::ig-qa-page-i18n::buildsThePageInEachLocaleFromCachedPublisherBundles
  Scenario: the page is built in each locale from the Publisher's bundles at the AST's core version
    Given an AST that records core 9.9.9 and a cache holding its English and Russian bundles
    When the page is built for ru and zh
    Then ru's message is the Publisher's, zh's is this layer's machine translation
    And an AST with no core version still gets its pages, and the build says why it has no bundles
