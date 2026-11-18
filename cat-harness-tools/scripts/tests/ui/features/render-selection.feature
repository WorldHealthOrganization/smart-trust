# scripts/render-selection.ts picks which render steps run: a step runs when its inputs changed,
# when a step it needs re-ran, or when nothing can be concluded, and never silently skips.
# Each Scenario names the test that executes it.
Feature: Incremental render step selection

  @test:scripts/tests/ui/render-selection.test.ts::hashInputs::is_stable_across_runs_and_independent_of_mtime
  Scenario: The input hash is stable and ignores mtime
    Given a step reading "skills" with two files
    When one file is rewritten with identical content
    Then the step's input hash is unchanged

  @test:scripts/tests/ui/render-selection.test.ts::hashInputs::changes_when_content_changes
  Scenario: The input hash changes when content changes
    Given a step reading "skills" with one file
    When the file's content changes from "one" to "ONE"
    Then the step's input hash changes

  @test:scripts/tests/ui/render-selection.test.ts::hashInputs::changes_when_a_file_MOVES,_because_an_index_keyed_on_names_notices
  Scenario: The input hash changes when a file is renamed
    Given one tree holding "skills/a.md" and another holding "skills/b.md" with the same content
    Then the two input hashes differ

  @test:scripts/tests/ui/render-selection.test.ts::hashInputs::is_undefined_—_not_a_hash_of_nothing_—_when_no_inputs_are_declared
  Scenario: The input hash is undefined when no inputs are declared
    Given a step with no inputs field and a step with an empty inputs list
    Then each one's input hash is undefined

  @test:scripts/tests/ui/render-selection.test.ts::hashInputs::skips_dot-prefixed_segments
  Scenario: The input hash skips dot-prefixed paths
    Given a step reading "skills"
    When a file is added under "skills/.cache"
    Then the step's input hash is unchanged

  @test:scripts/tests/ui/render-selection.test.ts::hashInputs::a_declared_input_that_does_not_exist_contributes_nothing_rather_than_throwing
  Scenario: A declared input that does not exist contributes nothing
    Given a step reading "skills" and "absent", where "absent" does not exist
    Then its input hash equals the hash of a step reading only "skills"

  @test:scripts/tests/ui/render-selection.test.ts::filesUnder_is_deterministic::returns_a_sorted_list,_so_the_hash_cannot_depend_on_readdir_order
  Scenario: Files under a directory are listed sorted
    Given a directory "d" holding "z.md", "a.md" and "sub/m.md"
    When the files under it are listed
    Then they are "d/a.md", "d/sub/m.md", "d/z.md"

  @test:scripts/tests/ui/render-selection.test.ts::filesUnder_is_deterministic::sorts_by_codepoint,_not_by_locale_—_the_same_on_every_machine
  Scenario: Files are sorted by codepoint, not locale
    Given a directory "d" holding "README.md" and "a.md"
    When the files under it are listed
    Then "d/README.md" comes before "d/a.md"

  @test:scripts/tests/ui/render-selection.test.ts::filesUnder_is_deterministic::a_single_file_resolves_to_itself
  Scenario: A single file lists as itself
    Given a file "d/a.md"
    When the files under "d/a.md" are listed
    Then the list is just "d/a.md"

  @test:scripts/tests/ui/render-selection.test.ts::selectSteps_—_nothing_changed::a_build_whose_inputs_match_its_seed_runs_nothing
  Scenario: A build whose inputs match its seed manifest runs nothing
    Given steps "skills", "pages" and "index", where pages needs skills and index needs pages
    And a manifest built from the current tree
    When steps are selected against it
    Then no step runs
    And "skills", "pages" and "index" are skipped

  @test:scripts/tests/ui/render-selection.test.ts::selectSteps_—_the_projection_edge::one_changed_source_file_re-runs_its_own_step
  Scenario: One changed source file re-runs its own step
    Given a manifest built from the current tree
    When a file under "skills" changes
    Then step "skills" is selected because its inputs changed

  @test:scripts/tests/ui/render-selection.test.ts::selectSteps_—_the_index_edge,_which_is_the_whole_bean::a_changed_MEMBER_re-runs_the_index_that_counts_it
  Scenario: A changed member re-runs the index that counts it
    Given a manifest built from the current tree
    When a file under "catalogue" changes
    Then "pages" and "index" both run
    And "pages" runs because its inputs changed

  @test:scripts/tests/ui/render-selection.test.ts::selectSteps_—_the_index_edge,_which_is_the_whole_bean::a_step_re-runs_because_something_it_NEEDS_re-ran,_not_because_its_own_inputs_moved
  Scenario: A step re-runs because a step it needs re-ran
    Given a manifest built from the current tree
    When a file under "skills" changes
    Then "pages" runs with reason "needs-rerun" on "skills"
    And the detail says "`skills` is re-running, and this step reads what it writes"

  @test:scripts/tests/ui/render-selection.test.ts::selectSteps_—_the_index_edge,_which_is_the_whole_bean::the_cascade_reaches_a_fixed_point,_not_just_one_hop
  Scenario: The re-run cascade reaches a fixed point
    Given a manifest built from the current tree
    When a file under "skills" changes
    Then the steps run are "skills", "pages" and "index"

  @test:scripts/tests/ui/render-selection.test.ts::selectSteps_—_the_index_edge,_which_is_the_whole_bean::the_cascade_works_when_declaration_order_runs_against_the_dependency_order
  Scenario: The cascade works when steps are declared leaf-first
    Given the steps declared in the order "index", "pages", "skills"
    And a manifest built from the current tree
    When a file under "skills" changes
    Then all three steps run

  @test:scripts/tests/ui/render-selection.test.ts::selectSteps_—_could-not-determine_always_runs::no_manifest_at_all_is_a_FULL_render
  Scenario: No manifest at all is a full render
    When steps are selected with no manifest
    Then "skills", "pages" and "index" all run
    And "skills" runs with reason "no-manifest"

  @test:scripts/tests/ui/render-selection.test.ts::selectSteps_—_could-not-determine_always_runs::a_step_the_manifest_never_mentions_runs_—_absent_is_not_fresh
  Scenario: A step the manifest never mentions runs
    Given a manifest built from the current tree with step "pages" removed
    When steps are selected against it
    Then "pages" runs with reason "not-in-manifest"
    And "index" runs too

  @test:scripts/tests/ui/render-selection.test.ts::selectSteps_—_could-not-determine_always_runs::a_step_that_never_said_what_it_reads_runs
  Scenario: A step that declares no inputs runs
    Given a step "mystery" with no declared inputs and a manifest built for it
    When steps are selected
    Then "mystery" runs with reason "undeclared-inputs"

  @test:scripts/tests/ui/render-selection.test.ts::selectSteps_—_could-not-determine_always_runs::an_alwaysRun_step_runs_and_says_why
  Scenario: An alwaysRun step runs and says why
    Given a step "clock" marked alwaysRun "stamps the build time" and a manifest built for it
    When steps are selected
    Then "clock" runs with reason "always" and detail "stamps the build time"

  @test:scripts/tests/ui/render-selection.test.ts::readManifest_refuses_a_seed_it_cannot_trust::absent_is_undefined
  Scenario: An absent manifest reads as undefined
    When a manifest path that does not exist is read
    Then the result is undefined

  @test:scripts/tests/ui/render-selection.test.ts::readManifest_refuses_a_seed_it_cannot_trust::unparseable_is_undefined,_not_a_partial_read
  Scenario: An unparseable manifest reads as undefined
    Given a manifest file holding "{ not json"
    When it is read
    Then the result is undefined

  @test:scripts/tests/ui/render-selection.test.ts::readManifest_refuses_a_seed_it_cannot_trust::a_wrong_schema_tag_is_undefined
  Scenario: A manifest with the wrong schema tag reads as undefined
    Given a manifest file with schema "something-else/v9"
    When it is read
    Then the result is undefined

  @test:scripts/tests/ui/render-selection.test.ts::readManifest_refuses_a_seed_it_cannot_trust::a_manifest_with_no_steps_object_is_undefined
  Scenario: A manifest with no steps object reads as undefined
    Given a manifest file with the right schema and no steps
    When it is read
    Then the result is undefined

  @test:scripts/tests/ui/render-selection.test.ts::readManifest_refuses_a_seed_it_cannot_trust::a_well-formed_one_round-trips
  Scenario: A well-formed manifest round-trips
    Given a manifest built for one step at commit "abc1234" and written to disk
    When it is read back
    Then the step's hash and the commit "abc1234" are preserved
    And selecting steps against it runs nothing

  @test:scripts/tests/ui/render-selection.test.ts::inputGraphs_—_read_the_declaration,_do_not_spell_the_paths::resolves_a_graph_typology_to_its_declared_directories
  Scenario: A graph typology resolves to its declared directories
    Given a resolver mapping graph "kg" to "a/skills" and "b/skills"
    When the inputs of a step declaring graph "kg" are resolved
    Then they are "a/skills" and "b/skills"

  @test:scripts/tests/ui/render-selection.test.ts::inputGraphs_—_read_the_declaration,_do_not_spell_the_paths::merges_literals_and_graphs,_deduplicated_and_sorted
  Scenario: Literal inputs and graph inputs merge deduplicated and sorted
    Given a step with inputs "README.md" and "a/skills" and graph "kg"
    When its inputs are resolved
    Then they are "README.md", "a/skills", "b/skills" in codepoint order

  @test:scripts/tests/ui/render-selection.test.ts::inputGraphs_—_read_the_declaration,_do_not_spell_the_paths::a_step_declaring_only_graphs_is_CACHEABLE,_not_undeclared
  Scenario: A step declaring only graphs is cacheable
    Given a step declaring only graph "kg"
    When a manifest is built for it with the resolver
    Then the manifest has an entry for the step
    And selecting steps against it runs nothing

  @test:scripts/tests/ui/render-selection.test.ts::inputGraphs_—_read_the_declaration,_do_not_spell_the_paths::a_change_inside_a_resolved_directory_re-runs_the_step
  Scenario: A change inside a resolved graph directory re-runs the step
    Given a step declaring only graph "kg" and a manifest built for it
    When "b/skills/y.md" changes
    Then the step runs because its inputs changed

  @test:scripts/tests/ui/render-selection.test.ts::inputGraphs_—_read_the_declaration,_do_not_spell_the_paths::a_graph_the_resolver_knows_nothing_about_contributes_nothing
  Scenario: A graph the resolver does not know contributes nothing
    Given a step declaring only graph "no-such-graph"
    When its inputs are resolved
    Then they are empty
    And the step runs with reason "undeclared-inputs"

  @test:scripts/tests/ui/render-selection.test.ts::inputGraphs_—_read_the_declaration,_do_not_spell_the_paths::without_a_resolver,_inputGraphs_contribute_nothing_rather_than_throwing
  Scenario: Without a resolver graph inputs contribute nothing
    Given a step declaring graph "kg"
    When its inputs are resolved with no resolver
    Then they are empty
