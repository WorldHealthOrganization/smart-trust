Feature: The IG's version chrome on every page of its site

  @test:scripts/ig-version-chrome.test.ts::versionFactsFrom::readsOwnConfig
  Scenario: every fact comes from the IG's own sushi-config.yaml
    Given an IG's sushi-config.yaml with id, canonical, name, title, status, version, release label, FHIR version and date
    Then the version chrome's facts are exactly those, with the canonical's trailing slash removed

  @test:scripts/ig-version-chrome.test.ts::versionFactsFrom::worldIsAGlobeCountryIsItsFlag
  Scenario: the jurisdiction's flag
    Then UN M49 001 is a globe labelled International, an ISO 3166 code is its flag, and any other code has none

  @test:scripts/ig-version-chrome.test.ts::the_three_pieces::tagIsVersionAndLabel
  Scenario: the version beside the IG's title
    Then it reads "<version> - <release label>" with the flag, and an IG that states no version gets none

  @test:scripts/ig-version-chrome.test.ts::the_three_pieces::bannerStatesThisBuildNotARelease
  Scenario: the banner states this build's own version
    Then it names the IG, this build's version and label, the FHIR version it is based on, and the Directory of published versions at the canonical
    And a CI build says it is not a published version, and a release does not

  @test:scripts/ig-version-chrome.test.ts::the_three_pieces::metadataTableAsThePublisherWritesIt
  Scenario: the metadata table
    Then it shows Official URL, Version, status as of date, and Computable Name, and a resource with no URL gets no table

  @test:scripts/ig-version-chrome.test.ts::withIgVersionChrome::versionRightOfTitleBannerAfterBar
  Scenario: on a page with the IG's full bar
    Then the version follows the title inside the bar, and the banner follows the whole bar

  @test:scripts/ig-version-chrome.test.ts::withIgVersionChrome::slimBarAndHomeTable
  Scenario: on a page with the slim bar, and on a home page
    Then the slim bar gets the version and banner, and a home page gets the IG's metadata table at the top of its main

  @test:scripts/ig-version-chrome.test.ts::withIgVersionChrome::idempotentAndLeavesBarlessPages
  Scenario: stamping twice changes nothing, and a page with no IG bar is left as it was

  @test:scripts/ig-version-chrome.test.ts::withIgVersionChrome::homePagesAreTheRootAndEachLanguage
  Scenario: home pages are the root's and each language's index

  @test:scripts/ig-version-chrome.test.ts::stampIgVersionChrome::everyBarredPageOnce
  Scenario: over a built site
    Then every page with the IG's bar is stamped once, in every language, and assets and redirect stubs are left alone
