# The "site not built" guard in test/support/checkout.ts skips a test only when the run stands alone and a
# built file is absent, naming that file; in the composed checkout it never skips.
# Each Scenario names the test that executes it.
Feature: Site-not-built guard

  @test:test/site-not-built.test.ts::siteNotBuilt::standing_alone_with_the_file_absent,_it_skips_and_names_the_file
  Scenario: Standing alone with a built file absent, the guard skips and names the file
    Given a standalone run and an absent file "count.json"
    When siteNotBuiltWhen is asked about "the fixture projection"
    Then it answers skip
    And it warns once, mentioning "site not built", "the fixture projection" and "count.json"

  @test:test/site-not-built.test.ts::siteNotBuilt::standing_alone_with_the_file_PRESENT,_it_does_not_skip,_and_says_nothing
  Scenario: Standing alone with the built file present, the guard does not skip and is silent
    Given a standalone run and a present file "index.json"
    When siteNotBuiltWhen is asked
    Then it does not skip
    And it warns nothing

  @test:test/site-not-built.test.ts::siteNotBuilt::one_absent_file_of_several_is_enough,_and_only_that_one_is_named
  Scenario: One absent file among several makes the guard skip and only that file is named
    Given a standalone run with present "index.json" and absent "count.json"
    When siteNotBuiltWhen is asked
    Then it answers skip
    And its warning names "count.json" but not "index.json"

  @test:test/site-not-built.test.ts::siteNotBuilt::in_the_composed_checkout_it_never_skips,_absent_or_not_—_the_test_runs_and_fails_there
  Scenario: In the composed checkout the guard never skips
    Given a run that does not stand alone
    When siteNotBuiltWhen is asked about an absent file, and then about a present file
    Then neither answer skips
    And nothing is warned either time

  @test:test/site-not-built.test.ts::siteNotBuilt::a_guard_over_no_path_is_refused_rather_than_answering
  Scenario: A guard over an empty path list throws
    When siteNotBuiltWhen is asked with no paths
    Then it throws an error mentioning "no path"

  @test:test/site-not-built.test.ts::siteNotBuilt::the_exported_guard_is_the_one_above,_at_this_checkout's_own_layout
  Scenario: The exported siteNotBuilt follows this checkout's standalone flag
    When siteNotBuilt is asked about an absent file
    Then it answers the value of STANDALONE
    And asked about a present file it answers false
