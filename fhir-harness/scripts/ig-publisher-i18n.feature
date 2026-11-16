Feature: The IG Publisher's QA messages in each language an IG translates into

  @test:scripts/ig-publisher-i18n.test.ts::ig-publisher-i18n::readsJavaPropertiesAndMessageFormatTemplates
  Scenario: the Publisher's bundles and templates are read as Java writes them
    Given a Messages.properties with escapes, continuations and MessageFormat quoting
    When it is parsed and a message text is matched against its template
    Then the parameters are recovered by placeholder and filled into another template with '' read as one quote

  @test:scripts/ig-publisher-i18n.test.ts::ig-publisher-i18n::translatesByKeyThenByBestTemplateAndRefusesBrokenPublisherTemplates
  Scenario: a message is translated from the Publisher's own bundle, and a broken Publisher template is refused
    Given the Publisher's English and Russian bundles, one Russian template with a stray brace
    When the build's messages are translated into Russian
    Then a message whose text is an instance of its key's template is in the Publisher's Russian
    And a message keyed by an outer message is matched by the inner template it prints
    And the broken template is reported and never shown, its message staying in English

  @test:scripts/ig-publisher-i18n.test.ts::ig-publisher-i18n::fillsTheGapsFromThisLayersCatalogueMarkedMachine
  Scenario: what the Publisher does not translate comes from this layer's catalogue, marked as machine translation
    Given a Chinese catalogue with bundle-keyed entries, a text template, and one entry that drops a placeholder
    When the messages are translated into Chinese
    Then each covered message is in Chinese with origin machine and its catalogue key
    And the entry that drops a placeholder is not used

  @test:scripts/ig-publisher-i18n.test.ts::ig-publisher-i18n::listsWhatALocaleLacksWithWhereItRendersAndAppendsIt
  Scenario: a build lists what a locale lacks, with where each string renders, and appends it to the catalogue once
    Given messages a locale has no translation for, some with parameters that are messages themselves
    When the needs are listed for a published site and merged
    Then each need names its bundle key and version and deep-links the rows that print it
    And merging twice appends nothing the second time, and an empty entry translates nothing

  @test:scripts/ig-publisher-i18n.test.ts::ig-publisher-i18n::reportsWhereEachTranslatedStringIsUsed
  Scenario: the where-used report names each string's origin and the rows that print it
    Given the Russian translation of the build's messages
    When the usage report is written
    Then each catalogue key lists its origin, count and deep links into ru/qa.html

  @test:scripts/ig-publisher-i18n.test.ts::ig-publisher-i18n::neverSubstitutesAnotherCoreVersion
  Scenario: the bundles are fetched at exactly the AST's core version
    Given a version that is not a core version, and a cache that holds 7.0.1
    When bundles are fetched
    Then the first is refused and the second is reused without a fetch
