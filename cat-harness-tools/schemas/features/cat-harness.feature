# schemas/cat-harness.test.ts checks schemas/kg/cat-harness.ts: reading a layer's declaration,
# inheriting and defaulting directories, the graph-typology registry and its layers, and
# materialising declared directories. Each Scenario names the test that executes it.
Feature: The CatHarness layer declaration

  @test:schemas/cat-harness.test.ts::reading_a_declaration::reads_directories_and_their_graph_typologies
  Scenario: Reading a declaration gives its name and directories
    Given a declaration "agentic-harness" with directories "tools", "kg" and "schemas"
    When it is read
    Then its name is "agentic-harness"
    And its directory ids are "kg", "schemas" and "tools"

  @test:schemas/cat-harness.test.ts::reading_a_declaration::an_absent_declaration_is_undefined,_not_an_error
  Scenario: An absent declaration reads as undefined
    Given a directory with no declaration
    When it is read
    Then the result is undefined and nothing throws

  @test:schemas/cat-harness.test.ts::reading_a_declaration::a_present_but_unreadable_declaration_throws
  Scenario: A present but unreadable declaration throws
    Given a declaration file holding "{ not json"
    When it is read
    Then reading throws "not valid JSON"

  @test:schemas/cat-harness.test.ts::reading_a_declaration::a_legacy_`dependents`_field_is_accepted_and_ignored_(retired_2026-09-30,_option_A)
  Scenario: A legacy "dependents" field is accepted and dropped
    Given a declaration whose "uploads" entry carries "dependents": "reproduce"
    When it is read
    Then the first directory's id is "uploads"
    And the entry no longer has a "dependents" field

  @test:schemas/cat-harness.test.ts::reading_a_declaration::rejects_an_unknown_graph_typology_rather_than_accepting_it
  Scenario: An unknown graph typology is rejected with the known kinds named
    Given a declaration whose directory names the graph typology "wishful"
    When it is read
    Then the error says 'unknown graph typology "wishful"'
    And it contains "Known kinds:" and lists "tools"

  @test:schemas/cat-harness.test.ts::reading_a_declaration::accepts_the_JSON-LD_projection_as_input,_not_just_the_authored_form
  Scenario: The JSON-LD projection reads back as a declaration
    Given the "agentic-harness" declaration projected to JSON-LD and written as a declaration
    When it is read back
    Then its directory ids are still "kg", "schemas" and "tools"
    And the "kg" entry's graph typology is canonicalised to "cat-harness"

  @test:schemas/cat-harness.test.ts::inheritance_—_the_Phase_0.3_gate::core_scans_its_own_folio/_AND_the_three_it_inherits_from_the_harness
  Scenario: A dependent scans its own directory and the ones it inherits
    Given "agentic-harness" declaring "tools", "kg" and "schemas" and "folio-assist-core" declaring only "folio"
    When the directories of the chain are resolved with core as the own layer
    Then the ids are "folio", "kg", "schemas" and "tools"
    And "folio" is own and declared by "folio-assist-core"
    And "tools" is not own, is declared by "agentic-harness", and resolves under the harness's root

  @test:schemas/cat-harness.test.ts::inheritance_—_the_Phase_0.3_gate::an_instance_with_no_folio/_is_ordinary_—_agentic-harness_is_exactly_that
  Scenario: An instance with no folio directory resolves with no renderable directories
    Given "agentic-harness" resolved alone as the own layer
    Then it has no renderable directories
    And it resolves three directories

  @test:schemas/cat-harness.test.ts::inheritance_—_the_Phase_0.3_gate::overriding_matches_on_id,_not_path_—_a_relocation_replaces,_never_duplicates
  Scenario: An override matches on id, so a relocation replaces rather than duplicates
    Given "agentic-harness" declaring "kg" at "kg/" and a dependent "relocated" declaring "kg" at "graph/knowledge/"
    When the chain's directories are resolved
    Then there is exactly one "kg" entry
    And its path is "graph/knowledge/", declared by "relocated"

  @test:schemas/cat-harness.test.ts::inheritance_—_the_Phase_0.3_gate::a_renamed_id_still_overrides_the_entry_it_meant_(cat-harness_→_skills,_bean_iwtn)
  Scenario: A renamed id still overrides the entry it meant
    Given a declaration with the old id "cat-harness" at "old-skills/" holding "skills"
    When its directories are resolved
    Then no entry has the id "cat-harness"
    And the "skills" entry's path is "old-skills/"

  @test:schemas/cat-harness.test.ts::inheritance_—_the_Phase_0.3_gate::an_override_keeps_the_inherited_position_rather_than_reshuffling_the_scan_order
  Scenario: An override keeps the inherited position in the scan order
    Given "agentic-harness" and the dependent "relocated" that overrides "kg"
    When the chain's directories are resolved
    Then the ids are in the order "tools", "kg", "schemas"

  @test:schemas/cat-harness.test.ts::inheritance_—_the_Phase_0.3_gate::a_chain_of_instances_with_no_declarations_resolves_to_nothing,_not_an_error
  Scenario: A chain with no declarations resolves to nothing
    Given an own instance at a path with no declaration
    When its directories are resolved
    Then the result is empty and nothing throws

  @test:schemas/cat-harness.test.ts::layering::does_not_import_the_content_vocabulary
  Scenario: The declaration module does not import the content vocabulary
    Given the source text of schemas/kg/cat-harness.ts
    Then it imports neither "./jsonld" nor a "block-kinds" module
    And it imports from "./namespaces"
    And schemas/kg/namespaces.ts exists

  @test:schemas/cat-harness.test.ts::graph_typologies_—_the_harness_declares_its_own,_core_adds_folio::the_harness_owns_exactly_one_renderable_kind_—_the_one_it_can_serve
  Scenario: The harness owns exactly one renderable kind
    Given the harness's base graph typologies
    Then the only renderable one is "docs"
    And "folio" is not among them

  @test:schemas/cat-harness.test.ts::graph_typologies_—_the_harness_declares_its_own,_core_adds_folio::a_bare_harness_registry_does_not_know_`folio`_at_all
  Scenario: A bare harness registry does not know "folio"
    Given a new graph-typology registry
    Then it does not have "folio" and returns nothing for it
    And its names are exactly the base graph typologies

  @test:schemas/cat-harness.test.ts::graph_typologies_—_the_harness_declares_its_own,_core_adds_folio::core's_registration_adds_it,_and_it_is_the_renderable_one
  Scenario: Core's registration adds "folio" as the renderable kind
    Given a new registry with core's folio graph typology registered
    Then it has "folio" and "folio" is renderable
    And "tools", "cat-harness", "schemas", "beans", "bean-defs" and "workflow-state" are not renderable

  @test:schemas/cat-harness.test.ts::graph_typologies_—_the_harness_declares_its_own,_core_adds_folio::importing_core_registers_folio_into_the_shared_registry
  Scenario: Importing core registers "folio" into the shared registry
    Given the folio graph typology module is imported
    Then the default graph-typology registry has "folio"

  @test:schemas/cat-harness.test.ts::graph_typologies_—_the_harness_declares_its_own,_core_adds_folio::registering_the_same_kind_twice_is_a_no-op_—_a_diamond_is_not_a_conflict
  Scenario: Registering the same kind twice is a no-op
    Given a registry with the folio graph typology registered
    When it is registered again
    Then nothing throws

  @test:schemas/cat-harness.test.ts::graph_typologies_—_the_harness_declares_its_own,_core_adds_folio::registering_a_DIFFERENT_definition_under_one_name_throws
  Scenario: Registering a different definition under one name throws
    Given a registry with the folio graph typology registered
    When "folio" is registered with a non-renderable content definition
    Then a graph-typology conflict error is thrown

  @test:schemas/cat-harness.test.ts::graph_typologies_—_the_harness_declares_its_own,_core_adds_folio::every_registered_kind_says_what_a_process_does_with_it
  Scenario: Every registered kind says what a process does with it
    Given every name in the default graph-typology registry
    Then each one's graph layer is "content", "context", "state" or "derived"

  @test:schemas/cat-harness.test.ts::graph_typologies_—_the_harness_declares_its_own,_core_adds_folio::the_predicates_are_not_each_other's_negations
  Scenario: The layer predicates are not each other's negations
    Given a name that is no registered kind
    Then it has no graph layer
    And it is neither a content, a context nor a state graph, and no process may write it
    And "memory" is a context graph and not a state graph

  @test:schemas/cat-harness.test.ts::graph_typologies_—_the_harness_declares_its_own,_core_adds_folio::the_four_layers_partition_the_registry_and_none_is_empty
  Scenario: The four layers partition the registry and none is empty
    Given the kinds of each of the layers "content", "context", "state" and "derived"
    Then together they number as many as the registry's names
    And no kind appears in two layers
    And every layer has at least one kind

  @test:schemas/cat-harness.test.ts::graph_typologies_—_the_harness_declares_its_own,_core_adds_folio::only_`state`_is_writable_by_a_running_step
  Scenario: Only state kinds are writable by a running step
    Given every name in the default graph-typology registry
    Then a process may write it exactly when its layer is "state"

  @test:schemas/cat-harness.test.ts::graph_typologies_—_the_harness_declares_its_own,_core_adds_folio::the_classification_of_the_kinds_a_reader_would_guess_wrong_is_pinned
  Scenario: The layers of the easily-misread kinds are pinned
    Given the graph layers of seven named kinds
    Then "memory" and "fsh-guts" are "context"
    And "todos", "qa", "health" and "uploads" are "state"
    And "library" is "derived"

  @test:schemas/cat-harness.test.ts::graph_typologies_—_the_harness_declares_its_own,_core_adds_folio::a_diamond_differing_only_in_`holds`_is_a_CONFLICT,_not_a_no-op
  Scenario: A diamond differing only in "holds" is a conflict
    Given a registry with "probe" registered as a non-renderable content kind
    When the identical definition is registered again
    Then nothing throws
    And registering it with "holds" set to "state" throws a graph-typology conflict error
    And registering it with only a different summary does not throw

  @test:schemas/cat-harness.test.ts::graph_typologies_—_the_harness_declares_its_own,_core_adds_folio::every_registered_kind_is_a_distinct_GraphTypology_individual
  Scenario: Every registered kind is a distinct GraphTypology individual
    Given every name in the default graph-typology registry
    When each is mapped to its graph-typology IRI
    Then no two names share an IRI

  @test:schemas/cat-harness.test.ts::materialiseDirectories::creates_a_declared_directory_that_does_not_exist
  Scenario: Materialising creates a declared directory that does not exist
    Given an empty temporary root and an own "library" entry at "library/"
    When the directories are materialised
    Then "library" exists under the root
    And the result reports it as created

  @test:schemas/cat-harness.test.ts::materialiseDirectories::an_inherited_WORKING_STORE_is_reproduced;_inherited_content_is_not_(option_A)::an_inherited_state_store_(uploads)_is_created_in_the_dependent
  Scenario: An inherited state store is created in the dependent
    Given an empty temporary root and an inherited "uploads" entry of graph typology "uploads"
    When the directories are materialised
    Then "uploads" exists under the root and is reported as created

  @test:schemas/cat-harness.test.ts::materialiseDirectories::an_inherited_WORKING_STORE_is_reproduced;_inherited_content_is_not_(option_A)::an_inherited_content_subgraph_(schemas)_is_not_created
  Scenario: An inherited content subgraph is not created
    Given an empty temporary root and an inherited "schemas" entry of graph typology "schemas"
    When the directories are materialised
    Then "schemas" does not exist under the root
    And the result is empty

  @test:schemas/cat-harness.test.ts::materialiseDirectories::an_inherited_WORKING_STORE_is_reproduced;_inherited_content_is_not_(option_A)::an_inherited_repository-scoped_entry_is_not_created_—_it_has_one_location
  Scenario: An inherited repository-scoped entry is not created
    Given an empty temporary root and an inherited, repository-scoped "beans" entry
    When the directories are materialised
    Then the result is empty

  @test:schemas/cat-harness.test.ts::materialiseDirectories::an_inherited_WORKING_STORE_is_reproduced;_inherited_content_is_not_(option_A)::an_instance's_OWN_entry_is_created_—_it_declared_it
  Scenario: An instance's own entry is created
    Given an empty temporary root and an own "schemas" entry
    When the directories are materialised
    Then "schemas" exists under the root and is reported as created

  @test:schemas/cat-harness.test.ts::materialiseDirectories::is_a_no-op_on_the_second_run
  Scenario: Materialising is a no-op on the second run
    Given a "library" entry already materialised once
    When the directories are materialised again
    Then the entry is reported as neither created nor given a marker

  @test:schemas/cat-harness.test.ts::materialiseDirectories::never_overwrites_an_existing_keep-marker_—_a_folio_may_have_added_rules
  Scenario: An existing keep-marker is never overwritten
    Given a materialised "uploads" directory whose ".gitignore" was rewritten to "*.tmp"
    When the directories are materialised again
    Then the ".gitignore" still holds "*.tmp"

  @test:schemas/cat-harness.test.ts::materialiseDirectories::writes_no_marker_into_a_directory_that_already_holds_files
  Scenario: No marker is written into a directory that already holds files
    Given a "skills" directory already holding "a-skill.md"
    When an entry at "skills/" is materialised
    Then no marker is reported written
    And there is no "skills/.gitignore"

  @test:schemas/cat-harness.test.ts::materialiseDirectories::the_keep-marker_ignores_nothing_—_only_comments
  Scenario: The keep-marker holds only comments
    Given the keep-marker for "uploads" described as "the incoming queue"
    Then every non-blank line of it is a comment
    And it contains "do not delete me" and "the incoming queue"

  @test:schemas/cat-harness.test.ts::materialiseDirectories::RESOLVES_AGAINST_THE_INSTANCE,_not_the_declaring_dependency
  Scenario: Materialising resolves against the instance, not the declaring dependency
    Given an inherited "library" entry declared by "folio-assist-core" whose path points into the dependency's checkout
    When it is materialised against the instance root
    Then the result's path is the instance's "library"
    And "library" exists under the instance root and not in the dependency's checkout

  @test:schemas/cat-harness.test.ts::materialiseDirectories::refuses_a_path_that_escapes_the_instance_root
  Scenario: A path escaping the instance root is refused
    Given an entry at "../elsewhere/"
    When it is materialised
    Then it throws "outside the instance"

  @test:schemas/cat-harness.test.ts::materialiseDirectories::--dry-run_reports_without_creating
  Scenario: A dry run reports without creating
    Given an empty temporary root and a "library" entry
    When the directories are materialised as a dry run
    Then the entry is reported as created
    And "library" does not exist under the root

  @test:schemas/cat-harness.test.ts::materialiseDirectories::this_instance_declares_uploads,_and_reaches_a_library
  Scenario: This instance declares uploads and reaches exactly one library of its own
    Given this repository's own directories resolved alone
    Then they include "uploads"
    And exactly one resolved directory holds the "library" graph, with the id "library"
    And the checkout's corpus holds more than one "library" directory
    And this layer's own library directory exists

  @test:schemas/cat-harness.test.ts::the_`kg`_→_`cat-harness`_rename_keeps_old_declarations_working::a_registry_resolves_the_deprecated_spelling_to_the_new_kind
  Scenario: A registry resolves the deprecated "kg" spelling to "cat-harness"
    Given a new graph-typology registry
    Then it has "kg", and "kg" returns the same definition as "cat-harness"
    And its names include "cat-harness" but not "kg"

  @test:schemas/cat-harness.test.ts::the_`kg`_→_`cat-harness`_rename_keeps_old_declarations_working::resolveGraphTypology_says_WHICH_spelling_was_used,_so_a_caller_can_warn
  Scenario: Resolving a graph typology says which spelling was used
    When "kg" is resolved
    Then the result is kind "cat-harness" with deprecated "kg"
    And "cat-harness" and "tools" resolve to themselves with no deprecation

  @test:schemas/cat-harness.test.ts::the_`kg`_→_`cat-harness`_rename_keeps_old_declarations_working::a_declaration_written_against_the_OLD_vocabulary_still_loads
  Scenario: A declaration written in the old vocabulary still loads
    Given a declaration whose "kg" entry at "skills/" names the graph typology "kg"
    When it is read
    Then it is defined
    And its first directory's graph typologies are "kg"

  @test:schemas/cat-harness.test.ts::default_directories_—_inherit_the_convention,_declare_only_the_deviation::an_instance_declaring_nothing_inherits_the_directories_it_actually_has
  Scenario: An instance declaring nothing inherits the default directories it has
    Given an instance "minimal" declaring no directories, with "skills", "beans" and "tools" present on disk
    When its directories are resolved
    Then the ids are "beans", "skills" and "tools"
    And every one is declared by "(default)"
    And "skills" has the path "skills/"

  @test:schemas/cat-harness.test.ts::default_directories_—_inherit_the_convention,_declare_only_the_deviation::a_default_whose_directory_is_ABSENT_is_not_seeded
  Scenario: A default whose directory is absent is not seeded
    Given the instance "minimal" with no "voices", "library", "uploads", "todos" or "schemas" on disk
    When its directories are resolved
    Then none of those ids is resolved
    And none of those directories was created

  @test:schemas/cat-harness.test.ts::default_directories_—_inherit_the_convention,_declare_only_the_deviation::an_explicit_entry_overrides_the_default_of_the_same_id
  Scenario: An explicit entry overrides the default of the same id
    Given an instance "relocated" declaring "skills" at "graph/knowledge/", with "tools" present on disk
    When its directories are resolved
    Then "skills" has the path "graph/knowledge/" and is declared by "relocated"
    And "tools" is still declared by "(default)"

  @test:schemas/cat-harness.test.ts::default_directories_—_inherit_the_convention,_declare_only_the_deviation::an_instance_that_declares_everything_is_unaffected
  Scenario: An instance that declares everything takes no defaults
    Given this repository's own directories resolved alone
    Then there is at least one
    And every one is declared by "cat-harness"

  @test:schemas/cat-harness.test.ts::default_directories_—_inherit_the_convention,_declare_only_the_deviation::no_default_claims_a_kind_the_harness_registry_does_not_know
  Scenario: No default directory claims a kind the bare registry does not know
    Given a new graph-typology registry and the default directories
    Then every graph typology a default directory names is known to the registry

  @test:schemas/cat-harness.test.ts::the_scope_trap::refuses_to_materialise_an_empty_twin_beside_a_directory_that_has_content
  Scenario: Materialising refuses to create an empty twin beside a directory with content
    Given a repository whose root holds "shared/real.json" and an instance directory inside it
    And an entry "shared" at "shared/" that omits its scope
    When the entry is materialised against the instance
    Then it throws a message naming "scope"
    And no "shared" directory was created in the instance

  @test:schemas/cat-harness.test.ts::the_scope_trap::materialises_normally_when_there_is_no_twin_to_be_confused_with
  Scenario: Materialising works normally when there is no twin
    Given a repository with an instance directory and no "own" directory anywhere
    When an entry "own" at "own/" is materialised against the instance
    Then it is reported as created
    And "own" exists in the instance

  @test:schemas/cat-harness.test.ts::directoryForGraph_refuses_an_ambiguous_kind_rather_than_picking_one::two_homes_→_it_throws,_and_the_message_names_both
  Scenario: A kind with two homes throws, naming both
    Given a declaration where "first" at "a/" and "second" at "b/" both hold "cat-harness"
    When the directory for "cat-harness" is asked for
    Then it throws "declared by 2 directories"
    And the message names "first (a/)" and "second (b/)"

  @test:schemas/cat-harness.test.ts::directoryForGraph_refuses_an_ambiguous_kind_rather_than_picking_one::...and_it_does_NOT_silently_return_the_first,_which_is_the_whole_defect
  Scenario: A kind with two homes does not silently return the first
    Given a declaration where "first" at "a/" and "second" at "b/" both hold "cat-harness"
    When the directory for "cat-harness" is asked for
    Then the answer is not the "a" directory

  @test:schemas/cat-harness.test.ts::directoryForGraph_refuses_an_ambiguous_kind_rather_than_picking_one::a_single-homed_kind_in_the_SAME_declaration_still_resolves
  Scenario: A single-homed kind in the same declaration still resolves
    Given a declaration where "cat-harness" has two homes and "schemas" only "a/"
    When the directory for "schemas" is asked for
    Then it is the "a" directory

  @test:schemas/cat-harness.test.ts::directoryForGraph_refuses_an_ambiguous_kind_rather_than_picking_one::directoriesForGraph_returns_every_home,_in_declaration_order
  Scenario: Asking for every home returns them in declaration order
    Given a declaration where "first" at "a/" and "second" at "b/" both hold "cat-harness"
    When every directory for "cat-harness" is asked for
    Then the result is the "a" directory then the "b" directory

  @test:schemas/cat-harness.test.ts::directoryForGraph_refuses_an_ambiguous_kind_rather_than_picking_one::a_kind_the_instance_declares_nowhere_is_empty,_not_a_throw
  Scenario: A kind declared nowhere is empty, not a throw
    Given a declaration that holds no "voices" graph
    When the directories for "voices" are asked for
    Then the list is empty
    And the single-directory lookup is undefined

  @test:schemas/cat-harness.test.ts::a_nested_declaration_is_named_by_its_KIND,_not_by_its_directory::at_the_conventional_path,_the_nested_kinds_are_found
  Scenario: At the conventional path the nested kinds are found
    Given a "beans/" directory holding a nested "beans.json" that declares "bean-defs"
    When the declared kinds are computed
    Then they are "bean-defs" and "beans"

  @test:schemas/cat-harness.test.ts::a_nested_declaration_is_named_by_its_KIND,_not_by_its_directory::RELOCATED_to_`work/`,_the_file_keeps_its_name_and_the_kinds_are_STILL_found
  Scenario: A relocated directory keeps its nested file name and the kinds are still found
    Given a "work/" directory of graph "beans" holding a nested "beans.json" that declares "bean-defs"
    When the declared kinds are computed
    Then they are "bean-defs" and "beans"

  @test:schemas/cat-harness.test.ts::a_nested_declaration_is_named_by_its_KIND,_not_by_its_directory::the_directory-name_convention_still_works_for_a_kind_declaring_no_filename
  Scenario: A kind naming no declaration file falls back to the directory name
    Given a "qa/" directory of graph "qa" holding a nested "qa.json" that declares "health"
    When the declared kinds are computed
    Then they are "health" and "qa"

  @test:schemas/cat-harness.test.ts::a_nested_declaration_is_named_by_its_KIND,_not_by_its_directory::the_two_modules'_constants_agree_with_the_kinds,_because_they_are_derived
  Scenario: The bean and todo graph file constants equal the kinds' declaration files
    Given the registry's declaration files for "beans" and "todos"
    Then they equal the bean and todo graph file constants
    And those constants are "beans.json" and "todos.json"

  @test:schemas/cat-harness.test.ts::instanceRootsIn_—_discovered,_never_listed::finds_the_root_itself_and_every_declaring_subdirectory,_root_first
  Scenario: Instance roots are the root and each declaring subdirectory, root first
    Given a declaring root with declaring subdirectories "beta" and "alpha" and a non-declaring "plain"
    When the instance roots in it are found
    Then they are the root, then "alpha", then "beta"

  @test:schemas/cat-harness.test.ts::instanceRootsIn_—_discovered,_never_listed::omits_the_root_when_the_root_does_not_declare
  Scenario: The root is omitted when it does not declare
    Given a non-declaring root with one declaring subdirectory "only"
    When the instance roots in it are found
    Then the only one is "only"

  @test:schemas/cat-harness.test.ts::instanceRootsIn_—_discovered,_never_listed::skips_dot-prefixed_directories,_like_every_other_path_guard_here
  Scenario: Dot-prefixed directories are skipped
    Given a root whose only declaring subdirectory is ".hidden"
    When the instance roots in it are found
    Then there are none

  @test:schemas/cat-harness.test.ts::instanceRootsIn_—_discovered,_never_listed::does_not_descend_—_a_declaration_two_levels_down_is_not_an_instance_here
  Scenario: A declaration two levels down is not an instance root
    Given a root whose only declaration is at "outer/inner"
    When the instance roots in it are found
    Then there are none

  @test:schemas/cat-harness.test.ts::instanceRootsIn_—_discovered,_never_listed::finds_EVERY_instance_of_THIS_repository,_which_is_the_defect_it_fixes
  Scenario: Every layer of this checkout is found as an instance root
    Given the real checkout above this repository
    When the instance roots in it are found
    Then they are exactly "bootstrap", "bootstrap-tools", "cat-harness", "cat-harness-tools", "fhir-harness", "folio-assistant-core", "folio-assistant-sci", "smart-base", "smart-immunizations", "smart-trust", "smart-trust-phw" and "who-iris", in that order
    And the checkout root itself is not among them

  @test:schemas/cat-harness.test.ts::`graphTypologies`_was_`graphs`_until_2026-09-21,_and_the_old_key_still_reads::%s::reads_a_legacy_`graphs`_key_as_`graphTypologies`
  Scenario: A legacy "graphs" key reads as "graphTypologies"
    Given each of the graph-node and content directory schemas
    When a "voices" entry carrying "graphs": ["voices"] is parsed
    Then it is accepted with graph typologies "voices"

  @test:schemas/cat-harness.test.ts::`graphTypologies`_was_`graphs`_until_2026-09-21,_and_the_old_key_still_reads::%s::takes_the_canonical_key_unchanged
  Scenario: The canonical "graphTypologies" key is taken unchanged
    Given each of the graph-node and content directory schemas
    When a "voices" entry carrying "graphTypologies": ["voices"] is parsed
    Then it is accepted with graph typologies "voices"

  @test:schemas/cat-harness.test.ts::`graphTypologies`_was_`graphs`_until_2026-09-21,_and_the_old_key_still_reads::%s::lets_`graphTypologies`_WIN_when_a_declaration_carries_both
  Scenario: "graphTypologies" wins when an entry carries both keys
    Given each of the graph-node and content directory schemas
    When an entry carrying "graphs": ["stale"] and "graphTypologies": ["voices"] is parsed
    Then it is accepted with graph typologies "voices"

  @test:schemas/cat-harness.test.ts::`graphTypologies`_was_`graphs`_until_2026-09-21,_and_the_old_key_still_reads::still_refuses_an_entry_carrying_NEITHER_key
  Scenario: An entry carrying neither key is refused
    Given the graph-node directory schema
    When a "voices" entry with neither "graphs" nor "graphTypologies" is parsed
    Then it is refused

  @test:schemas/cat-harness.test.ts::a_directory_declares_the_theme_it_renders_on_(owner,_2026-09-20)::is_optional_—_absent_means_the_instance's_own_theme
  Scenario: A directory's theme is optional
    Given the content directory schema
    When an entry with no theme is parsed
    Then it is accepted and its theme is undefined

  @test:schemas/cat-harness.test.ts::a_directory_declares_the_theme_it_renders_on_(owner,_2026-09-20)::refuses_an_empty_theme_—_absent_and_blank_are_different_claims
  Scenario: An empty theme is refused
    Given the content directory schema
    When an entry with theme "" is parsed
    Then it is refused

  @test:schemas/cat-harness.test.ts::a_directory_declares_the_theme_it_renders_on_(owner,_2026-09-20)::THE_METHODOLOGIES_TAKE_`analyst`,_and_the_theme_id_is_real
  Scenario: The methodology directories take the "analyst" theme, and it is a real theme
    Given the checkout's directories themed in their own declarer's declaration
    Then their ids are "core-methodologies", "methodologies" and "sci-methodologies"
    And each one's theme id is "analyst"
    And "analyst" is a theme in the theme table

  @test:schemas/cat-harness.test.ts::a_directory_declares_the_theme_it_renders_on_(owner,_2026-09-20)::and_NOTHING_else_is_themed_—_a_field_that_fires_on_every_subject_means_nothing
  Scenario: Not every directory of cat-harness's declaration is themed
    # Gap: only checks that fewer than all directories carry a theme, not that nothing beyond the methodologies does
    Given the directories of cat-harness's own declaration
    Then fewer of them carry a theme than there are directories

  @test:schemas/cat-harness.test.ts::ownDirectoryById_—_two_entries,_one_path,_different_scopes::picks_the_instance-scoped_entry_over_a_repository-scoped_one_at_the_same_path
  Scenario: The instance-scoped entry is picked over a repository-scoped one at the same path
    Given a declaration with "root-docs" at "docs/" scoped to the repository and "docs" at "docs/"
    When the own directory with id "docs" is asked for, with fallback "NOPE"
    Then the result is the instance's "docs" directory

  @test:schemas/cat-harness.test.ts::ownDirectoryById_—_two_entries,_one_path,_different_scopes::a_repository-scoped_entry_is_NOT_returned_even_when_its_id_matches
  Scenario: A repository-scoped entry is not returned even when its id matches
    Given a declaration whose only "docs" entry is scoped to the repository
    When the own directory with id "docs" is asked for, with fallback "fallback"
    Then the result is the instance's "fallback" path

  @test:schemas/cat-harness.test.ts::ownDirectoryById_—_two_entries,_one_path,_different_scopes::falls_back_to_the_convention_path_when_nothing_is_declared
  Scenario: The convention path is the fallback when nothing is declared
    Given a declaration with no directories
    When the own directory with id "docs" is asked for, with fallback "docs"
    Then the result is the instance's "docs" path

  @test:schemas/cat-harness.test.ts::resolveDirectories_—_from-within_declarations::promotes_the_nested_entry,_under_its_parent's_path
  Scenario: A nested subgraph entry is promoted under its parent's path
    Given a layer "fw" declaring "skills", whose "skills/skills.json" declares a subgraph "voices" at "voices"
    When the layer's directories are resolved
    Then "voices" is within "skills" and resolves to "skills/voices" under the root
    And it is declared by "fw" and is own

  @test:schemas/cat-harness.test.ts::resolveDirectories_—_from-within_declarations::a_nested_entry_under_a_DEFAULT_parent_belongs_to_the_root_instance
  Scenario: A nested entry under a default parent belongs to the root instance
    Given a layer "fw" declaring nothing, whose default "skills/skills.json" declares a subgraph "voices"
    When the layer's directories are resolved
    Then "skills" is declared by "(default)"
    And "voices" is declared by "fw" and is own
