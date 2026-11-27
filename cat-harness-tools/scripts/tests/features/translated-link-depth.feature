# A translated page sits one directory deeper than its source, and its relative
# links have to move with it (bean ahab). Each Scenario names the test that
# executes it.
Feature: Translated link depth

  @test:scripts/tests/translated-link-depth.test.ts::the_real_corpus::there_are_locales_to_report_on
  Scenario: The harness has locales
    When the harness's translated link depth is checked
    Then there is at least one locale

  @test:scripts/tests/translated-link-depth.test.ts::the_real_corpus::every_depth-sensitive_link_on_a_translated_page_resolves_at_its_own_depth
  Scenario: Every translated page's relative links resolve
    When the harness's translated link depth is checked
    Then there are no findings

  @test:scripts/tests/translated-link-depth.test.ts::the_real_corpus::the_check_is_DISCRIMINATING,_not_merely_passing_everything_through
  Scenario: Some links resolve only in the published tree
    When the harness's translated link depth is checked
    Then the published-only count is above zero

  @test:scripts/tests/translated-link-depth.test.ts::localeSegmentIndex_—_a_locale_directory_at_ANY_depth::at_the_top,_the_shape_the_first_version_handled
  Scenario: A top-level locale directory
    Then the locale segment of "fr/architecture.md" is at index 0

  @test:scripts/tests/translated-link-depth.test.ts::localeSegmentIndex_—_a_locale_directory_at_ANY_depth::NESTED,_the_shape_it_missed
  Scenario: A nested locale directory
    Then the locale segment of "guides/ar/agent-onboarding.md" is at index 1

  @test:scripts/tests/translated-link-depth.test.ts::localeSegmentIndex_—_a_locale_directory_at_ANY_depth::a_FILE_named_like_a_locale_is_not_a_locale_directory
  Scenario: A file named like a locale is not one
    Then "fr.md" and "guides/fr.md" have no locale segment

  @test:scripts/tests/translated-link-depth.test.ts::localeSegmentIndex_—_a_locale_directory_at_ANY_depth::no_locale_anywhere
  Scenario: No locale anywhere
    Then "guides/agent-onboarding.md" has no locale segment

  @test:scripts/tests/translated-link-depth.test.ts::depthSensitive_—_a_link_whose_meaning_does_not_depend_on_where_the_page_sits::a_relative_path_is
  Scenario: A relative path is depth-sensitive
    Then "reference/skills/x.html" and "../sdlc/skills/crdm/crdm-detect.md" are depth-sensitive

  @test:scripts/tests/translated-link-depth.test.ts::depthSensitive_—_a_link_whose_meaning_does_not_depend_on_where_the_page_sits::site-absolute,_fragment-only_and_external_are_NOT
  Scenario: Absolute, fragment, external and mailto links are not depth-sensitive
    Then "/folio-assistant/guides/", "#the-l3-pipeline", an https URL and a mailto link are not depth-sensitive

  @test:scripts/tests/translated-link-depth.test.ts::repair_—_the_two_ways_the_rewrite_was_wrong_before_it_was_right::a_link_carrying_a_#fragment_is_rewritten
  Scenario: A link with a fragment is repaired
    When a French page's link to "guides/who-smart-ig.html#the-l3-pipeline" is repaired for its target
    Then it becomes "../guides/who-smart-ig.html#the-l3-pipeline"

  @test:scripts/tests/translated-link-depth.test.ts::repair_—_the_two_ways_the_rewrite_was_wrong_before_it_was_right::a_longer_path_that_merely_STARTS_with_the_target_is_left_alone
  Scenario: A longer path starting with the target is left alone
    When "[x](a/b) [y](a/bc/d)" is repaired for "a/b"
    Then it becomes "[x](../a/b) [y](a/bc/d)"

  @test:scripts/tests/translated-link-depth.test.ts::repair_—_the_two_ways_the_rewrite_was_wrong_before_it_was_right::every_occurrence_is_rewritten,_not_the_first
  Scenario: Every occurrence is repaired
    When a page with two links to "r/x.html" is repaired
    Then both become "../r/x.html"

  @test:scripts/tests/translated-link-depth.test.ts::repair_—_the_two_ways_the_rewrite_was_wrong_before_it_was_right::a_link_that_is_not_a_finding_is_untouched
  Scenario: A link that is not a finding is untouched
    When "[keep](api/) [fix](r/x.html)" is repaired for "r/x.html"
    Then it becomes "[keep](api/) [fix](../r/x.html)"
