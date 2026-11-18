# publishablePackages() in scripts/check-published-packages.ts finds every npm and PyPI
# package git tracks in this repository, and refuses when git cannot answer.
# Each Scenario names the test that executes it.
Feature: Publishable packages in both ecosystems

  @test:scripts/tests/sdlc/published-packages.test.ts::publishablePackages_—_what_this_repository_ships,_in_both_ecosystems::the_fixture_mechanism_really_produces_packages
  Scenario: The fixture mechanism yields at least one package
    Given a git fixture tracking pkg/package.json
    When publishable packages are discovered in it
    Then at least one package is found

  @test:scripts/tests/sdlc/published-packages.test.ts::publishablePackages_—_what_this_repository_ships,_in_both_ecosystems::an_npm_half_is_found,_with_its_declared_build_and_test_steps
  Scenario: An npm package is found with its declared build and test steps
    Given a git fixture tracking pkg/package.json named "@scope/thing" with build "tsup" and test "vitest run"
    When publishable packages are discovered in it
    Then exactly one package is found
    And it has dir "pkg", name "@scope/thing", ecosystem "npm", build "tsup" and test "vitest run"

  @test:scripts/tests/sdlc/published-packages.test.ts::publishablePackages_—_what_this_repository_ships,_in_both_ecosystems::a_PyPI_half_is_found,_and_declares_pytest_by_carrying_its_config_table
  Scenario: A PyPI package with a pytest config table declares pytest
    Given a git fixture tracking pkg/pyproject.toml named "thing" with a [tool.pytest.ini_options] table
    When publishable packages are discovered in it
    Then the first package has dir "pkg", name "thing", ecosystem "pypi" and test "pytest"

  @test:scripts/tests/sdlc/published-packages.test.ts::publishablePackages_—_what_this_repository_ships,_in_both_ecosystems::a_pyproject_with_no_pytest_table_declares_no_test_step_—_it_is_not_guessed
  Scenario: A pyproject without a pytest table gets no test step
    Given a git fixture tracking a bare pkg/pyproject.toml with only a [project] table
    When publishable packages are discovered in it
    Then the package's ecosystem is "pypi"
    And its test step is undefined

  @test:scripts/tests/sdlc/published-packages.test.ts::publishablePackages_—_what_this_repository_ships,_in_both_ecosystems::ONE_directory_shipping_to_both_registries_is_TWO_entries,_not_one
  Scenario: One directory shipping to both registries yields two entries
    Given a git fixture tracking both pkg/package.json and pkg/pyproject.toml
    When publishable packages are discovered in it
    Then two packages are found
    And their ecosystems are "npm" and "pypi"
    And both have dir "pkg"

  @test:scripts/tests/sdlc/published-packages.test.ts::publishablePackages_—_what_this_repository_ships,_in_both_ecosystems::the_repository's_own_root_package.json_is_not_a_published_package
  Scenario: The repository's root package.json is not a published package
    Given a git fixture tracking a root package.json and pkg/package.json
    When publishable packages are discovered in it
    Then the only package dir found is "pkg"

  @test:scripts/tests/sdlc/published-packages.test.ts::publishablePackages_—_what_this_repository_ships,_in_both_ecosystems::`private:_true`_is_excluded
  Scenario: A package.json marked private is excluded
    Given a git fixture tracking a/package.json with "private": true and a publishable b/package.json
    When publishable packages are discovered in it
    Then the only package dir found is "b"

  @test:scripts/tests/sdlc/published-packages.test.ts::publishablePackages_—_what_this_repository_ships,_in_both_ecosystems::a_`Private_::`_classifier_excludes_a_pyproject_—_PEP_621_has_no_`private`_flag
  Scenario: A pyproject with a "Private ::" classifier is excluded
    Given a git fixture tracking a/pyproject.toml with the classifier "Private :: Do Not Upload" and a publishable b/pyproject.toml
    When publishable packages are discovered in it
    Then the only package dir found is "b"

  @test:scripts/tests/sdlc/published-packages.test.ts::publishablePackages_—_what_this_repository_ships,_in_both_ecosystems::a_manifest_on_disk_but_NOT_in_the_index_is_invisible_—_the_`ramz`_rule
  Scenario: A manifest on disk but not in the git index is ignored
    Given a git fixture tracking pkg/package.json
    And untracked files node_modules/dep/package.json and vendored/.venv/lib/pyproject.toml on disk
    When publishable packages are discovered in it
    Then the only package dir found is "pkg"

  @test:scripts/tests/sdlc/published-packages.test.ts::publishablePackages_—_what_this_repository_ships,_in_both_ecosystems::an_unparseable_manifest_is_skipped_rather_than_crashing_the_sweep
  Scenario: An unparseable manifest is skipped without crashing
    Given a git fixture tracking an invalid bad/package.json, an invalid bad2/pyproject.toml and a valid ok/package.json
    When publishable packages are discovered in it
    Then the only package dir found is "ok"

  @test:scripts/tests/sdlc/published-packages.test.ts::publishablePackages_—_what_this_repository_ships,_in_both_ecosystems::a_manifest_with_no_name_is_not_a_package
  Scenario: A manifest with no name is not a package
    Given a git fixture tracking a/package.json with no name and a named b/package.json
    When publishable packages are discovered in it
    Then the only package dir found is "b"

  @test:scripts/tests/sdlc/published-packages.test.ts::publishablePackages_—_what_this_repository_ships,_in_both_ecosystems::this_repository's_own_corpus_—_the_real_block-qa-schema_has_both_halves
  Scenario: This repository's block-qa-schema is found in both ecosystems
    Given this repository's own git index
    When publishable packages are discovered with no root argument
    Then at least one package is found
    And the packages whose dir ends in "schemas/block-qa-schema" have ecosystems "npm" and "pypi"

  @test:scripts/tests/sdlc/published-packages.test.ts::git_could_not_answer_—_bean_`bnuy`::a_directory_that_is_not_a_repository_REFUSES_rather_than_reporting_no_packages
  Scenario: A directory that is not a git repository refuses instead of answering no packages
    Given a temp directory that is not a git repository, holding a publishable package.json
    When publishable packages are discovered in it
    Then a GitUnanswerable error is thrown

  @test:scripts/tests/sdlc/published-packages.test.ts::git_could_not_answer_—_bean_`bnuy`::the_refusal_names_the_pathspec_and_says_nothing_was_checked
  Scenario: The refusal names the pathspec and says nothing was checked
    Given a temp directory that is not a git repository
    When publishable packages are discovered in it
    Then a GitUnanswerable error is thrown
    And its pathspec is "*package.json"
    And its message contains "nothing was checked"
    And its reason from git is not empty

  @test:scripts/tests/sdlc/published-packages.test.ts::git_could_not_answer_—_bean_`bnuy`::a_repository_that_genuinely_publishes_nothing_still_answers_[]
  Scenario: A git repository that publishes nothing answers an empty list
    Given a git repository tracking only a README.md
    When publishable packages are discovered in it
    Then the result is an empty list
