# scripts/staging-share.ts lets a staging preview keep only the files that differ from the live
# site, sharing the rest, and supplies the fallback worker and root 404 page.
# Each Scenario names the test that executes it.
Feature: A staging preview shares what the live site already has

  @test:scripts/tests/sdlc/staging-share.test.ts::what_counts_as_the_live_site's_copy::a_page_that_differs_only_by_the_per-preview_edits_is_shared
  Scenario: A page differing only by the per-preview edits counts as the live copy
    Given a live page and its preview carrying the staging banner, staging meta tags and a "(staging: s1)" title
    When both are normalised for preview "s1"
    Then the normalised preview equals the normalised live page
    And "a.html" is judged the same as live

  @test:scripts/tests/sdlc/staging-share.test.ts::what_counts_as_the_live_site's_copy::a_page_whose_content_differs_is_kept
  Scenario: A page whose content differs is kept in the preview
    Given a preview page whose body says "changed" where the live page says "same"
    When it is compared with the live page
    Then it is not judged the same as live

  @test:scripts/tests/sdlc/staging-share.test.ts::what_counts_as_the_live_site's_copy::a_non-HTML_file_is_shared_only_byte_for_byte
  Scenario: A non-HTML file counts as the live copy only when byte-identical
    Given a CSS file "x.css"
    When an identical copy is compared with live
    Then it is judged the same
    And a copy differing by one trailing space is not

  @test:scripts/tests/sdlc/staging-share.test.ts::what_counts_as_the_live_site's_copy::the_preview's_own_facts_are_never_shared
  Scenario: The preview's own facts are never shared
    Given identical "staging.json" contents in preview and live
    Then "staging.json" is not judged the same as live
    And the root "index.html" is not judged the same as live
    And "en/index.html" with the same content is judged the same

  @test:scripts/tests/sdlc/staging-share.test.ts::the_plan::shares_what_matches,_keeps_what_differs_or_is_new
  Scenario: The share plan shares matching files and keeps changed or new ones
    Given a live tree with "a.html", "x.css" and "y.css"
    And a preview tree with the preview "a.html", the same "x.css", a changed "y.css" and a new "new.html"
    When the share plan is made for "s1"
    Then the shared files are "a.html" and "x.css"
    And 2 files are kept

  @test:scripts/tests/sdlc/staging-share.test.ts::the_fallback::the_worker_marks_a_live_page_as_the_preview's
  Scenario: The fallback worker marks a live page as the preview's
    When the worker source is generated for search state "published"
    Then it embeds the staging banner fragment
    And it sets SEARCH to "published"
    # Gap: the worker is only checked as source text; it is not run against a page.

  @test:scripts/tests/sdlc/staging-share.test.ts::the_fallback::the_root_404_names_no_preview
  Scenario: The root 404 page names no preview
    Given the root not-found page
    Then it contains no "STAGING/<slug>/" path
    And it references "staging-sw.js"
