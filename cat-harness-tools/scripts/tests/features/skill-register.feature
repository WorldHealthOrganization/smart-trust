# skill-register makes adding a skill one command, and gates a skill that
# arrived without it (beans v625 and nfv3): the chain of write and verify
# steps, the declaration audit's finders (falsified on synthetic packages),
# the flags, the qa-results report, and which steps are deferred in a QA
# build or left to the gates in CI. Each Scenario names the test that
# executes it.
Feature: Registering a skill

  @test:scripts/tests/skill-register.test.ts::the_chain_is_not_empty
  Scenario: The registration chain is not empty
    Then the chain has at least one step

  @test:scripts/tests/skill-register.test.ts::every_step_resolves_to_something_runnable::`%s`,_verified_by_`%s`::its_write_step_exists
  Scenario: Each step's write command exists
    Given a step of the chain
    Then the head of its write arguments is a package.json script or a file

  @test:scripts/tests/skill-register.test.ts::every_step_resolves_to_something_runnable::`%s`,_verified_by_`%s`::its_verify_step_exists
  Scenario: Each step's verify command exists
    Given a step of the chain
    Then the head of its verify arguments is a package.json script or a file

  @test:scripts/tests/skill-register.test.ts::every_CHAIN_and_CHECKS_entry_is_a_package.json_script
  Scenario: Every chain and check entry is a package.json script
    Then the command's own missing-scripts guard finds none missing

  @test:scripts/tests/skill-register.test.ts::each_step_carries_a_reason,_so_the_list_can_be_re-derived_rather_than_trusted
  Scenario: Each step carries a reason
    Then every step's reason is longer than ten characters

  @test:scripts/tests/skill-register.test.ts::the_two_steps_`gates`_MASKS_are_still_in_the_chain
  Scenario: The two steps gates masks are still in the chain
    Then the chain holds "kg:audit" and "kg:detangle"

  @test:scripts/tests/skill-register.test.ts::the_four_that_adding_a_skill_does_NOT_stale_are_absent
  Scenario: The four generators adding a skill does not stale are absent
    Then no chain entry mentions gen-docs-pages, docs:harness, translation:index or state:visualizer

  @test:scripts/tests/skill-register.test.ts::no_step_verifies_itself_with_its_writer,_and_no_writer_repeats
  Scenario: No step verifies with its own writer, and no writer repeats
    Then there are as many checks as chain entries
    And no step's joined verify command equals its joined write command
    And the chain has no duplicate

  @test:scripts/tests/skill-register.test.ts::a_step's_arguments_are_a_non-empty_list,_and_its_head_is_what_runs
  Scenario: Every step's write and verify arguments are non-empty
    # Gap: only non-emptiness is asserted; that the head is what runs is checked by the per-step existence tests, not here
    Then every step has at least one write argument and one verify argument

  @test:scripts/tests/skill-register.test.ts::front_matter_is_read,_not_grepped::top-level_keys_only
  Scenario: Front matter keys are read
    Given a skill file whose front matter holds name and roles
    Then its front matter keys are name and roles

  @test:scripts/tests/skill-register.test.ts::front_matter_is_read,_not_grepped::a_file_with_no_front_matter_has_no_keys,_and_does_not_throw
  Scenario: A file with no front matter has no keys
    Then a file with only a heading, and an empty file, each have no front matter keys

  @test:scripts/tests/skill-register.test.ts::front_matter_is_read,_not_grepped::an_indented_`roles:`_under_another_key_is_not_a_top-level_roles
  Scenario: An indented roles under another key is not a top-level key
    Given front matter with name, and roles indented under tags
    Then its keys are name and tags

  @test:scripts/tests/skill-register.test.ts::withoutKey::removes_the_key_and_leaves_the_rest_intact
  Scenario: Removing a key leaves the rest intact
    Given a skill file whose front matter holds name and roles
    When roles is removed
    Then the only key is name, the body heading is kept, and "roles" appears nowhere

  @test:scripts/tests/skill-register.test.ts::withoutKey::removes_a_block_value's_continuation_lines_too
  Scenario: Removing a key removes its block value's continuation lines
    Given front matter with name, roles as a block list of reader and owner, and description
    When roles is removed
    Then the keys are name and description, the description is kept, and "reader" appears nowhere

  @test:scripts/tests/skill-register.test.ts::withoutKey::a_file_without_the_key_is_returned_unchanged
  Scenario: Removing an absent key returns the file unchanged
    Given a skill file with no roles key
    When roles is removed
    Then the file is unchanged

  @test:scripts/tests/skill-register.test.ts::the_finders_discriminate_—_falsified_on_a_synthetic_package::an_unlisted_skill_is_found,_and_a_listed_one_is_not
  Scenario: An unlisted skill is found and a listed one is not
    Given a package whose manifest lists "listed" and which holds listed.md and missing.md
    Then the only unlisted skill is "missing"

  @test:scripts/tests/skill-register.test.ts::the_finders_discriminate_—_falsified_on_a_synthetic_package::a_retired_key_is_found,_and_a_clean_file_is_not
  Scenario: A retired key is found and a clean file is not
    Given a package with skill a carrying roles and skill b without
    Then the only retired key found is a:roles

  @test:scripts/tests/skill-register.test.ts::the_finders_discriminate_—_falsified_on_a_synthetic_package::a_manifest_entry_with_no_file_is_found_—_the_direction_breaking_the_tool_revealed
  Scenario: A manifest entry with no file is found as dangling
    Given a package whose manifest lists "real" and "ghost" and which holds only real.md
    Then the only dangling skill is "ghost"
    And no skill is unlisted

  @test:scripts/tests/skill-register.test.ts::the_finders_discriminate_—_falsified_on_a_synthetic_package::a_correct_package_yields_nothing_from_any_finder
  Scenario: A correct package yields nothing from any finder
    Given a package listing "a" and holding a.md with no retired key
    Then nothing is unlisted, retired or dangling

  @test:scripts/tests/skill-register.test.ts::the_finders_discriminate_—_falsified_on_a_synthetic_package::a_directory_with_no_manifest_is_not_a_package
  Scenario: A skills directory with no manifest is not a package
    Given a skills/nope directory holding a skill file and no manifest
    Then no package is found

  @test:scripts/tests/skill-register.test.ts::the_finders_discriminate_—_falsified_on_a_synthetic_package::no_skills/_directory_yields_no_packages_rather_than_throwing
  Scenario: No skills directory yields no packages
    Given an instance with no skills/ directory
    Then no package is found, without throwing

  @test:scripts/tests/skill-register.test.ts::an_instance_with_no_skills_directory_is_not_applicable,_not_the_third_state::a_content_instance_that_declares_only_a_library:_nothing_to_judge,_and_it_says_why
  Scenario: An instance declaring only a library is not applicable, and says why
    Given an instance declaration whose only directory is a library
    Then it is not applicable because it "declares no `skills` directory"

  @test:scripts/tests/skill-register.test.ts::an_instance_with_no_skills_directory_is_not_applicable,_not_the_third_state::an_IG_that_declares_only_scenarios_(its_journeys'_actors):_no_skill_to_register,_not_the_third_state
  Scenario: An instance declaring only scenarios is not applicable
    Given an instance declaration whose only directory is scenarios
    Then it is not applicable because it "declares no `skills` directory"

  @test:scripts/tests/skill-register.test.ts::an_instance_with_no_skills_directory_is_not_applicable,_not_the_third_state::a_declared_knowledge-graph_directory_that_is_MISSING_stays_the_third_state_(dh4f)
  Scenario: A declared skills directory that is missing on disk is not "not applicable"
    Given an instance declaration with a skills directory that does not exist
    Then it is not marked not applicable

  @test:scripts/tests/skill-register.test.ts::an_instance_with_no_skills_directory_is_not_applicable,_not_the_third_state::the_harness_itself_is_never_not-applicable
  Scenario: The harness itself is never not applicable
    Then cat-harness is not marked not applicable

  @test:scripts/tests/skill-register.test.ts::the_real_corpus::every_skill_is_declared,_none_carries_a_retired_key,_nothing_dangles
  Scenario: The real corpus is fully declared
    When the declaration audit runs over the real tree
    Then nothing is unlisted, retired or dangling

  @test:scripts/tests/skill-register.test.ts::the_real_corpus::it_found_packages_and_skills_—_otherwise_the_check_above_proves_nothing
  Scenario: The real corpus audit is not vacuous
    When the declaration audit runs over the real tree
    Then it finds more than 3 packages and more than 50 skills

  @test:scripts/tests/skill-register.test.ts::flags::every_flag_is_off_by_default,_so_a_bare_run_regenerates_and_reports
  Scenario: Every flag is off by default
    When no arguments are parsed
    Then check, dry-run, json, no-report and declarations-only are all off

  @test:scripts/tests/skill-register.test.ts::flags::each_flag_is_recognised_on_its_own
  Scenario: Each flag is recognised on its own
    Then --check, --dry-run, --json, --no-report and --declarations-only each set their own flag

  @test:scripts/tests/skill-register.test.ts::flags::an_unrelated_argument_sets_nothing
  Scenario: An unrelated argument sets no flag
    When "--help" and "somefile.md" are parsed
    Then every flag is off

  @test:scripts/tests/skill-register.test.ts::flags::the_gate_form_(--check)_never_writes_the_sidecar;_the_author's_form_does
  Scenario: Only the author's form writes the report sidecar
    Then --check, with or without --json, writes no report
    And a bare run writes the report, and --no-report does not

  @test:scripts/tests/skill-register.test.ts::the_report::lands_under_the_INSTANCE_root,_not_the_caller's_cwd
  Scenario: The report lands under the instance root
    Given a scratch instance root
    When the report is written there
    Then it is at test/results/skill-register.qa-results.json under that root, and exists

  @test:scripts/tests/skill-register.test.ts::the_report::`ran`_is_present_on_EVERY_entry,_so_absence_never_carries_the_fact
  Scenario: Every report entry states whether it ran
    Given every step reported as not run
    When the report is written
    Then the registration-chain family has an entry per step, each with ran false and no current

  @test:scripts/tests/skill-register.test.ts::the_report::a_red_verdict_is_recorded_rather_than_only_printed
  Scenario: A red verdict is recorded in the report
    Given one step that ran and is not current
    When the report is written
    Then its entry records ran true and current false

  @test:scripts/tests/skill-register.test.ts::the_report::the_declaration_findings_are_a_family_of_their_own,_present_even_when_empty
  Scenario: The declaration findings are their own family, present even when empty
    When the report is written with no declaration findings
    Then it has a declarations family with no entries
    When the report is written with one "undeclared" finding
    Then the declarations family holds that one entry

  @test:scripts/tests/skill-register.test.ts::inside_a_build_of_the_QA_working_copy,_the_steps_that_read_it_are_deferred_(2026-10-15)::outside_a_build,_every_step_runs
  Scenario: Outside a QA build every step runs
    When the steps to run are chosen with no build variable
    Then every step runs and none is deferred

  @test:scripts/tests/skill-register.test.ts::inside_a_build_of_the_QA_working_copy,_the_steps_that_read_it_are_deferred_(2026-10-15)::inside_one,_the_readers_of_the_copy_are_deferred,_and_only_they
  Scenario: Inside a QA build only the readers of the copy are deferred
    When the steps to run are chosen inside a QA working-copy build
    Then only uml:overview is deferred and every other chain step runs

  @test:scripts/tests/skill-register.test.ts::inside_a_build_of_the_QA_working_copy,_the_steps_that_read_it_are_deferred_(2026-10-15)::in_a_PREVIEW's_build,_the_writers_derive:publish_runs_anyway_are_deferred_too_(Q-CONE-2_B)
  Scenario: In a preview's QA build the built-at-publish writers are deferred too
    When the steps to run are chosen inside a QA build with CAT_BUILD_TYPE preview
    Then skills:docs, lsi:viz and uml:overview are deferred, the first saying "CAT_BUILD_TYPE=preview"
    And skill:commands, glossary:page, auto:docs, lsi:skills, kg:audit, kg:detangle and subgraph:jsonld run
    And a full build or an unrecognised build type defers only uml:overview, and a preview outside a QA build defers nothing

  @test:scripts/tests/skill-register.test.ts::inside_a_build_of_the_QA_working_copy,_the_steps_that_read_it_are_deferred_(2026-10-15)::only_writers_no_later_QA_step_reads_are_marked_built-at-publish_(traced_2026-11-01)
  Scenario: Only skills:docs and lsi:viz are marked built at publish
    Then the steps marked built-at-publish are skills:docs and lsi:viz

  @test:scripts/tests/skill-register.test.ts::inside_a_build_of_the_QA_working_copy,_the_steps_that_read_it_are_deferred_(2026-10-15)::the_step_that_draws_the_QA_tree_is_the_one_marked
  Scenario: Only uml:overview is marked as reading the QA copy
    Then the only step marked as reading the QA copy is uml:overview

  @test:scripts/tests/skill-register.test.ts::in_CI,_the_verifies_the_run's_own_gates_ask_are_left_to_them_(owner,_2026-10-23,_option_A)::locally,_every_step_is_verified,_whatever_the_variable_says
  Scenario: Locally every step is verified, whatever the variable says
    Given the verified-by-gates variable names every verify
    When the verifies are chosen outside CI
    Then every step is verified here and none is left to the gates

  @test:scripts/tests/skill-register.test.ts::in_CI,_the_verifies_the_run's_own_gates_ask_are_left_to_them_(owner,_2026-10-23,_option_A)::CI_without_the_variable_verifies_every_step
  Scenario: CI without the variable verifies every step
    When the verifies are chosen with CI "true" or "1" and no verified-by-gates variable
    Then none is left to the gates

  @test:scripts/tests/skill-register.test.ts::in_CI,_the_verifies_the_run's_own_gates_ask_are_left_to_them_(owner,_2026-10-23,_option_A)::CI=false_or_0_is_not_CI
  Scenario: CI set to false, 0 or empty is not CI
    Given the verified-by-gates variable names every verify
    When the verifies are chosen with CI "false", "0" or ""
    Then none is left to the gates

  @test:scripts/tests/skill-register.test.ts::in_CI,_the_verifies_the_run's_own_gates_ask_are_left_to_them_(owner,_2026-10-23,_option_A)::never_under_--check:_there_the_verifies_ARE_the_gate
  Scenario: Under --check no verify is left to the gates
    Given CI "true" and the verified-by-gates variable naming every verify
    When the verifies are chosen under --check
    Then none is left to the gates

  @test:scripts/tests/skill-register.test.ts::in_CI,_the_verifies_the_run's_own_gates_ask_are_left_to_them_(owner,_2026-10-23,_option_A)::in_CI,_exactly_the_named_verifies_are_left_to_the_gates,_and_the_rest_still_run_here
  Scenario: In CI exactly the named verifies are left to the gates
    Given CI "true" and the variable " kg:audit:check, check:glossary ,nonesuch"
    When the verifies are chosen
    Then check:glossary and kg:audit:check are left to the gates
    And every other step is verified here, kg:audit:check not among them

  @test:scripts/tests/skill-register.test.ts::the_red_diagnostic_names_both_'red_in_CI,_green_here'_failure_modes_(bean_1xhc)::names_both_the_corpus_distortion_(xd1g)_and_the_merge_tree_(refs/pull/N/merge,_check:merged)
  Scenario: The red diagnostic names both the corpus distortion and the merge tree
    When the chain red diagnostic is formatted for --check and for regeneration
    Then the --check diagnostic says nothing was regenerated and the regeneration diagnostic says still red after regenerating
    And both diagnostics name scripts/git-corpus.ts, refs/pull/N/merge and bun run cat check:merged
