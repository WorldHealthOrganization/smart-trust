# scripts/check-subgraph-coverage.ts audits each layer's declared directories for a visualiser, docs,
# a governing skill, serialisations and an optional process, plus each layer's own README, agent
# instructions and docs/. Each Scenario names the test that executes it.
Feature: Subgraph coverage audit

  @test:scripts/tests/check-subgraph-coverage.test.ts::the_falsifier_the_bean_asks_for::a_subgraph_with_all_four_declared_and_resolving_is_NOT_reported
  Scenario: A directory declaring all four criteria, each resolving, is not reported
    Given a fixture layer whose directory declares a visualiser, docs, a skill and serialisations, all present
    When the layer is audited
    Then the verdict is "checked"
    And there are no findings

  @test:scripts/tests/check-subgraph-coverage.test.ts::the_falsifier_the_bean_asks_for::removing_`%s`_alone_makes_exactly_that_one_appear
  Scenario: Removing any one criterion makes exactly that one appear
    Given a fixture layer declaring all four criteria, with one removed per row: visualiser, docs, skill, serialisations
    When the layer is audited with a serialisations producer present
    Then the only finding is the removed criterion
    And it is "major" for serialisations and "minor" for the other three

  @test:scripts/tests/check-subgraph-coverage.test.ts::declared-but-missing_is_a_different_problem_from_undeclared::a_target_that_does_not_resolve_is_MAJOR,_not_minor
  Scenario: A declared target that does not resolve is major and unresolvable
    Given a fixture layer declaring the visualiser "nope.html", which does not exist
    When the layer is audited
    Then there is exactly one visualiser finding
    And it is "major", says "does not resolve" and is tagged "unresolvable"

  @test:scripts/tests/check-subgraph-coverage.test.ts::declared-but-missing_is_a_different_problem_from_undeclared::an_UNDECLARED_criterion_is_tagged_`undeclared`,_so_the_two_never_collapse
  Scenario: An undeclared criterion is tagged undeclared
    Given a fixture layer declaring docs and a skill but no visualiser
    When the layer is audited
    Then there is exactly one visualiser finding, tagged "undeclared"

  @test:scripts/tests/check-subgraph-coverage.test.ts::declared-but-missing_is_a_different_problem_from_undeclared::a_bare_id_with_no_path_separator_is_not_reported_as_a_missing_file
  Scenario: A skill named by bare id is not reported as a missing file
    Given a fixture layer declaring the skill "library-ingestion"
    When the layer is audited
    Then no finding is about the skill

  @test:scripts/tests/check-subgraph-coverage.test.ts::exemption_carries_a_reason_and_is_honoured::an_exempt_criterion_is_not_a_finding,_and_its_reason_is_kept
  Scenario: An exempt criterion is not a finding and keeps its reason
    Given a fixture layer exempting its visualiser with a reason mentioning "session start"
    And docs, a skill and serialisations declared and present
    When the layer is audited
    Then there are no findings
    And the one exemption is the visualiser, with its reason kept

  @test:scripts/tests/check-subgraph-coverage.test.ts::exemption_carries_a_reason_and_is_honoured::the_reason_reaches_the_report_—_a_waiver_nobody_sees_is_a_silence_list
  Scenario: The exemption's reason appears in the report
    Given a fixture layer exempting its visualiser with the reason "BECAUSE-THIS-STRING"
    When the audit is formatted as a report
    Then the report contains "BECAUSE-THIS-STRING"

  @test:scripts/tests/check-subgraph-coverage.test.ts::serialisations_take_no_waiver_—_harnesses_cannot_override_being_in_the_KG::a_waiver_smuggled_past_the_schema_is_IGNORED,_not_honoured
  Scenario: A serialisations waiver is ignored
    Given a fixture layer with no serialisations and an exemption for serialisations forced past the schema
    When the layer is audited with a serialisations producer present
    Then the only finding is "serialisations", and it is "major"
    And serialisations is not among the exemptions

  @test:scripts/tests/check-subgraph-coverage.test.ts::bootstrap's_exemption_is_by_layer,_and_is_a_second_criterion_not_a_hole::bootstrap_is_never_asked_for_a_visualiser
  Scenario: The bootstrap layer is not asked for a visualiser
    Given a fixture layer named "bootstrap" whose directory declares no coverage
    When it is audited with a serialisations producer present
    Then the findings are "docs", "serialisations" and "skill"

  @test:scripts/tests/check-subgraph-coverage.test.ts::bootstrap's_exemption_is_by_layer,_and_is_a_second_criterion_not_a_hole::any_other_instance_with_the_same_shape_IS_asked
  Scenario: Any other layer of the same shape is asked for a visualiser
    Given a fixture layer named "not-bootstrap" whose directory declares no coverage
    When it is audited with a serialisations producer present
    Then the findings are "docs", "serialisations", "skill" and "visualiser"

  @test:scripts/tests/check-subgraph-coverage.test.ts::bootstrap's_exemption_is_by_layer,_and_is_a_second_criterion_not_a_hole::the_exemption_is_announced_in_the_report_rather_than_applied_silently
  Scenario: The bootstrap exemption is announced in the report
    Given a fixture layer named "bootstrap"
    When its audit is formatted as a report
    Then the report contains "exempt from `visualiser`"

  @test:scripts/tests/check-subgraph-coverage.test.ts::bootstrap's_exemption_is_by_layer,_and_is_a_second_criterion_not_a_hole::is_keyed_on_the_instance_NAME,_so_a_relocation_keeps_it
  Scenario: The visualiser exemption is keyed on the layer name
    # Gap: no relocated layer is audited; only the set of exempt names is read.
    When the visualiser-exempt layer names are read
    Then they include "bootstrap"
    And they do not include "cat-harness"

  @test:scripts/tests/check-subgraph-coverage.test.ts::bootstrap's_exemption_is_by_layer,_and_is_a_second_criterion_not_a_hole::AT_LEAST_ONE_exempt_name_matches_a_real_instance_—_a_rename_must_not_revoke_it
  Scenario: At least one exempt name matches a real layer
    Given the real repository's audit
    When the visualiser-exempt names are matched against the audited layers
    Then at least one matches

  @test:scripts/tests/check-subgraph-coverage.test.ts::an_unmet_OBLIGATION_outranks_an_unanswered_question::a_kind_that_OWES_a_visualiser_and_has_none_is_MAJOR
  Scenario: A kind that owes a visualiser and has none is major
    Given a fixture directory of kind "beans" declaring docs and a skill but no visualiser
    When the layer is audited
    Then there is exactly one visualiser finding
    And it is "major" and says "owes one"

  @test:scripts/tests/check-subgraph-coverage.test.ts::an_unmet_OBLIGATION_outranks_an_unanswered_question::a_SELF-RENDERING_kind_with_none_is_minor_—_it_never_owed_one
  Scenario: A self-rendering kind with no visualiser is minor
    Given a fixture directory of kind "docs" declaring docs and a skill but no visualiser
    When the layer is audited
    Then there is exactly one visualiser finding, and it is "minor"

  @test:scripts/tests/check-subgraph-coverage.test.ts::an_unmet_OBLIGATION_outranks_an_unanswered_question::the_obligation_does_NOT_key_on_`holds`,_because_fsh-guts_moved_category
  Scenario: Both beans and fsh-guts owe a visualiser despite holding different layers
    Given a fixture directory of kind "beans", and another of kind "fsh-guts", each with no visualiser
    When each layer is audited
    Then each one's visualiser finding is "major"

  @test:scripts/tests/check-subgraph-coverage.test.ts::an_unmet_OBLIGATION_outranks_an_unanswered_question::an_UNKNOWN_kind_owes_one_by_default_—_tested_on_the_function,_not_a_fixture
  Scenario: An unregistered kind owes a visualiser by default
    When the visualiser obligation of an invented kind is asked
    Then it owes one

  @test:scripts/tests/check-subgraph-coverage.test.ts::an_unmet_OBLIGATION_outranks_an_unanswered_question::the_three_layers_land_where_the_owner's_parenthetical_puts_them
  Scenario: Each layer's visualiser obligation follows the owner's table
    When the visualiser obligation is asked of "beans", "fsh-guts", "library", "schemas" and "docs"
    Then state, context and derived kinds owe one
    And the content kind and the renderable kind do not

  @test:scripts/tests/check-subgraph-coverage.test.ts::an_unmet_OBLIGATION_outranks_an_unanswered_question::a_RENDERABLE_kind_is_exempt_even_when_it_is_not_content
  Scenario: A renderable kind is exempt even when it holds state
    Given a registry with a renderable kind "live-board" that holds state
    When its visualiser obligation is asked
    Then it owes none
    And "beans" in the default registry still owes one

  @test:scripts/tests/check-subgraph-coverage.test.ts::an_unmet_OBLIGATION_outranks_an_unanswered_question::a_declared_visualiser_that_resolves_is_not_a_finding,_whatever_the_kind_owes
  Scenario: A resolving visualiser is not a finding even for a kind that owes one
    Given a fixture directory of kind "beans" declaring a present visualiser, docs, skill and serialisations
    When the layer is audited
    Then there are no visualiser findings

  @test:scripts/tests/check-subgraph-coverage.test.ts::could_not_determine_is_never_a_clean_run::an_unreadable_declaration_is_undetermined,_not_zero_findings
  Scenario: An unreadable declaration is undetermined, never a clean run
    Given a layer whose declaration is "{ not json"
    When it is audited
    Then the verdict is "undetermined" with a reason
    And the report says "not a clean run"

  @test:scripts/tests/check-subgraph-coverage.test.ts::this_repository::is_audited_across_every_instance_discovery_finds
  Scenario: The real repository is audited across every discovered layer
    Given the real repository
    When every layer is audited
    Then the audited layers include "cat-harness" and "bootstrap"
    And every verdict is "checked"

  @test:scripts/tests/check-subgraph-coverage.test.ts::every_instance_needs_a_starting_README_OF_ITS_OWN_(bean_`ie9l`)::an_instance_with_its_own_instance-readme_is_clean
  Scenario: A layer with its own instance README is clean
    Given a layer declaring an "instance-readme" asset "README.md" that exists
    When its README is judged
    Then there is no finding

  @test:scripts/tests/check-subgraph-coverage.test.ts::every_instance_needs_a_starting_README_OF_ITS_OWN_(bean_`ie9l`)::declaring_no_instance-readme_at_all_is_MAJOR
  Scenario: Declaring no instance README is major
    Given a layer declaring no assets
    When its README is judged
    Then the finding is "major" and mentions "What this instance IS, for a reader"

  @test:scripts/tests/check-subgraph-coverage.test.ts::every_instance_needs_a_starting_README_OF_ITS_OWN_(bean_`ie9l`)::BORROWING_the_repository's_README_is_MAJOR_—_the_case_check-declared-assets_cannot_see
  Scenario: A layer borrowing the repository's README is major
    Given a layer below the repository root declaring a repository-scoped "instance-readme"
    When its README is judged
    Then the finding is "major" and mentions "two jobs"

  @test:scripts/tests/check-subgraph-coverage.test.ts::every_instance_needs_a_starting_README_OF_ITS_OWN_(bean_`ie9l`)::...but_the_repository_ROOT_may_legitimately_own_the_repository's_README
  Scenario: The repository root may own the repository's README
    Given the repository root declaring a repository-scoped "instance-readme" that exists
    When its README is judged
    Then there is no finding

  @test:scripts/tests/check-subgraph-coverage.test.ts::every_instance_needs_a_starting_README_OF_ITS_OWN_(bean_`ie9l`)::a_declared_README_that_is_not_on_disk_is_MAJOR
  Scenario: A declared README missing from disk is major
    Given a layer declaring an "instance-readme" "README.md" that does not exist
    When its README is judged
    Then the finding is "major" and mentions "not there"

  @test:scripts/tests/check-subgraph-coverage.test.ts::every_instance_needs_a_starting_README_OF_ITS_OWN_(bean_`ie9l`)::this_repository_has_no_README_offender_left
  Scenario: No layer in this repository has a README finding
    Given the real repository's audit
    When the layers with a README finding are listed
    Then the list is empty

  @test:scripts/tests/check-subgraph-coverage.test.ts::every_instance_needs_a_starting_README_OF_ITS_OWN_(bean_`ie9l`)::the_AGENT_half_is_asked_about_too,_and_no_instance_is_mute_any_more
  Scenario: No layer in this repository lacks agent instructions
    Given the real repository's audit
    When the layers with an agent-instructions finding are listed
    Then the list is empty

  @test:scripts/tests/check-subgraph-coverage.test.ts::the_own-docs_axis_—_an_instance_owes_documentation_of_its_own::reports_an_instance_with_no_docs/_of_its_own
  Scenario: A layer with no docs directory of its own is reported
    Given a declared layer with no site docs directory
    When its own docs are judged
    Then the finding is "minor" and says "no `docs/` of its own"

  @test:scripts/tests/check-subgraph-coverage.test.ts::the_own-docs_axis_—_an_instance_owes_documentation_of_its_own::says_nothing_about_an_instance_that_has_one
  Scenario: A layer with its own docs directory is not reported
    Given a declared layer with its site docs directory
    When its own docs are judged
    Then there is no finding

  @test:scripts/tests/check-subgraph-coverage.test.ts::the_own-docs_axis_—_an_instance_owes_documentation_of_its_own::is_MINOR,_never_major_—_it_fires_on_most_of_the_corpus_on_the_day_it_lands
  Scenario: A missing own docs directory is minor
    Given a declared layer with no site docs directory
    When its own docs are judged
    Then the finding is "minor"

  @test:scripts/tests/check-subgraph-coverage.test.ts::the_own-docs_axis_—_an_instance_owes_documentation_of_its_own::honours_a_declared_exemption,_and_reads_it_from_the_DECLARATION
  Scenario: A declared own-docs exemption is honoured
    Given a declared layer with no docs directory
    And a declaration exempting it from "own-docs" with a reason
    When its own docs are judged
    Then there is no finding

  @test:scripts/tests/check-subgraph-coverage.test.ts::the_own-docs_axis_—_an_instance_owes_documentation_of_its_own::an_exemption_from_a_DIFFERENT_obligation_does_not_excuse_this_one
  Scenario: An exemption from another obligation does not excuse own docs
    Given a declared layer with no docs directory
    And a declaration exempting it only from "visualiser"
    When its own docs are judged
    Then there is a finding

  @test:scripts/tests/check-subgraph-coverage.test.ts::the_own-docs_axis_—_an_instance_owes_documentation_of_its_own::an_instance_with_no_declaration_ARGUMENT_is_still_asked_the_question
  Scenario: No declaration argument is not an exemption
    When own docs are judged with no declaration argument
    Then a layer with no docs directory has a finding
    And a layer with one has none

  @test:scripts/tests/check-subgraph-coverage.test.ts::the_own-docs_axis_—_an_instance_owes_documentation_of_its_own::an_UNRESOLVABLE_site_root_is_reported_as_unknown,_never_as_satisfied
  Scenario: An unresolvable site root is reported as unknown
    Given a bare directory with no declaration
    When its own docs are judged
    Then there is a finding mentioning "UNKNOWN"
    And it does not say "has no `docs/` of its own"

  @test:scripts/tests/check-subgraph-coverage.test.ts::the_own-docs_axis_—_an_instance_owes_documentation_of_its_own::is_reported_as_its_own_line,_separate_from_the_README_axis
  Scenario: Own docs is reported on its own line
    Given the real repository's audit
    When it is formatted as a report
    Then the report contains "no `docs/` OF THEIR OWN"
    And it contains "advisory, not gated"

  @test:scripts/tests/check-subgraph-coverage.test.ts::coverage.*_resolves_against_the_REPOSITORY_root_and_nothing_else_—_bean_`yt7j`::a_target_at_the_repository_root_resolves
  Scenario: A coverage target at the repository root resolves
    Given a fixture layer declaring the visualiser "viz.html", written at the repository root
    When the layer is audited
    Then there are no visualiser findings

  @test:scripts/tests/check-subgraph-coverage.test.ts::coverage.*_resolves_against_the_REPOSITORY_root_and_nothing_else_—_bean_`yt7j`::THE_FALSIFICATION:_a_target_that_exists_ONLY_under_the_instance_is_a_finding
  Scenario: A coverage target present only under the layer is a finding
    Given a fixture layer declaring the visualiser "viz.html", written under the layer and not at the repository root
    When the layer is audited
    Then there is exactly one visualiser finding
    And it is "major" and says "does not resolve"

  @test:scripts/tests/check-subgraph-coverage.test.ts::coverage.*_resolves_against_the_REPOSITORY_root_and_nothing_else_—_bean_`yt7j`::resolveCoveragePath_composes_from_the_root_it_is_handed,_and_checks_nothing
  Scenario: A coverage path is composed from the root it is given
    When "cat-harness/docs/x.html" is resolved against "/repo"
    Then the path is "/repo/cat-harness/docs/x.html"
    And "a/b.md" resolved against "/repo/" is "/repo/a/b.md"

  @test:scripts/tests/check-subgraph-coverage.test.ts::coverage.*_resolves_against_the_REPOSITORY_root_and_nothing_else_—_bean_`yt7j`::a_governing_skill_is_found_by_its_declaration,_never_looked_up_as_a_path
  Scenario: A governing skill is found by its declaration
    Given a fixture layer with a skill file "some-skill" declaring the directory's kind
    When the layer is audited
    Then there are no skill findings

  @test:scripts/tests/check-subgraph-coverage.test.ts::the_repository_root_is_recognised_as_itself_—_bean_`yt7j`::an_instance_BELOW_the_root_borrowing_a_repository-scoped_asset_is_a_finding
  Scenario: A layer below the root borrowing a repository-scoped README is a finding
    Given a layer declaring a repository-scoped instance README
    When it is audited with its parent as the repository root
    Then the README finding is "major" and mentions "one file doing two jobs"

  @test:scripts/tests/check-subgraph-coverage.test.ts::the_repository_root_is_recognised_as_itself_—_bean_`yt7j`::the_repository_root_declaring_the_same_asset_is_NOT_a_finding
  Scenario: The repository root declaring a repository-scoped README is not a finding
    Given a layer declaring a repository-scoped instance README
    When it is audited as the repository root itself
    Then there is no README finding

  @test:scripts/tests/check-subgraph-coverage.test.ts::the_repository_root_is_recognised_as_itself_—_bean_`yt7j`::an_unscoped_asset_is_fine_either_way,_which_is_why_this_stayed_latent
  Scenario: An unscoped README is fine at the root and below it
    Given a layer declaring an unscoped instance README
    When it is audited as the repository root and again with its parent as the root
    Then neither audit has a README finding

  @test:scripts/tests/check-subgraph-coverage.test.ts::this_repository_declares_nothing_that_fails_to_resolve_—_bean_`bsay`::no_declaration_in_this_repository_points_at_a_missing_target
  Scenario: No declaration in this repository points at a missing target
    Given the real repository's audit
    When its findings tagged "unresolvable" are listed
    Then the list is empty

  @test:scripts/tests/check-subgraph-coverage.test.ts::this_repository_declares_nothing_that_fails_to_resolve_—_bean_`bsay`::and_the_check_is_still_REPORTING_findings,_so_the_line_above_is_not_vacuous
  Scenario: The real audit still reports undeclared findings
    Given the real repository's audit
    When its findings tagged "undeclared" are counted
    Then there is at least one

  @test:scripts/tests/check-subgraph-coverage.test.ts::coverage.process_is_a_declared-only_criterion::declaring_NO_process_is_not_a_finding_—_a_directory_owes_none
  Scenario: Declaring no process is not a finding
    Given a fixture layer whose directory declares no process
    When the layer is audited
    Then no finding is about the process

  @test:scripts/tests/check-subgraph-coverage.test.ts::coverage.process_is_a_declared-only_criterion::declaring_one_that_resolves_is_not_a_finding_either
  Scenario: Declaring a process that has a diagram is not a finding
    Given a fixture layer whose directory declares the process "demo-flow"
    And a "demo-flow.bpmn" diagram in the processes directory
    When the layer is audited
    Then no finding is about the process

  @test:scripts/tests/check-subgraph-coverage.test.ts::coverage.process_is_a_declared-only_criterion::declaring_one_that_names_no_diagram_is_MAJOR_and_`unresolvable`
  Scenario: Declaring a process with no diagram is major and unresolvable
    Given a fixture layer whose directory declares the process "demo-flow" with no diagram
    When the layer is audited
    Then there is exactly one process finding
    And it is "major" and tagged "unresolvable"

  @test:scripts/tests/check-subgraph-coverage.test.ts::coverage.process_is_a_declared-only_criterion::the_message_names_the_DIRECTORY_and_the_PROCESS,_so_the_repair_is_locatable
  Scenario: The process finding names the directory and the process
    Given a fixture layer whose directory "thing" declares the process "demo-flow" with no diagram
    When the layer is audited
    Then the process finding's directory is "thing"
    And its detail mentions "demo-flow" and "thing/"

  @test:scripts/tests/check-subgraph-coverage.test.ts::only_a_node-graph_kind_owes_serialisations_(owner,_Q-SER-2_A,_2026-11-12)::%s
  Scenario: A directory owes serialisations when any of its kinds does
    Given a registry classifying attestations, todo-items and public-comments as state, code and docs as not serialised, and glossary as a node graph
    When the serialisations obligation of a directory is asked for each row's kinds
    Then attestations, code, docs, and todo-items with public-comments owe none
    And glossary, an unregistered kind, and attestations with glossary owe them

  @test:scripts/tests/check-subgraph-coverage.test.ts::only_a_node-graph_kind_owes_serialisations_(owner,_Q-SER-2_A,_2026-11-12)::the_kind's_own_`serialised`_flag_wins_over_`holds`
  Scenario: A kind's serialised flag overrides what it holds
    Given a state kind marked serialised and a content kind marked not serialised
    When their serialisations obligation is asked
    Then the state kind owes serialisations
    And the content kind does not

  @test:scripts/tests/check-subgraph-coverage.test.ts::only_a_node-graph_kind_owes_serialisations_(owner,_Q-SER-2_A,_2026-11-12)::the_base_registry_marks_code,_built_pages,_caches,_fixtures_and_snapshots_as_not_serialised
  Scenario: The base registry marks code, built pages, caches, fixtures and snapshots as not serialised
    When the serialisations obligation is asked of code, docs, cache, the fixed and generated test data, auto-docs, the CDN sites and substrate-snapshot
    Then none owes serialisations

  @test:scripts/tests/check-subgraph-coverage.test.ts::only_a_node-graph_kind_owes_serialisations_(owner,_Q-SER-2_A,_2026-11-12)::the_checker:_a_state_directory,_a_code_directory_and_a_docs_directory_owe_nothing
  Scenario: State, code and docs directories owe no serialisations
    Given fixture directories of kinds attestations, code, docs, and todo-items with beans
    When each is audited with a producer present
    Then none has a serialisations finding
    And each lists "thing" as not owed serialisations
    And none records serialisations as an exemption

  @test:scripts/tests/check-subgraph-coverage.test.ts::only_a_node-graph_kind_owes_serialisations_(owner,_Q-SER-2_A,_2026-11-12)::the_checker:_a_content_kind,_or_[state,_content],_still_owes,_and_it_is_major
  Scenario: A content directory, or a state and content one, still owes serialisations
    Given fixture directories of kind cat-harness, and of attestations with cat-harness
    When each is audited with a producer present
    Then each has a "major" serialisations finding saying "every directory of a node-graph kind owes"
    And neither lists a directory as not owed

  @test:scripts/tests/check-subgraph-coverage.test.ts::only_a_node-graph_kind_owes_serialisations_(owner,_Q-SER-2_A,_2026-11-12)::the_checker:_with_no_producer_anywhere,_an_owing_directory_AWAITS_one_—_listed,_not_a_finding,_not_waived
  Scenario: With no producer, an owing directory awaits one
    Given a fixture directory of kind cat-harness
    When it is audited with no producer declared anywhere
    Then there is no serialisations finding
    And "thing" is listed as awaiting a producer
    And serialisations is not an exemption
    And no directory is listed as not owed

  @test:scripts/tests/check-subgraph-coverage.test.ts::only_a_node-graph_kind_owes_serialisations_(owner,_Q-SER-2_A,_2026-11-12)::the_checker:_a_directory_not_owed_is_not_awaiting_a_producer_either
  Scenario: A directory not owed serialisations does not await a producer
    Given a fixture directory of kind code
    When it is audited with no producer declared
    Then no directory is listed as awaiting a producer

  @test:scripts/tests/check-subgraph-coverage.test.ts::only_a_node-graph_kind_owes_serialisations_(owner,_Q-SER-2_A,_2026-11-12)::the_report:_awaiting_directories_are_ONE_line_with_no_✗,_so_a_new_directory_adds_no_diagnostic
  Scenario: Directories awaiting a producer are summarised in one line with no failure mark
    # Gap: only one awaiting directory is reported; that a second adds no diagnostic is not checked.
    Given a fixture directory of kind cat-harness audited with no producer
    When the audit is formatted as a report
    Then it contains "1 director(ies) owe serialisations and declare none, and no layer declares a producer yet"
    And it has no "/ serialisations" entry
    And no line starting with "✗" mentions serialisations

  @test:scripts/tests/check-subgraph-coverage.test.ts::only_a_node-graph_kind_owes_serialisations_(owner,_Q-SER-2_A,_2026-11-12)::the_producer_is_read_from_the_checkout:_any_directory_declaring_coverage.serialisations
  Scenario: A producer is declared by any directory declaring coverage.serialisations
    Given one fixture checkout with no coverage and another whose directory declares serialisations "scripts/gen.ts"
    When each checkout is asked whether a serialisations producer is declared
    Then the first answers no and the second yes
    And auditing the first with a producer present gives a serialisations finding

  @test:scripts/tests/check-subgraph-coverage.test.ts::only_a_node-graph_kind_owes_serialisations_(owner,_Q-SER-2_A,_2026-11-12)::the_report_counts_the_directories_not_owed
  Scenario: The report counts the directories not owed serialisations
    Given a fixture directory of kind attestations audited with a producer present
    When the audit is formatted as a report
    Then it contains "1 director(ies) not owed serialisations (state, code or pages)"
