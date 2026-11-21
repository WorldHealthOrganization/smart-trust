# pipeline/translation-index.ts builds the translation index the navbar reads: a page is a translation because
# its front matter declares a non-source "lang", and every translated page must stay out of the static nav.
# Each Scenario names the test that executes it.
Feature: Translation index

  @test:pipeline/translation-index.test.ts::a_page_is_a_translation_because_IT_says_so::indexes_a_page_that_declares_a_non-source_`lang`
  Scenario: A page declaring a non-source "lang" is indexed
    Given a docs site with a source home page and "fr/index.md" declaring "lang: fr"
    When the translation index is built
    Then there are no findings beyond notes
    And the locales are "fr"
    And the home page's French translation has URL "/fr/index.html" and title "Accueil (FR)"

  @test:pipeline/translation-index.test.ts::a_page_is_a_translation_because_IT_says_so::does_NOT_index_an_`fr/`_directory_whose_pages_declare_nothing
  Scenario: An "fr/" directory whose pages declare nothing is not indexed
    Given a docs site with a source home page and "fr/index.md" with no "lang"
    When the translation index is built
    Then there are no locales and no pages
    And there are no findings beyond notes

  @test:pipeline/translation-index.test.ts::a_page_is_a_translation_because_IT_says_so::indexes_a_translation_that_is_NOT_in_a_locale-named_directory
  Scenario: A translation outside a locale-named directory is indexed
    Given a docs site with a source home page and "accueil-fr.md" declaring "lang: fr" beside it
    When the translation index is built
    Then there are no findings beyond notes
    And the home page's French translation has URL "/accueil-fr.html"

  @test:pipeline/translation-index.test.ts::a_page_is_a_translation_because_IT_says_so::a_page_with_no_`lang`_is_the_source_language,_not_unknown
  Scenario: A page with no "lang" is the source language
    Given a docs site whose home page has no "lang" and a French translation of it
    When the translation index is built
    Then the home page's source title is "Home"

  @test:pipeline/translation-index.test.ts::a_page_is_a_translation_because_IT_says_so::the_source_language_comes_from_harness.config.json,_not_from_`en`
  Scenario: The source language comes from harness.config.json, not from "en"
    Given a layer configured with default locale "fr", a French home page and an English page translating it
    When the translation index is built
    Then there are no findings beyond notes
    And the source locale is "fr"
    And the locales are "en"

  @test:pipeline/translation-index.test.ts::a_page_is_a_translation_because_IT_says_so::only_formats_the_CONTENT_TYPE_declares_translatable_are_walked
  Scenario: Only formats the content type declares translatable are walked
    Given the "docs" content type, for which ".md" is translatable and ".json" is not
    And a docs site with a source home page and "data-fr.json" holding a "lang" of "fr"
    When the translation index is built
    Then there are no locales
    And there are no findings beyond notes

  @test:pipeline/translation-index.test.ts::a_page_is_a_translation_because_IT_says_so::Jekyll's_own_underscore_directories_are_not_content
  Scenario: Jekyll's underscore directories are not content
    Given a docs site with a French page under "_includes/"
    When the translation index is built
    Then there are no locales

  @test:pipeline/translation-index.test.ts::what_a_translated_page_must_also_say::reports_%s
  Scenario: A translated page missing a required declaration is reported and not indexed
    Given a docs site with a source home page and a French page that has one of these defects
    When the translation index is built
    Then the only error is on "fr/index.md", and its message names the defect
    And the home page has no French translation indexed
    And the cases are: no "nav_exclude" ("it cannot un-render one"), a "nav_order" as well ("takes its source page's position"), no "translation_source" ("which page it translates"), and a "translation_source" naming a missing page ("which is not there")

  @test:pipeline/translation-index.test.ts::what_a_translated_page_must_also_say::reports_a_translation_whose_source_is_itself_a_translation
  Scenario: A translation whose source is itself a translation is reported
    Given a docs site with a French translation of the home page and a Spanish page naming the French page as its source
    When the translation index is built
    Then the only error is on "es/index.md"
    And its message contains "translation of a translation"

  @test:pipeline/translation-index.test.ts::what_a_translated_page_must_also_say::reports_two_translations_of_one_page_in_one_locale
  Scenario: Two translations of one page in one locale are reported
    Given a docs site with two French translations of the home page
    When the translation index is built
    Then the first error's message contains "second fr translation"

  @test:pipeline/translation-index.test.ts::three_states::a_tree_with_no_Jekyll_site_is_UNREADABLE,_not_empty
  Scenario: A tree with no Jekyll site is unreadable, not empty
    Given a directory with no Jekyll site
    Then no site root is found
    And checking the translation index gives state "unreadable" with an unreadable finding

  @test:pipeline/translation-index.test.ts::three_states::a_NAMED_docs_directory_is_read_without_a_`_config.yml`,_and_an_absent_one_is_still_unreadable
  Scenario: A named docs directory is read without a "_config.yml", and an absent one is unreadable
    Given a layer with a "site-docs" directory holding a source page and a French translation, and no "_config.yml"
    When the translation index is built over that directory
    Then there are no findings beyond notes
    And the locales are "fr"
    And building over a directory that does not exist gives an unreadable finding

  @test:pipeline/translation-index.test.ts::three_states::a_site_with_no_translations_at_all_is_DETERMINED_empty
  Scenario: A site with no translations is determined empty
    Given a docs site with only a source home page
    When the translation index is built
    Then there are no findings beyond notes
    And the index carries the index schema and has no pages

  @test:pipeline/translation-index.test.ts::three_states::an_unparseable_page_is_a_note_until_a_translation_names_it
  Scenario: An unparseable page is a note until a translation names it
    Given a docs site with a page "broken.md" whose front matter will not parse and an unrelated French translation
    When the translation index is built
    Then there are no errors and nothing unreadable
    And the only note is on "broken.md"
    And when a French page names "broken.md" as its source, that French page is unreadable

  @test:pipeline/translation-index.test.ts::URL_normalisation_matches_navKey_in_docs-ui.js::%s_->_"%s"
  Scenario: A URL normalises to the same page key as navKey in docs-ui.js
    When the page key of each URL is taken
    Then "/" and "/index.html" key to the empty key
    And "/getting-started.html" and "/getting-started/" key to "getting-started"
    And "/guides/agent-onboarding.html" keys to "guides/agent-onboarding"
    And "/fr/index.html" keys to "fr", and "/guides/fr/agent-onboarding.html" to "guides/fr/agent-onboarding"
    And "/x.html?lang=fr" and "/x.html#anchor" key to "x"

  @test:pipeline/translation-index.test.ts::URL_normalisation_matches_navKey_in_docs-ui.js::a_declared_`permalink`_wins_over_the_composed_path
  Scenario: A declared permalink wins over the composed path
    Then the URL of "index.md" with permalink "/" is "/"
    And without a permalink it is "/index.html"

  @test:pipeline/translation-index.test.ts::URL_normalisation_matches_navKey_in_docs-ui.js::front_matter_that_will_not_parse_throws_rather_than_reading_as_empty
  Scenario: Front matter that will not parse throws rather than reading as empty
    Then reading the front matter "title: a: b" throws
    And text with no front matter has no front matter

  @test:pipeline/translation-index.test.ts::this_repository's_own_corpus::is_a_Jekyll_site_where_this_module_looks_for_one
  Scenario: This repository is a Jekyll site where the module looks for one
    Then the site root of this layer is its site directory
    And ".md" is translatable for this layer's content type

  @test:pipeline/translation-index.test.ts::this_repository's_own_corpus::every_translated_page_is_out_of_the_STATIC_nav
  Scenario: Every translated page in this repository is out of the static nav
    Given every ".md" page of this layer's site, outside underscore directories, that declares a non-source "lang"
    Then each has "nav_exclude: true" and no "nav_order"
    And at least one such page was found

  @test:pipeline/translation-index.test.ts::this_repository's_own_corpus::the_committed_index_is_up_to_date_and_valid
  Scenario: The committed translation index is up to date and valid
    # Skipped: the committed index names a page built by a higher layer this checkout does not hold
    When the translation index of this layer is checked
    Then there are no findings beyond notes
    And the state is "ok"

  @test:pipeline/translation-index.test.ts::this_repository's_own_corpus::the_published_index_names_a_source_page_that_really_exists
  Scenario: The published index names source pages that really exist
    # Skipped: the committed index names a page built by a higher layer this checkout does not hold
    Given the committed translation index
    Then it has at least one page
    And each page's source URL keys to its own key
    And each source URL is served by a source file that exists in the site
