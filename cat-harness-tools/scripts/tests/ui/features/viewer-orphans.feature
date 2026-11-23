# scripts/gen-schema-viz.ts finds viewer subject pages that answer to no declaration: one it
# wrote for a subject no longer wanted is an owned orphan, anything else is foreign and kept.
# Each Scenario names the test that executes it.
Feature: Orphaned viewer subject pages

  @test:scripts/tests/ui/viewer-orphans.test.ts::orphanSubjectPages::a_wanted_subject_is_never_an_orphan
  Scenario: A wanted subject is never an orphan
    Given a subject page "who-iris" that declares itself for "who-iris"
    When orphans are sought with "who-iris" wanted
    Then there are no owned and no foreign pages

  @test:scripts/tests/ui/viewer-orphans.test.ts::orphanSubjectPages::the_ankg_case:_a_renamed_subject_leaves_its_old_page_behind,_and_it_is_found
  Scenario: A renamed subject's old page is found as an owned orphan
    Given subject pages "folio-assist-sci" and "folio-assistant-sci", each declaring itself
    When orphans are sought with only "folio-assistant-sci" wanted
    Then the owned orphans are "folio-assist-sci"
    And there are no foreign pages

  @test:scripts/tests/ui/viewer-orphans.test.ts::orphanSubjectPages::a_hand-authored_page_is_FOREIGN_—_reported,_never_pruned
  Scenario: A hand-authored page is foreign, reported and never pruned
    Given a directory "hand-authored" whose index.html is not a viewer page
    When orphans are sought with nothing wanted
    Then "hand-authored" is foreign and nothing is owned

  @test:scripts/tests/ui/viewer-orphans.test.ts::orphanSubjectPages::a_page_whose_SCOPE_names_a_DIFFERENT_subject_is_foreign,_not_owned
  Scenario: A page whose scope names a different subject is foreign
    Given a subject page "who-iris" that declares itself for "something-else"
    When orphans are sought with nothing wanted
    Then nothing is owned and "who-iris" is foreign

  @test:scripts/tests/ui/viewer-orphans.test.ts::orphanSubjectPages::a_directory_with_no_index.html_is_foreign
  Scenario: A directory with no index.html is foreign
    Given an empty directory "empty"
    When orphans are sought with nothing wanted
    Then "empty" is foreign and nothing is owned

  @test:scripts/tests/ui/viewer-orphans.test.ts::orphanSubjectPages::files_beside_the_subject_directories_are_ignored
  Scenario: Files beside the subject directories are ignored
    Given the parent holds a viewer index.html and a ".nojekyll" file but no directories
    When orphans are sought with nothing wanted
    Then there are no owned and no foreign pages

  @test:scripts/tests/ui/viewer-orphans.test.ts::orphanSubjectPages::a_missing_parent_directory_is_not_an_error
  Scenario: A missing parent directory is not an error
    Given a parent directory that was never written
    When orphans are sought
    Then there are no owned and no foreign pages

  @test:scripts/tests/ui/viewer-orphans.test.ts::the_committed_tree_carries_no_orphan::this_instance_declares_a_name,_so_there_is_a_handler_segment_to_look_under
  Scenario: This instance declares a name to look under
    Given the cat-harness declaration
    Then it names a handler

  @test:scripts/tests/ui/viewer-orphans.test.ts::the_committed_tree_carries_no_orphan::%s::subject_pages_all_declare_themselves
  Scenario: Every committed subject page of a viewer declares itself
    # Skipped: when the site's subject pages for the kind are not built
    Given the "schemas" or "library" viewer's declared page route in the published site
    When its subject directories are listed
    Then the viewer has a declared route and at least one subject directory
    And each library page is a subject shell for its own directory
    And each schemas page carries "var SCOPE" naming its own directory
