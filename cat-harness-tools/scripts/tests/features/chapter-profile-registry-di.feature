# pipeline/chapter-profile-registry-di.ts holds one folio's chapter profiles (expected q-regimes, categorical and archimedean chapters) behind a DI registry.
# Unconfigured must read as "no opinion", never as "expectation met". Each Scenario names the test that executes it.
Feature: Chapter profile registry

  @test:scripts/tests/chapter-profile-registry-di.test.ts::unconfigured_is_'no_opinion',_not_'no_findings'::reports_itself_unconfigured
  Scenario: An unconfigured registry reports itself unconfigured
    Given the chapter profile registry has been reset
    When chapterProfilesConfigured is asked
    Then it answers false

  @test:scripts/tests/chapter-profile-registry-di.test.ts::unconfigured_is_'no_opinion',_not_'no_findings'::no_chapter_has_a_profile_—_so_nothing_can_be_scored_as_passing
  Scenario: With no profiles configured, no chapter has a profile
    Given the chapter profile registry has been reset
    When chapterHasProfile is asked about "opening-chapter" and about undefined
    Then both answers are false

  @test:scripts/tests/chapter-profile-registry-di.test.ts::unconfigured_is_'no_opinion',_not_'no_findings'::the_empty_registry_is_empty,_not_a_stub_that_answers_yes
  Scenario: The empty registry answers no to every lookup
    Given the chapter profile registry has been reset
    When the value exports are read for "anything"
    Then CHAPTER_EXPECTED_REGIMES has no entry for it
    And neither CATEGORICAL_CHAPTERS nor ARCHIMEDEAN_CHAPTERS contains it
    And CATEGORICAL_CHAPTERS has size 0
    And CHAPTER_EXPECTED_REGIMES has no keys

  @test:scripts/tests/chapter-profile-registry-di.test.ts::configured::the_value_exports_read_through_to_the_injected_data
  Scenario: The value exports read through to the configured data
    Given the registry is configured with a fixture of "opening-chapter" and "measured-chapter"
    When the value exports are read
    Then the regimes of "opening-chapter" are "na" and "symbolic"
    And CATEGORICAL_CHAPTERS contains "opening-chapter" and has size 1
    And ARCHIMEDEAN_CHAPTERS contains "measured-chapter"

  @test:scripts/tests/chapter-profile-registry-di.test.ts::configured::`in`,_Object.keys_and_Object.entries_work_through_the_Proxy
  Scenario: The in operator, Object.keys and Object.entries work through the Proxy
    Given the registry is configured with the two-chapter fixture
    Then "opening-chapter" is in CHAPTER_EXPECTED_REGIMES
    And its sorted keys are "measured-chapter" and "opening-chapter"
    And Object.entries does not throw and yields 2 entries

  @test:scripts/tests/chapter-profile-registry-di.test.ts::configured::iteration_over_the_chapter_sets_works
  Scenario: The chapter sets can be iterated
    Given the registry is configured with the two-chapter fixture
    When CATEGORICAL_CHAPTERS and ARCHIMEDEAN_CHAPTERS are spread into arrays
    Then they are ["opening-chapter"] and ["measured-chapter"]

  @test:scripts/tests/chapter-profile-registry-di.test.ts::configured::chapterHasProfile_distinguishes_a_known_chapter_from_an_unknown_one
  Scenario: chapterHasProfile tells a known chapter from an unknown one
    Given the registry is configured with the two-chapter fixture
    Then chapterHasProfile is true for "opening-chapter"
    And false for "never-heard-of-it"

  @test:scripts/tests/chapter-profile-registry-di.test.ts::configured::a_later_configure_wins
  Scenario: A later configure replaces the earlier one
    Given the registry is configured with the two-chapter fixture
    When it is configured again with only "only-mine"
    Then the regime keys are exactly ["only-mine"]
    And "opening-chapter" no longer has a profile

  @test:scripts/tests/chapter-profile-registry-di.test.ts::no_shipped_default::loading_the_registry_configures_nothing
  Scenario: Loading the registry module configures nothing
    Given the chapter profile registry has been reset
    When the registry module is imported
    Then the registry is still unconfigured
    And its archimedean chapter set is empty
