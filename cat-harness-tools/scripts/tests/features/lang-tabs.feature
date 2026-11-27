# The chrome's language tabs link to a declared hreflang alternate when the
# page has one, and to a /<locale>/ guess only without one; the publish link
# check refuses a tab that reaches no page, and the 404 page falls back to
# English. Each Scenario names the test that executes it.
Feature: Language tabs and the 404 English fallback

  @test:scripts/tests/lang-tabs.test.ts::language_tabs_—_where_the_chrome's_tabs_link_(owner,_2026-11-13:_who-iris/fr/_404)::a_declared_hreflang_alternate_is_the_tab's_href;_the_/<locale>/_guess_only_without_one
  Scenario: A declared alternate is the tab's href; an undeclared locale is guessed by convention
    Given an English page at "/who-iris/index.html" declaring a French alternate "who-iris/fr/index.html", with English, French and Spanish available
    When its language tabs are drawn
    Then the French tab links to "who-iris/fr/index.html" from the alternate
    And the Spanish tab links to "/who-iris/es/index.html" by convention

  @test:scripts/tests/lang-tabs.test.ts::language_tabs_—_where_the_chrome's_tabs_link_(owner,_2026-11-13:_who-iris/fr/_404)::a_page_under_a_locale-prefixed_tree_swaps_its_segment_in_place_(the_who-iris_glossary_pages)
  Scenario: A page under a locale-prefixed tree swaps its locale segment in place
    Given a French page at "/who-iris/fr/folio-assistant-core/glossary/index.html" with English, French and Spanish available
    When its language tabs are drawn
    Then the English tab drops the "fr" segment and the Spanish tab replaces it with "es"
    And a French page at "/r/x/fr/a.html" gets a Spanish tab at "/r/x/es/a.html"

  @test:scripts/tests/lang-tabs.test.ts::language_tabs_—_where_the_chrome's_tabs_link_(owner,_2026-11-13:_who-iris/fr/_404)::an_unavailable_locale_draws_no_link,_and_a_page_with_no_meta_block_draws_no_tabs
  Scenario: No available locale, or no translation meta block, draws no tabs
    Given a page whose meta block lists no available locales
    And a page with no meta block at all
    When their language tabs are drawn
    Then each draws no tabs

  @test:scripts/tests/lang-tabs.test.ts::language_tabs_—_where_the_chrome's_tabs_link_(owner,_2026-11-13:_who-iris/fr/_404)::a_translated_page's_English_tab_strips_its_own_locale_segment
  Scenario: A translated page's English tab strips its own locale segment
    Given a French page at "/r/fr/a.html" with English and French available
    When its language tabs are drawn
    Then the only tab is English, linking to "/r/a.html" by convention

  @test:scripts/tests/lang-tabs.test.ts::language_tabs_—_where_the_chrome's_tabs_link_(owner,_2026-11-13:_who-iris/fr/_404)::the_publish_link_check_refuses_a_tab_that_reaches_no_page:_the_who-iris_home_as_it_was
  Scenario: The publish link check reports a language tab that reaches no page
    Given a site with only "who-iris/fr/index.html" and a home page whose meta lists French and Spanish but declares no alternates
    When the site's links are checked under "/who-iris/"
    Then the French and Spanish tabs are both reported as misses by convention
    When the home page declares its French alternate
    Then only the Spanish tab is reported as a miss

  @test:scripts/tests/lang-tabs.test.ts::the_404_page's_English_fallback::a_locale_segment_is_replaced_by_en/,_then_removed;_never_the_path_asked_for
  Scenario: The fallback candidates replace a locale segment with en/, then remove it
    When fallback candidates are computed for "/who-iris/fr/"
    Then they are "/who-iris/en/" then "/who-iris/"
    And an English path "/who-iris/en/" falls back only to "/who-iris/"
    And a path with no locale segment has no candidates
    And no candidate is ever the path asked for

  @test:scripts/tests/lang-tabs.test.ts::the_404_page's_English_fallback::a_site_without_a_404_page_gets_one;_a_site_with_one_keeps_it_and_gains_the_fallback,_once
  Scenario: A missing 404 page is written; an existing one keeps its content and gains the fallback once
    Given a site with no 404 page
    When the locale fallback 404 is written under "/r/"
    Then it is "written", carries the fallback mark and a link to "/r/", with the script after the notice it fills
    And writing it again reports "present"
    Given a site whose 404 page says "Lost"
    When the locale fallback 404 is written
    Then it is "added", the "Lost" heading is kept, the fallback mark appears once, and the page ends with the script before the closing tags
