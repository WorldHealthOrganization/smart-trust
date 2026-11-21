# Specifies scripts/gates.ts held against the checkout's real CI workflows:
# loadGates and its --all set, the fast/browser split, the cross-check of a
# loose scan against the stated buckets, step and script exemptions, the one
# unresolved command, and declared writers.
Feature: The local gate set is derived from the real workflows and accounts for every step

  @test:test/coordinator/gates-workflows.test.ts::the_gates_come_from_the_workflow,_not_from_a_list::the_real_workflow_yields_a_substantial_set
  Scenario: The real workflow yields more than ten gates
    Given the checkout's gates workflow
    When its gates are loaded
    Then there are more than 10

  @test:test/coordinator/gates-workflows.test.ts::the_gates_come_from_the_workflow,_not_from_a_list::it_finds_more_than_a_person_hand-lists_—_the_defect_that_prompted_it
  Scenario: The real workflow yields more than twenty gates
    Given the checkout's gates workflow
    When its gates are loaded
    Then there are more than 20

  @test:test/coordinator/gates-workflows.test.ts::the_gates_come_from_the_workflow,_not_from_a_list::`--all`_is_a_superset_of_the_fast_set,_and_strictly_larger
  Scenario: The --all set contains the fast set and is larger
    Given the fast gates and the --all gates of the checkout
    When their commands are compared
    Then every fast command is in the --all set
    And the --all set has more commands

  @test:test/coordinator/gates-workflows.test.ts::the_gates_come_from_the_workflow,_not_from_a_list::the_browser-only_gate_is_in_`--all`_and_NOT_in_the_fast_set
  Scenario: The browser-only render:bpmn:check gate is in --all and not in the fast set
    Given the fast gates and the --all gates of the checkout
    When they are searched for "render:bpmn:check"
    Then some --all command includes it
    And no fast command includes it

  @test:test/coordinator/gates-workflows.test.ts::the_gates_come_from_the_workflow,_not_from_a_list::every_extracted_command_is_a_bun_invocation,_in_workflow_order
  Scenario: Every gate is a bun invocation, and bun test comes before the KG audit
    Given the --all gates of the checkout, in workflow order
    When their commands are read
    Then every command starts with "bun " or "bunx "
    And a "bun test" command is present and comes before "bun run cat kg:audit:check"

  @test:test/coordinator/gates-workflows.test.ts::the_gates_come_from_the_workflow,_not_from_a_list::each_gate_carries_the_step_name_the_Actions_UI_shows
  Scenario: A gate carries the step name and job the Actions UI shows
    Given the fast gates of the checkout
    When the gate "bun run cat ns:check" is found
    Then its step is "namespace vocabulary is complete"
    And its job is "gates-docs"

  @test:test/coordinator/gates-workflows.test.ts::the_gates_come_from_the_workflow,_not_from_a_list::every_browser-free_job_contributes,_so_a_split_cannot_silently_shrink_the_set
  Scenario: Every browser-free job that carries commands contributes to the fast set
    Given the fast gates of the checkout
    When their jobs are collected
    Then they include typescript-static, typescript-test, gates-kg, gates-docs, gates-standalone and gates-unrun
    And they do not include e2e-shard
    And there are more than 100 fast gates

  @test:test/coordinator/gates-workflows.test.ts::the_gates_come_from_the_workflow,_not_from_a_list::a_job_is_in_the_fast_set_exactly_when_it_installs_no_browser_—_asked_of_the_job,_never_of_its_name
  Scenario: A job is in the fast set exactly when it installs no browser
    Given the jobs of the gates workflow, and which of them install a browser
    When the jobs of the fast and --all gates are compared
    Then e2e-shard installs a browser
    And typescript-test is in the --all set
    And every job of this workflow in the --all set is fast exactly when it installs no browser

  @test:test/coordinator/gates-workflows.test.ts::the_workflow_this_reads_is_the_one_CI_runs::the_declared_path_exists_and_is_a_real_workflow
  Scenario: The declared gates workflow is the real code-quality workflow
    Given the file at the declared gates workflow path
    When it is read
    Then it contains "name: Code-quality gates"
    And it declares a pull_request trigger

  @test:test/coordinator/gates-workflows.test.ts::a_strict_reader_and_a_loose_one_agree::no_`bun`_line_in_the_workflow_is_silently_dropped
  Scenario: No bun line in the workflow is silently dropped
    Given every non-comment "bun" or "bunx" line in the gates workflow, by a loose scan
    And the stated buckets: gates, unresolved gates, precondition steps and writer steps, all with --all
    When the strict reader's commands outside those buckets are taken as the published ones
    Then every published command is a named publisher or producer step
    And every loosely scanned line is in a bucket or published
    And the loose scan found more than 30 lines

  @test:test/coordinator/gates-workflows.test.ts::every_workflow_step_is_accounted_for::the_foreign-step_reader_finds_steps_—_an_empty_read_is_not_a_clean_one
  Scenario: The reader of other workflows' steps finds steps
    Given the checkout
    When the steps of the other workflows are read
    Then there are more than 20

  @test:test/coordinator/gates-workflows.test.ts::every_workflow_step_is_accounted_for::no_step_CI_runs_is_unclassified
  Scenario: No step CI runs is unclassified
    Given the checkout
    When the unclassified workflow steps are listed
    Then there are none

  @test:test/coordinator/gates-workflows.test.ts::every_workflow_step_is_accounted_for::every_exemption_still_matches_something_CI_runs
  Scenario: Every step exemption still matches a step CI runs
    Given the step exemptions and the commands of the other workflows' steps
    When each exemption is matched against the commands
    Then every exemption matches at least one

  @test:test/coordinator/gates-workflows.test.ts::every_check_script_is_accounted_for_—_the_direction_nothing_asked::no_check_script_is_unrun
  Scenario: No check script is unrun
    Given the checkout
    When the unrun check scripts are listed
    Then there are none

  @test:test/coordinator/gates-workflows.test.ts::every_check_script_is_accounted_for_—_the_direction_nothing_asked::the_commands_read_from_CI_are_non-empty_—_the_same_vacuity_trap
  Scenario: The commands read from CI are non-empty
    Given the checkout
    When the commands CI runs are read
    Then there are more than 20

  @test:test/coordinator/gates-workflows.test.ts::every_check_script_is_accounted_for_—_the_direction_nothing_asked::every_script_exemption_still_names_a_script_that_EXISTS
  Scenario: Every script exemption names a script that exists
    Given the script exemptions and the checkout's check script names
    When each exemption's script is looked up
    Then every one exists

  @test:test/coordinator/gates-workflows.test.ts::a_command_whose_shell_variable_this_reader_discarded_is_NOT_a_gate::the_real_workflow_carries_exactly_one,_and_it_is_that_one
  Scenario: The workflow has exactly one unresolved command, the catalogue check
    Given the real gates workflow
    When its unresolved gates are read with --all, skipping publishers
    Then there is exactly one
    And its command contains "translation:catalogue:check"

  @test:test/coordinator/gates-workflows.test.ts::a_declared_writer_in_the_gates_workflow_runs_after_the_gates,_never_among_them::every_line_whose_script_declares_`@covers_none_—_writer`_is_a_writer_step,_not_a_gate
  Scenario: A line whose script is a declared writer is a writer step and not a gate
    Given every bun line the gates workflow carries, with --all
    When those whose script declares itself a writer are taken
    Then each is among the writer steps
    And none is among the gates

  @test:test/coordinator/gates-workflows.test.ts::the_gates_come_from_the_workflow,_not_from_a_list::the_shared_Chromium_installer_counts_as_installing_a_browser
  Scenario: The shared Chromium installer counts as installing a browser
    Given a job with a single run step
    Then "npx playwright install --with-deps chromium" counts as installing a browser
    And running the shared "playwright-chromium/install.sh" script counts as installing a browser
    And "bun run cat gates" does not
