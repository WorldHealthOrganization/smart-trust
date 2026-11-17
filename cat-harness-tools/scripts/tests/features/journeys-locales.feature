# scripts/journeys/locales.ts writes the journeys viewer once per locale the
# declaring layer has a journeys-viewer.po for, and links every page to the others.
# Each Scenario names the test that executes it.
Feature: The journeys viewer in every language

  @test:scripts/tests/journeys-locales.test.ts::potEntries::takes_every_page's_words,_the_JSON_models'_labels_and_the_scripts'_T()_strings,_each_once
  Scenario: potEntries: Takes every page's words, the JSON models' labels and the scripts' T() strings, each once
    Given the fixture in journeys-locales.test.ts
    When potEntries runs on it
    Then it takes every page's words, the JSON models' labels and the scripts' T() strings, each once

  @test:scripts/tests/journeys-locales.test.ts::localizedFiles::writes_each_file_again_at_the_same_path_under_the_locale
  Scenario: localizedFiles: Writes each file again at the same path under the locale
    Given the fixture in journeys-locales.test.ts
    When localizedFiles runs on it
    Then it writes each file again at the same path under the locale

  @test:scripts/tests/journeys-locales.test.ts::localizedFiles::names_every_language_on_every_page,_as_alternates_and_as_links
  Scenario: localizedFiles: Names every language on every page, as alternates and as links
    Given the fixture in journeys-locales.test.ts
    When localizedFiles runs on it
    Then it names every language on every page, as alternates and as links

  @test:scripts/tests/journeys-locales.test.ts::localizedFiles::translates_the_JSON_models'_labels_and_carries_the_scripts'_catalogue
  Scenario: localizedFiles: Translates the JSON models' labels and carries the scripts' catalogue
    Given the fixture in journeys-locales.test.ts
    When localizedFiles runs on it
    Then it translates the JSON models' labels and carries the scripts' catalogue

  @test:scripts/tests/journeys-locales.test.ts::localizedFiles::reports_what_is_left_English
  Scenario: localizedFiles: Reports what is left English
    Given the fixture in journeys-locales.test.ts
    When localizedFiles runs on it
    Then it reports what is left English

  @test:scripts/tests/journeys-locales.test.ts::mergeCatalogue::keeps_translations,_fills_from_memory,_drops_what_the_template_no_longer_has
  Scenario: mergeCatalogue: Keeps translations, fills from memory, drops what the template no longer has
    Given the fixture in journeys-locales.test.ts
    When mergeCatalogue runs on it
    Then it keeps translations, fills from memory, drops what the template no longer has
