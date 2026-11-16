# roots.ts names the roots a file in this layer can mean. A wrong harness root
# reads as an empty corpus, so resolution order and refusals are pinned.
# Each Scenario names the test that executes it.
Feature: Resolving the harness, repository and working-instance roots

  @test:scripts/tests/roots.test.ts::the_constants,_in_this_checkout::TOOLS_ROOT_is_this_layer,_HARNESS_ROOT_its_declared_sibling,_REPO_ROOT_the_checkout
  Scenario: The root constants in this checkout
    Then TOOLS_ROOT is this layer's directory, ending in cat-harness-tools
    And HARNESS_ROOT is its sibling cat-harness and is a harness root
    And REPO_ROOT is TOOLS_ROOT's parent

  @test:scripts/tests/roots.test.ts::resolution_order:_--harness,_then_$CAT_HARNESS_ROOT,_then_the_declared_sibling::the_flag_wins_over_the_environment_and_the_sibling
  Scenario: The --harness flag wins
    Given --harness, $CAT_HARNESS_ROOT and a sibling harness each naming a different checkout
    When the harness root is resolved
    Then it is the flag's harness, with source "flag"

  @test:scripts/tests/roots.test.ts::resolution_order:_--harness,_then_$CAT_HARNESS_ROOT,_then_the_declared_sibling::--harness=<dir>_is_the_same_flag
  Scenario: --harness=<dir> is the same flag
    When the harness root is resolved from "--harness=<dir>"
    Then it is that directory

  @test:scripts/tests/roots.test.ts::resolution_order:_--harness,_then_$CAT_HARNESS_ROOT,_then_the_declared_sibling::the_environment_wins_over_the_sibling
  Scenario: The environment wins over the sibling
    Given $CAT_HARNESS_ROOT and a sibling harness and no flag
    When the harness root is resolved
    Then it is the environment's harness, with source "env"

  @test:scripts/tests/roots.test.ts::resolution_order:_--harness,_then_$CAT_HARNESS_ROOT,_then_the_declared_sibling::with_neither,_the_sibling
  Scenario: With no flag or environment the sibling is used
    When the harness root is resolved with neither
    Then it is the sibling harness, with source "sibling"

  @test:scripts/tests/roots.test.ts::resolution_order:_--harness,_then_$CAT_HARNESS_ROOT,_then_the_declared_sibling::an_empty_$CAT_HARNESS_ROOT_is_absent,_not_the_current_directory
  Scenario: An empty $CAT_HARNESS_ROOT is absent
    When the harness root is resolved with CAT_HARNESS_ROOT set to ""
    Then the source is "sibling"

  @test:scripts/tests/roots.test.ts::refusals_—_a_wrong_root_reads_as_an_empty_corpus,_so_it_must_throw_instead::a_sibling_with_the_right_directory_name_but_another_declared_name_is_not_the_harness
  Scenario: A sibling declaring another name is not the harness
    Given a sibling cat-harness directory declaring the name "something-else"
    Then it is not a harness root
    And resolving the harness root throws "cannot find the harness"

  @test:scripts/tests/roots.test.ts::refusals_—_a_wrong_root_reads_as_an_empty_corpus,_so_it_must_throw_instead::an_explicit_root_that_is_not_the_harness_throws_rather_than_falling_through
  Scenario: An explicit root that is not the harness throws
    Given a valid sibling harness and an empty directory
    Then naming the empty directory with --harness throws "--harness names"
    And naming it with $CAT_HARNESS_ROOT throws "$CAT_HARNESS_ROOT names"

  @test:scripts/tests/roots.test.ts::refusals_—_a_wrong_root_reads_as_an_empty_corpus,_so_it_must_throw_instead::an_unparseable_declaration_is_not_the_harness
  Scenario: An unparseable declaration is not the harness
    Given a cat-harness directory whose declaration is not valid JSON
    Then it is not a harness root

  @test:scripts/tests/roots.test.ts::REPO_ROOT_is_absent_when_this_layer_is_standalone::a_sibling_harness_gives_the_common_parent
  Scenario: A sibling harness gives the common parent as repository root
    Given tools and harness side by side in one checkout
    Then the repository root is that checkout

  @test:scripts/tests/roots.test.ts::REPO_ROOT_is_absent_when_this_layer_is_standalone::a_harness_elsewhere_gives_undefined,_not_a_plausible_wrong_path
  Scenario: A harness elsewhere gives no repository root
    Given tools in one checkout and the harness in another
    Then the repository root is undefined

  @test:scripts/tests/roots.test.ts::harnessFlag::the_last_flag_wins,_and_an_empty_value_is_absent
  Scenario: The last --harness flag wins and an empty value is absent
    Then "--harness /a --harness=/b" gives "/b"
    And "--harness=" and a bare "--harness" give nothing
    And "--harnessy /a" is not the flag

  @test:scripts/tests/roots.test.ts::resolveWorkingInstanceRoot:_the_instance_worked_on,_not_the_one_loaded_from::a_harness_MOUNTED_in_a_separated_instance's_checkout_resolves_to_that_instance
  Scenario: A harness mounted in a separated instance's checkout resolves to that instance
    Given a repository with .git declaring "who-iris" and mounting the harness
    Then the mounting instance root is that repository
    And the working instance root is that repository, with source "mount"

  @test:scripts/tests/roots.test.ts::resolveWorkingInstanceRoot:_the_instance_worked_on,_not_the_one_loaded_from::the_declared_name_decides,_never_the_folder:_a_clone_named_`wim/`_is_still_who-iris
  Scenario: The declared name decides, not the folder
    Given a clone in a folder named "wim" declaring "who-iris"
    Then its declared instance name is "who-iris"

  @test:scripts/tests/roots.test.ts::resolveWorkingInstanceRoot:_the_instance_worked_on,_not_the_one_loaded_from::the_harness_in_its_own_repository_is_the_harness
  Scenario: A harness in its own repository is the working instance
    Given the harness directory holds its own .git
    Then the working instance root is the harness, with source "harness"

  @test:scripts/tests/roots.test.ts::resolveWorkingInstanceRoot:_the_instance_worked_on,_not_the_one_loaded_from::an_index_checkout_whose_root_declares_nothing_keeps_the_harness
  Scenario: An index checkout that declares nothing keeps the harness
    Given a checkout root with .git, an index.config.json and a package.json but no declaration
    Then its declared instance name is undefined
    And the working instance source is "harness"

  @test:scripts/tests/roots.test.ts::resolveWorkingInstanceRoot:_the_instance_worked_on,_not_the_one_loaded_from::no_`.git`_anywhere_keeps_the_harness
  Scenario: With no .git anywhere the harness is kept
    Given a checkout root declaring who-iris but with no .git
    Then the working instance source is "harness"

  @test:scripts/tests/roots.test.ts::resolveWorkingInstanceRoot:_the_instance_worked_on,_not_the_one_loaded_from::--instance_wins_over_the_environment_and_the_mount;_a_declaration-less_root_throws
  Scenario: --instance wins and a declaration-less root throws
    Given two separated instances
    Then --instance wins over CAT_INSTANCE_ROOT and the mount, with source "flag"
    And CAT_INSTANCE_ROOT wins over the mount, with source "env"
    And --instance naming a directory with no declaration throws "--instance names"
    And CAT_INSTANCE_ROOT naming it throws "$CAT_INSTANCE_ROOT names"

  @test:scripts/tests/roots.test.ts::resolveWorkingInstanceRoot:_the_instance_worked_on,_not_the_one_loaded_from::instanceFlag:_the_last_flag_wins,_and_an_empty_value_is_absent
  Scenario: The last --instance flag wins and an empty value is absent
    Then "--instance /a --instance=/b" gives "/b"
    And "--instance=" gives nothing

  @test:scripts/tests/roots.test.ts::resolveWorkingInstanceRoot:_the_instance_worked_on,_not_the_one_loaded_from::runnerRootFor:_the_checkout_holding_both_layers,_else_the_harness's_parent
  Scenario: The runner root is the checkout holding both layers, else the harness's parent
    # Gap: the fixture's checkout IS the harness's parent, so both calls return the same directory and the two branches are not told apart.
    Given a separated checkout holding the harness and tools
    Then the runner root with the repository root given is the checkout
    And the runner root with no repository root is also the checkout
