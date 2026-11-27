# scripts/check-environment.ts refuses a checkout whose installs distort what the gates read: a nested install
# that shadows the root's at a different minor version and is imported beside it, or a symlinked root install.
# Each Scenario names the test that executes it.
Feature: The environment guard refuses a distorting install and spares a harmless one

  @test:scripts/tests/check-environment.test.ts::nestedNodeModules_—_the_walk,_bounded_and_excluding_the_root's_own::finds_a_nested_install_and_NEVER_reports_the_root_one
  Scenario: The walk finds a nested install and never the root one
    Given a fixture with a root install of "dep" 2.0.0 and a sub-package installing "dep" 1.0.0
    When nested installs are listed
    Then only "sub/node_modules" is found
    And the root's node_modules is not listed

  @test:scripts/tests/check-environment.test.ts::nestedNodeModules_—_the_walk,_bounded_and_excluding_the_root's_own::a_checkout_with_only_a_root_install_has_none
  Scenario: A checkout with only a root install has no nested installs
    Given a fixture with only a root install of "dep"
    When nested installs are listed
    Then none are found

  @test:scripts/tests/check-environment.test.ts::importsPackage_—_the_predicate_that_replaced_`any_nested_install`::true_when_a_source_beside_the_install_imports_it
  Scenario: A source beside the install that imports the package is detected
    Given a sub-package whose source.ts imports from "dep"
    When it is asked whether the sub-package imports "dep"
    Then the answer is yes

  @test:scripts/tests/check-environment.test.ts::importsPackage_—_the_predicate_that_replaced_`any_nested_install`::false_when_no_source_imports_it_—_this_is_what_spares_a_declared_sub-package
  Scenario: A sub-package whose sources do not import the package is not flagged
    Given a sub-package with a nested "dep" install whose source.ts imports nothing
    When it is asked whether the sub-package imports "dep"
    Then the answer is no

  @test:scripts/tests/check-environment.test.ts::importsPackage_—_the_predicate_that_replaced_`any_nested_install`::does_not_read_through_the_install's_OWN_node_modules
  Scenario: Imports inside the install's own node_modules are not counted
    Given a sub-package whose own sources do not import "dep"
    And a file inside "sub/node_modules/other" that imports "dep"
    When it is asked whether the sub-package imports "dep"
    Then the answer is no

  @test:scripts/tests/check-environment.test.ts::distortions_—_DISCRIMINATION,_which_is_the_whole_contract::a_shadowing_install_whose_sources_import_it_IS_a_distortion
  Scenario: A shadowing install that its sources import is a distortion
    Given a sub-package installing "dep" 1.0.0 over the root's 2.0.0 and importing it
    When distortions are listed
    Then there is one, at "sub/node_modules"
    And its effect names both "1.0.0" and "2.0.0"
    And it cites bean "3vc1"

  @test:scripts/tests/check-environment.test.ts::distortions_—_DISCRIMINATION,_which_is_the_whole_contract::a_shadowing_install_NOBODY_imports_is_NOT_a_distortion
  Scenario: A shadowing install that nobody imports is not a distortion
    Given a sub-package installing "dep" 1.0.0 over the root's 2.0.0 without importing it
    When distortions are listed
    Then there are none

  @test:scripts/tests/check-environment.test.ts::distortions_—_DISCRIMINATION,_which_is_the_whole_contract::an_install_at_the_SAME_version_is_not_a_distortion_even_when_imported
  Scenario: A nested install at the same version is not a distortion
    Given a sub-package installing and importing "dep" 2.0.0, the same as the root
    When distortions are listed
    Then there are none

  @test:scripts/tests/check-environment.test.ts::distortions_—_DISCRIMINATION,_which_is_the_whole_contract::a_PATCH-level_difference_is_NOT_a_distortion_—_the_measured_1.30.1_vs_1.30.0
  Scenario: A patch-level version difference is not a distortion
    Given a sub-package installing and importing "dep" 2.0.1 against the root's 2.0.0
    When distortions are listed
    Then there are none

  @test:scripts/tests/check-environment.test.ts::distortions_—_DISCRIMINATION,_which_is_the_whole_contract::a_MINOR-level_difference_IS_a_distortion_—_the_measured_1.28_vs_1.30
  Scenario: A minor-level version difference is a distortion
    Given a sub-package installing and importing "dep" 2.1.0 against the root's 2.0.0
    When distortions are listed
    Then there is one, whose effect names "2.1.0"

  @test:scripts/tests/check-environment.test.ts::distortions_—_DISCRIMINATION,_which_is_the_whole_contract::a_version_neither_side_can_parse_is_reported,_not_waved_through
  Scenario: An unparseable version is reported as a distortion
    Given a sub-package installing and importing "dep" at version "not-a-version"
    When distortions are listed
    Then there is one

  @test:scripts/tests/check-environment.test.ts::distortions_—_DISCRIMINATION,_which_is_the_whole_contract::a_SYMLINKED_root_install_is_a_distortion_on_its_own_—_`qook`
  Scenario: A symlinked root install is a distortion on its own
    Given a root whose node_modules is a symlink to another temporary directory
    When distortions are listed
    Then one cites bean "qook"
    And its effect mentions "SYMLINK"

  @test:scripts/tests/check-environment.test.ts::distortions_—_DISCRIMINATION,_which_is_the_whole_contract::a_SYMLINKED_root_install_pointing_into_the_checkout_that_owns_the_worktree_is_NOT_a_distortion_(bean_qook)
  Scenario: A worktree's install symlinked into its owning checkout is not a distortion
    Given a worktree whose .git file points at a fixture checkout's git directory
    And the worktree's node_modules symlinked to the checkout's node_modules
    When distortions are listed for the worktree
    Then none cites bean "qook"

  @test:scripts/tests/check-environment.test.ts::distortions_—_DISCRIMINATION,_which_is_the_whole_contract::the_same_worktree_with_its_install_symlinked_OUTSIDE_that_checkout_IS_a_distortion_(bean_qook)
  Scenario: A worktree's install symlinked outside its owning checkout is a distortion
    Given the same worktree with node_modules symlinked to an unrelated directory
    When distortions are listed for the worktree
    Then one cites bean "qook"

  @test:scripts/tests/check-environment.test.ts::this_repository,_right_now::is_not_distorted_—_otherwise_`bun_run_cat_gates`_refuses_for_everyone
  Scenario: This repository's checkout is not distorted
    When distortions are listed for the real repository
    Then there are none

  @test:scripts/tests/check-environment.test.ts::this_repository,_right_now::the_walk_runs_against_the_real_tree_and_returns_a_list,_whatever_it_holds
  Scenario: The nested install walk runs over the real tree
    When nested installs are listed for the real repository
    Then the result is a list
    And every entry ends in "node_modules"
