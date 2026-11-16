# scripts/compose-docs.ts withholds publish: "staging-only" visualisations from the
# canonical deploy, guarding against a withheld path that matches the whole tree;
# scripts/gen-fsh-guts-viz.ts renders the fsh-guts page. Each Scenario names the test that executes it.
Feature: Staging-only publishing

  @test:scripts/tests/sdlc/staging-only-publish.test.ts::the_real_declaration_withholds_fsh-guts_and_nothing_else::never_withholds_a_layer_root,_whatever_is_declared
  Scenario: The real declaration never withholds a layer root
    Given the repository's real visualiser declarations
    When the paths withheld from canonical are listed
    Then no withheld path is empty or "/"
    And every withheld path is longer than one character

  @test:scripts/tests/sdlc/staging-only-publish.test.ts::withheldPathFor_—_the_layer-root_guard,_reachable::an_index.*_at_the_LAYER_ROOT_withholds_only_itself
  Scenario: An index page at the layer root withholds only itself
    When the withheld path is computed for "index.md" and for "index.html"
    Then each is withheld as itself, not as its directory

  @test:scripts/tests/sdlc/staging-only-publish.test.ts::withheldPathFor_—_the_layer-root_guard,_reachable::an_index.*_in_a_subdirectory_withholds_that_directory
  Scenario: An index page in a subdirectory withholds that directory
    When the withheld path is computed for "fsh-guts/index.md" and "a/b/index.html"
    Then they withhold "fsh-guts/" and "a/b/"

  @test:scripts/tests/sdlc/staging-only-publish.test.ts::withheldPathFor_—_the_layer-root_guard,_reachable::a_non-index_page_withholds_only_itself,_at_any_depth
  Scenario: A non-index page withholds only itself at any depth
    When the withheld path is computed for "notes.md", "a/notes.md" and "a/index-of-things.md"
    Then each is withheld as itself

  @test:scripts/tests/sdlc/staging-only-publish.test.ts::withheldPathFor_—_the_layer-root_guard,_reachable::what_it_returns_can_never_match_the_whole_tree
  Scenario: A withheld path can never match the whole tree
    Given the page shapes "index.md", "index.html", "a/index.md", "notes.md" and "a/b/index.html"
    When the withheld path is computed for each
    Then none is empty or "/"
    And none withholds the unrelated page "some/other/page.md"

  @test:scripts/tests/sdlc/staging-only-publish.test.ts::isWithheld_distinguishes_a_file_from_a_directory_prefix::a_directory_entry_matches_everything_beneath_it
  Scenario: A directory entry withholds everything beneath it
    Given the withheld list "fsh-guts/"
    Then "fsh-guts/index.md" and "fsh-guts/assets/app.js" are withheld

  @test:scripts/tests/sdlc/staging-only-publish.test.ts::isWithheld_distinguishes_a_file_from_a_directory_prefix::a_directory_entry_does_not_match_a_sibling_with_a_shared_prefix
  Scenario: A directory entry does not withhold a sibling sharing its prefix
    Given the withheld list "fsh-guts/"
    Then "fsh-guts-notes.md" is not withheld

  @test:scripts/tests/sdlc/staging-only-publish.test.ts::isWithheld_distinguishes_a_file_from_a_directory_prefix::a_file_entry_matches_only_itself
  Scenario: A file entry withholds only that file
    Given the withheld list "a.md"
    Then "a.md" is withheld
    And "a.md.bak" and "sub/a.md" are not withheld

  @test:scripts/tests/sdlc/staging-only-publish.test.ts::isWithheld_distinguishes_a_file_from_a_directory_prefix::nothing_is_withheld_when_the_list_is_empty
  Scenario: Nothing is withheld by an empty list
    Given an empty withheld list
    Then "fsh-guts/index.md" is not withheld

  @test:scripts/tests/sdlc/staging-only-publish.test.ts::composing_honours_the_default,_which_is_the_restrictive_one::a_withheld_file_is_never_also_reported_as_supplied
  Scenario: A default compose never reports a withheld file as supplied
    # Gap: does not assert that the default compose withholds anything at all
    Given the repository composed into a temporary directory with no options
    When the compose report is read
    Then no withheld path has a supplier in the report

  @test:scripts/tests/sdlc/staging-only-publish.test.ts::the_fsh-guts_page_reports_the_declaration_gap_rather_than_hiding_it::classifies_every_file_into_exactly_one_of_the_three_states
  Scenario: Every fsh-guts file is classified into one of three states
    # Skipped: when the fsh-guts trashcan is not mounted (standing alone)
    Given the fsh-guts trashcan's files
    Then each file's state is "declared", "sidecar" or "undeclared"

  @test:scripts/tests/sdlc/staging-only-publish.test.ts::the_fsh-guts_page_reports_the_declaration_gap_rather_than_hiding_it::the_page_names_the_undeclared_count_rather_than_only_the_total
  Scenario: The fsh-guts page shows the undeclared count
    # Skipped: when the fsh-guts trashcan is not mounted (standing alone)
    Given the fsh-guts trashcan's files and the number that are undeclared
    When the page is rendered
    Then it contains a table cell holding that count
    And when the count is above zero it contains the word "undeclared"

  @test:scripts/tests/sdlc/staging-only-publish.test.ts::the_fsh-guts_page_reports_the_declaration_gap_rather_than_hiding_it::every_file_in_the_corpus_appears_on_the_page
  Scenario: Every fsh-guts file is named on the page
    # Skipped: when the fsh-guts trashcan is not mounted (standing alone)
    Given the fsh-guts trashcan's files
    When the page is rendered
    Then each file's name relative to its group appears on it

  @test:scripts/tests/sdlc/staging-only-publish.test.ts::the_fsh-guts_page_reports_the_declaration_gap_rather_than_hiding_it::the_page_says_it_is_not_published,_since_that_is_not_obvious_from_it
  Scenario: The fsh-guts page says it is not published
    # Skipped: when the fsh-guts trashcan is not mounted (standing alone)
    Given the fsh-guts trashcan's files
    When the page is rendered
    Then it contains "not on the published site"
