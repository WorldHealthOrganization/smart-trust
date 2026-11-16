# A preview says which index its search box is searching: marked staleness is
# not worse than absence. Each Scenario names the test that executes it.
Feature: Search index notice on previews

  @test:scripts/tests/search-index-notice.test.ts::the_notice_is_decided_without_a_browser::`published`_warns_that_hits_are_about_the_main_site
  Scenario: A published index warns that hits are about the main site
    Given searchIndexNotice lifted from the shipped docs-ui.js
    When the notice for "published" is computed
    Then it says "published site" and "not from this preview"

  @test:scripts/tests/search-index-notice.test.ts::the_notice_is_decided_without_a_browser::`unavailable`_says_search_does_not_work_here,_and_why
  Scenario: An unavailable index says so and why
    When the notice for "unavailable" is computed
    Then it says "unavailable" and "could not be fetched"

  @test:scripts/tests/search-index-notice.test.ts::the_notice_is_decided_without_a_browser::the_canonical_deploy_draws_NOTHING
  Scenario: The canonical deploy draws no notice
    When the notice for the empty stamp is computed
    Then it is null

  @test:scripts/tests/search-index-notice.test.ts::the_notice_is_decided_without_a_browser::an_unrecognised_stamp_draws_nothing_rather_than_guessing
  Scenario: An unrecognised stamp draws no notice
    When the notice for an unknown stamp is computed
    Then it is null

  @test:scripts/tests/search-index-notice.test.ts::the_wiring_the_pure_function_cannot_cover::the_meta_the_notice_reads_is_the_meta_the_page_emits
  Scenario: The notice reads the meta the page emits
    Then head_custom.html emits a meta named "fa-search-index" from site.data.build.search_index
    And docs-ui.js reads meta[name="fa-search-index"]

  @test:scripts/tests/search-index-notice.test.ts::the_wiring_the_pure_function_cannot_cover::the_notice_is_appended_to_the_search_holder,_not_the_page_banner
  Scenario: The notice goes into the search holder
    # Gap: source-text pattern checks on docs-ui.js; nothing is rendered.
    Then docs-ui.js names "fa-search-notice"
    And it appends the notice to searchDrop, searchDrop to adopted, and adopted to searchHolder

  @test:scripts/tests/search-index-notice.test.ts::the_wiring_the_pure_function_cannot_cover::it_carries_role="status",_for_the_declared_low-dexterity_profile
  Scenario: The notice carries role status
    Then docs-ui.js creates the notice with class "fa-search-notice" and role "status"

  @test:scripts/tests/search-index-notice.test.ts::every_CSS_token_the_notice_uses_is_actually_defined::no_invented_custom_properties
  Scenario: Every CSS custom property the notice uses is defined
    Given the .fa-search-notice rule in docs-ui.css
    Then it uses at least one var(--…) token
    And every token it uses is declared somewhere in the stylesheet
