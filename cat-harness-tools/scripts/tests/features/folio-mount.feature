# scripts/folio-mount.ts derives a page's site root in the browser from the instance's route pattern and ships that pattern in its fragment;
# scripts/html-comments.ts is the one HTML comment scanner it and scripts/staging-banner.ts share. Each Scenario names the test that executes it.
Feature: The folio mount derives its site root

  @test:scripts/tests/folio-mount.test.ts::the_site_root_is_derived,_not_baked::%s_->_%s
  Scenario: The site root is derived from each base the site is served under
    Given the who-iris route pattern
    When the site root of each page path is derived
    Then "/who-iris/community-list.html" and "/docs/who-iris/ingestion-notes.html" give "/"
    And "/folio-assistant/who-iris/item-x.html" and "/folio-assistant/docs/who-iris/catalogue.html" give "/folio-assistant/"
    And "/STAGING/claude-example/who-iris/item-x.html" and "/STAGING/claude-example/docs/who-iris/index.html" give "/STAGING/claude-example/"

  @test:scripts/tests/folio-mount.test.ts::the_site_root_is_derived,_not_baked::a_path_outside_the_instance_returns_null_rather_than_a_guess
  Scenario: A path outside the instance has no site root
    Given the who-iris route pattern
    When the site root of "/somewhere/else/page.html" is derived
    Then it is null

  @test:scripts/tests/folio-mount.test.ts::the_shipped_string_and_the_tested_function_are_ONE_expression::the_fragment_carries_the_pattern's_own_source
  Scenario: The fragment carries the route pattern's own source
    Given the who-iris route pattern
    When the mount fragment is built
    Then it contains the pattern's source as a JSON string

  @test:scripts/tests/folio-mount.test.ts::the_shipped_string_and_the_tested_function_are_ONE_expression::and_re-parsing_that_source_gives_back_the_same_derivation
  Scenario: Re-parsing the shipped pattern gives the same site roots
    Given the mount fragment built for the who-iris pattern
    When the RegExp source inside it is parsed back
    Then it yields the same site root as the original pattern for "/who-iris/a.html", "/docs/who-iris/b.html" and "/x/y.html"

  @test:scripts/tests/folio-mount.test.ts::the_shipped_string_and_the_tested_function_are_ONE_expression::the_fragment_is_CONSTANT_for_a_pattern_—_no_per-page_fact
  Scenario: The fragment is the same every time for one pattern
    Given the who-iris route pattern
    Then building the fragment twice gives the same string

  @test:scripts/tests/folio-mount.test.ts::`ur84`_cannot_come_back_through_a_second_comment_scanner::there_is_one_scanner,_and_`bodyInsertionPoint`_uses_it
  Scenario: The body insertion point skips a body tag inside a comment
    # Gap: that only one scanner exists is not checked; only the insertion point is
    Given HTML whose leading comment mentions "<body>" before the real body tag
    When the body insertion point is found
    Then the text after it is "hi"

  @test:scripts/tests/folio-mount.test.ts::`ur84`_cannot_come_back_through_a_second_comment_scanner::a_marker_inside_a_comment_is_NOT_a_mount
  Scenario: A mount marker inside a comment is not a mount
    Given an HTML page whose only mount marker sits inside a comment
    Then the page contains the marker
    And it is not reported as having a mount

  @test:scripts/tests/folio-mount.test.ts::`ur84`_cannot_come_back_through_a_second_comment_scanner::and_outside_one,_it_is
  Scenario: A mount fragment outside a comment is a mount
    Given an HTML page whose body holds the who-iris mount fragment
    Then it is reported as having a mount

  @test:scripts/tests/folio-mount.test.ts::`ur84`_cannot_come_back_through_a_second_comment_scanner::the_guard_is_built_once_and_answers_many_positions
  Scenario: The comment guard answers positions inside and outside comments
    # Gap: that the guard is built once rather than re-scanning is not measured
    Given the HTML "a<!--xx-->b<!--yy-->c"
    Then two comment ranges are found
    And the guard says positions 3, 9 and 12 are inside a comment
    And positions 0, 10 and 20 are not
