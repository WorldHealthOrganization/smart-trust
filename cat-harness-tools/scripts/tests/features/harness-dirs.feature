# scripts/check-harness-dirs.ts checks that the bean graph declaration, .beans.yml and the workflow store agree on visible store paths,
# scripts/beans-fallback.ts works the bean plan without the beans CLI, and the harness config is found only by its instance's name.
# Each Scenario names the test that executes it.
Feature: The harness's work-plan and workflow stores

  @test:scripts/tests/harness-dirs.test.ts::the_two_stores_are_visible_and_agreed_upon::this_repo's_declaration,_.beans.yml_and_store.ts_all_say_the_same_thing
  Scenario: This repository's declaration, .beans.yml and store.ts agree
    Given this repository's root
    When checkHarnessDirs runs
    Then there are no problems
    And the .beans.yml path equals the declared work plan
    And the compiled workflow state equals the declared workflow state

  @test:scripts/tests/harness-dirs.test.ts::the_two_stores_are_visible_and_agreed_upon::neither_store_is_hidden_behind_a_dot_—_that_is_the_whole_point
  Scenario: Neither store is hidden behind a dot
    Given this repository's root
    When checkHarnessDirs runs
    Then neither the declared work plan nor the declared workflow state starts with "."
    And WORKFLOW_DIR is "beans/workflows"

  @test:scripts/tests/harness-dirs.test.ts::the_two_stores_are_visible_and_agreed_upon::the_work_plan_is_where_it_says_it_is,_and_is_not_empty
  Scenario: The work plan is at its declared path and holds beans
    Given this repository's root
    When checkHarnessDirs runs
    Then the declared work plan is "beans/defs"
    And the bean count is greater than 0

  @test:scripts/tests/harness-dirs.test.ts::the_two_stores_are_visible_and_agreed_upon::a_disagreement_is_a_failure,_not_a_shrug
  Scenario: A disagreement between the graph and .beans.yml is a problem
    Given a scratch store whose bean graph declares "defs" and whose .beans.yml path is "somewhere-else"
    When checkHarnessDirs runs
    Then a problem mentions "Work-plan path disagrees"

  @test:scripts/tests/harness-dirs.test.ts::the_two_stores_are_visible_and_agreed_upon::a_dot-prefixed_declaration_is_refused
  Scenario: A dot-prefixed declaration is refused
    Given a scratch store whose bean graph declares "defs" at ".defs" and whose .beans.yml path is "beans/.defs"
    When checkHarnessDirs runs
    Then a problem mentions "hidden behind a dot"

  @test:scripts/tests/harness-dirs.test.ts::the_two_stores_are_visible_and_agreed_upon::no_config_at_all_is_'not_configured',_never_a_failure
  Scenario: No config at all is not configured and not a failure
    Given a scratch store with only .beans.yml and "beans/defs"
    When checkHarnessDirs runs
    Then configured is false
    And there are no problems
    And the notes mention "default"

  @test:scripts/tests/harness-dirs.test.ts::the_two_stores_are_visible_and_agreed_upon::beansYmlPath_reads_the_key,_and_reports_absence_rather_than_guessing
  Scenario: beansYmlPath reads the key and reports absence
    When beansYmlPath reads this repository's root
    Then it is "beans/defs"
    And for the system temporary directory it is undefined

  @test:scripts/tests/harness-dirs.test.ts::the_fallback_can_work_the_plan,_not_just_read_it::it_honours_.beans.yml's_prefix_and_id_length
  Scenario: The fallback honours .beans.yml's prefix and id length
    Given a scratch store whose .beans.yml sets prefix "test-" and id length 4
    When readStoreConfig runs and a bean titled "First item" is created
    Then the config dir is "beans/defs" and the prefix "test-"
    And the bean id starts with "test-" followed by the configured id length of characters

  @test:scripts/tests/harness-dirs.test.ts::the_fallback_can_work_the_plan,_not_just_read_it::create,_claim,_update_and_note_all_round-trip_through_the_file
  Scenario: Create, claim, update and note round-trip through the file
    Given a scratch store
    When a bean "Round trip" is created with a body, set to "in-progress", and noted "found the cause"
    Then it is created with status "todo"
    And after the update its status is "in-progress" and its body still contains "A body."
    And after the note its body contains both "found the cause" and "A body.", with status still "in-progress"
    And the store lists one bean

  @test:scripts/tests/harness-dirs.test.ts::the_fallback_can_work_the_plan,_not_just_read_it::an_id_can_be_given_bare_or_fully_prefixed
  Scenario: An id can be given bare or fully prefixed
    Given a scratch store with a bean "Either way"
    When findBean is called with the full id and with the id without "test-"
    Then both find the same bean

  @test:scripts/tests/harness-dirs.test.ts::the_fallback_can_work_the_plan,_not_just_read_it::create_refuses_a_duplicate_title_and_points_at_the_existing_bean
  Scenario: Create refuses a duplicate title unless forced
    Given a scratch store with a bean "Only once"
    When a second bean "Only once" is created
    Then it reports duplicateOf and returns the first bean's id
    And the store still lists one bean
    And creating it again with force adds a second bean with no duplicateOf

  @test:scripts/tests/harness-dirs.test.ts::the_fallback_can_work_the_plan,_not_just_read_it::what_it_writes_parses_as_the_layout_the_CLI_expects
  Scenario: What the fallback writes has the layout the CLI expects
    Given a scratch store
    When a bean "Layout check" of type "bug" and status "in-progress" is created
    Then its file starts with "---"
    And it contains the id comment "# <id>" and the keys title, status, type, priority, created_at and updated_at
    And its file name ends with "<id>--layout-check.md"

  @test:scripts/tests/harness-dirs.test.ts::the_fallback_can_work_the_plan,_not_just_read_it::it_reads_this_repo's_real_store,_which_the_CLI_also_reads
  Scenario: The fallback reads this repository's real store
    When listBeans reads this repository's root
    Then it lists at least one bean
    And every id starts with "folio-assistant-"
    And no title is "(untitled)"

  @test:scripts/tests/harness-dirs.test.ts::the_config_name_—_`<instance>.config.json`,_and_only_that::the_config_is_found_by_the_name_its_INSTANCE_declares
  Scenario: The config is found by the name its instance declares
    Given a scratch store with an instance config written with contentType "document"
    When the harness config path is resolved and read
    Then the path ends with the instance's config name
    And the contentType is "document"

  @test:scripts/tests/harness-dirs.test.ts::the_config_name_—_`<instance>.config.json`,_and_only_that::a_directory_that_declares_NO_instance_has_no_config_name_to_look_for
  Scenario: A directory that declares no instance has no config to find
    Given a scratch store with no instance declaration and an "anything.config.json"
    When the harness config path is resolved and read
    Then the path is undefined
    And the config is null

  @test:scripts/tests/harness-dirs.test.ts::the_config_name_—_`<instance>.config.json`,_and_only_that::folio.config.json_is_NOT_read_—_the_old_name_is_dead,_not_deprecated
  Scenario: folio.config.json is not read
    Given a scratch store holding only "folio.config.json"
    When the harness config path is resolved and read
    Then the path is undefined
    And the config is null

  @test:scripts/tests/harness-dirs.test.ts::the_config_name_—_`<instance>.config.json`,_and_only_that::an_absent_config_is_`undefined`,_not_an_error_—_the_platform_has_none
  Scenario: An absent config is undefined, not an error
    Given a scratch store with no config
    When the harness config path is resolved and read
    Then the path is undefined
    And the config is null

  @test:scripts/tests/harness-dirs.test.ts::the_config_name_—_`<instance>.config.json`,_and_only_that::the_bean_graph,_not_the_harness_config,_is_what_declares_the_stores
  Scenario: The bean graph, not the harness config, declares the stores
    Given a scratch store whose bean graph declares "defs" and "workflows"
    And an instance config carrying legacy harness workPlan and workflowState values
    When checkHarnessDirs runs
    Then configured is true
    And the declared work plan is "beans/defs"
    And there are no problems

  @test:scripts/tests/harness-dirs.test.ts::the_config_name_—_`<instance>.config.json`,_and_only_that::no_graph_is_'not_configured'_and_uses_the_documented_default
  Scenario: No graph is not configured and uses the documented default
    Given a scratch store with no bean graph
    When checkHarnessDirs runs
    Then configured is false
    And there are no problems
    And the notes mention "default"

  @test:scripts/tests/harness-dirs.test.ts::the_config_name_—_`<instance>.config.json`,_and_only_that::a_graph_that_will_not_parse_FAILS_—_it_never_falls_back_to_defaults
  Scenario: A graph that will not parse is a problem
    Given a scratch store whose "beans/beans.json" is not valid JSON
    When checkHarnessDirs runs
    Then a problem mentions "will not parse"

  @test:scripts/tests/harness-dirs.test.ts::branch-mounted_beans_store::when_beans_is_on_a_branch_and_unmounted,_it_reports_the_unmounted_reason_rather_than_missing_directory
  Scenario: An unmounted branch-held beans store reports that it is not mounted
    Given a git repository declaring "beans" with a tip-keyed branch source and no mount
    When checkHarnessDirs runs
    Then a problem mentions "is on cat/cat-harness/beans and is not mounted"
    And no problem mentions "which does not exist"

  @test:scripts/tests/harness-dirs.test.ts::branch-mounted_beans_store::when_beans_is_on_a_branch_and_mounted,_it_checks_the_mount_and_passes
  Scenario: A mounted branch-held beans store is checked at the mount and passes
    Given a git repository declaring "beans" with a tip-keyed branch source
    And a mount at "<root>/mounted-beans" holding a bean graph with one bean in "defs"
    When checkHarnessDirs runs
    Then there are no problems
    And the bean count is 1
