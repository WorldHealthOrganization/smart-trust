# publish:check calls a moved file committed only when the index could hold a
# committed copy: in a mount, only what the lock carries
# (folio-assistant#2781). Each Scenario names the test that executes it.
Feature: Files outside a mount's locked paths are not committed here

  Background:
    Given a repository whose index.lock.json lists instance "phw" with directory "phw/library", asset "README.md" and declaration "phw.json"

  @test:scripts/tests/publish-check-mounts.test.ts::outsideMounts::a_file_outside_every_locked_path_of_a_mount_is_not_committed_here
  Scenario: A file outside every locked path of a mount is outside the mount
    When the paths are filtered with outsideMounts
    Then "phw/test/results/library-qa/a.qa-results.json" is in the result

  @test:scripts/tests/publish-check-mounts.test.ts::outsideMounts::files_under_a_locked_directory,_asset_or_declaration_are
  Scenario: Files under a locked directory, asset or declaration are not outside
    When the paths are filtered with outsideMounts
    Then "phw/library/a/index.md", "phw/README.md" and "phw/phw.json" are not in the result

  @test:scripts/tests/publish-check-mounts.test.ts::outsideMounts::an_instance_the_lock_does_not_list_is_left_to_its_own_.gitignore
  Scenario: An instance the lock does not list is not excluded
    When the paths are filtered with outsideMounts
    Then "own/glossary/x.json" is not in the result

  @test:scripts/tests/publish-check-mounts.test.ts::outsideMounts::no_lock,_nothing_excluded
  Scenario: Without a lock nothing is excluded
    Given a directory with no index.lock.json
    When the same paths are filtered with outsideMounts there
    Then the result is empty
