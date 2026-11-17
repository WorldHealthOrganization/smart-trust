# scripts/publish-check.ts judges a publish by which files moved and which of those the
# instance's own git ignores, beyond the writer merely exiting 0.
# Each Scenario names the test that executes it.
Feature: Publish check: moved and ignored files

  @test:scripts/tests/sdlc/publish-check.test.ts::moved::a_changed,_an_added_and_a_removed_file_all_moved;_an_unchanged_one_did_not
  Scenario: Changed, added and removed files all moved; unchanged ones did not
    Given a before snapshot a=1, b=2, c=3 and an after snapshot a=1, b=X, d=4
    When the moved files are computed
    Then they are "b", "c" and "d"

  @test:scripts/tests/sdlc/publish-check.test.ts::snapshot_+_ignoredBy,_over_a_real_tree::node_modules_is_never_content
  Scenario: node_modules is never content
    Given an instance with a .gitignore, docs files and a file under node_modules
    When the instance is snapshotted
    Then the snapshot holds only inst/.gitignore, inst/docs/gen/page.html and inst/docs/own.svg

  @test:scripts/tests/sdlc/publish-check.test.ts::snapshot_+_ignoredBy,_over_a_real_tree::the_INSTANCE's_own_.gitignore_decides,_nested_ones_included
  Scenario: The instance's own .gitignore files decide what is ignored, nested ones included
    Given an instance whose .gitignore ignores /docs/gen/ and whose test/.gitignore ignores /results/
    When the generated page, an own svg and a test result are checked
    Then the generated page and the test result are ignored
    And the own svg is not

  @test:scripts/tests/sdlc/publish-check.test.ts::snapshot_+_ignoredBy,_over_a_real_tree::an_index_that_ignores_the_whole_mount_does_NOT_make_the_mount's_committed_files_ignored
  Scenario: A root ignore of the whole mount does not make the mount's committed files ignored
    Given the enclosing checkout's .gitignore ignores "/inst/"
    When the instance's own svg is checked
    Then it is not ignored

  @test:scripts/tests/sdlc/publish-check.test.ts::snapshot_+_ignoredBy,_over_a_real_tree::no_paths_asks_git_nothing
  Scenario: No paths asks git nothing
    Given an instance
    When an empty path list is checked for ignores
    Then the ignored set is empty

  @test:scripts/tests/sdlc/publish-check.test.ts::snapshot_+_ignoredBy,_over_a_real_tree::top-level_build_output_directories_(_kg,_build,__site,_dist)_are_skipped_when_the_root_itself_is_an_instance,_while_sub-instance__kg_is_kept
  Scenario: Top-level build output is skipped when the root is an instance, while a sub-instance _kg is kept
    # Gap: only _kg and build are exercised at the top level, not _site or dist
    Given a content root holding dpi-h-ra.json, _kg/cat-harness, build/plantuml and bootstrap/_kg
    When the root and its bootstrap sub-instance are snapshotted
    Then the snapshot holds only "bootstrap/_kg/bootstrap.jsonld" and "dpi-h-ra.json"
