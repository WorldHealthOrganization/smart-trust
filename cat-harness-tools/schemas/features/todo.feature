# The todo schema (schemas/sdlc/todo.ts, schemas/constraints.ts): tag shapes, resolving a todo's KG tags
# to resolved, dangling or not-checked, and the declared-not-guessed theme field.
# Each Scenario names the test that executes it.
Feature: Todo tags, KG resolution and themes

  @test:schemas/todo.test.ts::tag_shapes::a_task_reference_is_a_PAIR,_never_a_bare_id
  Scenario: A task reference must name both its process and its task
    Given a task reference with only the task "A_Implement"
    When TaskRefSchema parses it
    Then the parse throws
    And a reference with process "Process_CRDM" and task "A_Implement" parses

  @test:schemas/todo.test.ts::tag_shapes::an_identity_is_provider-qualified
  Scenario: An external identity must name its provider
    Given an identity with only the id "litlfred"
    When ExternalIdentitySchema parses it
    Then the parse throws
    And an identity with provider "github" and id "litlfred" parses

  @test:schemas/todo.test.ts::tag_shapes::the_actor_link_is_optional_—_an_outside_person_is_still_a_person
  Scenario: An identity parses without an actor link
    Given an identity with provider "github" and id "drive-by" and no actor
    When ExternalIdentitySchema parses it
    Then the parse succeeds
    And its actor is undefined

  @test:schemas/todo.test.ts::tag_shapes::every_tag_axis_defaults_to_an_empty_array
  Scenario: An empty tags object defaults every axis to an empty array
    Given an empty tags object
    When TodoTagsSchema parses it
    Then the result is exactly roles, processes, tasks, identities, references and artefacts, each an empty array

  @test:schemas/todo.test.ts::tag_shapes::several_people_can_be_tagged_on_ONE_todo
  Scenario: One todo can tag several identities
    Given tags naming the github identities "a" and "b"
    When TodoTagsSchema parses them
    Then the parsed identities number 2

  @test:schemas/todo.test.ts::tag_shapes::references_point_at_a_declared_node_kind,_and_an_undeclared_one_is_refused
  Scenario: References must name a declared node kind
    Given references to the skill "todo-review" and the bean "x" with note "why"
    When TodoTagsSchema parses them
    Then 2 references are kept
    And the second reference's note is "why"
    And a reference of kind "some-future-kind" fails to parse

  @test:schemas/todo.test.ts::tag_shapes::a_todo_file_declares_what_it_is
  Scenario: A todo node must carry its schema declaration
    Given a todo node with id, summary, status, priority, origin and createdAt but no $schema
    When TodoNodeSchema parses it
    Then the parse throws
    And the same node with $schema set to TODO_SCHEMA_TAG parses
    And its roles tag defaults to an empty array

  @test:schemas/todo.test.ts::resolution_against_the_knowledge_graph::a_known_role,_process_and_task_all_resolve
  Scenario: Known role, process and task tags all resolve
    Given a KG index with role "editor", process "Process_CRDM" and its task "A_Implement"
    When tags naming those three are resolved against it
    Then every result is "resolved"
    And no tag is dangling

  @test:schemas/todo.test.ts::resolution_against_the_knowledge_graph::an_unknown_role_dangles
  Scenario: An unknown role dangles
    Given the KG index
    When the role "no-such-role" is resolved
    Then its state is "dangling"

  @test:schemas/todo.test.ts::resolution_against_the_knowledge_graph::a_task_in_a_process_the_index_does_not_know_DANGLES,_not_not-checked
  Scenario: A task in a process missing from a read index dangles
    Given the KG index, which does not contain "Process_Ghost"
    When the task "A_X" of "Process_Ghost" is resolved
    Then its state is "dangling"

  @test:schemas/todo.test.ts::resolution_against_the_knowledge_graph::a_task_that_is_not_an_activity_of_its_named_process_dangles
  Scenario: A task that is not an activity of its process dangles
    Given the KG index with process "Process_CRDM"
    When the task "A_Nope" of "Process_CRDM" is resolved
    Then its state is "dangling"

  @test:schemas/todo.test.ts::resolution_against_the_knowledge_graph::the_task_ref_names_its_process,_so_the_finding_is_actionable
  Scenario: A dangling task's ref names both process and task
    Given the KG index
    When the task "A_Nope" of "Process_CRDM" is resolved
    Then the result's ref contains "Process_CRDM"
    And it contains "A_Nope"

  @test:schemas/todo.test.ts::not-checked_is_a_third_state_and_never_collapses::an_unreadable_role_index_reports_not-checked,_NOT_dangling
  Scenario: Roles against an unreadable role index are not-checked
    Given an empty KG index object with no roles set
    When the roles "editor" and "ghost" are resolved
    Then both states are "not-checked"
    And no tag is dangling

  @test:schemas/todo.test.ts::not-checked_is_a_third_state_and_never_collapses::an_unreadable_task_index_reports_not-checked
  Scenario: A task against an unreadable task index is not-checked
    Given a KG index with only an empty roles set
    When the task "T" of process "P" is resolved
    Then its state is "not-checked"

  @test:schemas/todo.test.ts::not-checked_is_a_third_state_and_never_collapses::an_EMPTY_index_is_a_determined_empty,_so_its_tags_dangle
  Scenario: A role against an empty but read role index dangles
    Given a KG index whose roles set is empty
    When the role "editor" is resolved
    Then its state is "dangling"

  @test:schemas/todo.test.ts::not-checked_is_a_third_state_and_never_collapses::an_UNLINKED_identity_is_not_checked_and_not_dangling
  Scenario: An identity with no actor link yields no result
    Given the KG index
    When the github identity "drive-by" with no actor is resolved
    Then the result list is empty

  @test:schemas/todo.test.ts::not-checked_is_a_third_state_and_never_collapses::a_LINKED_identity_naming_an_unknown_actor_dangles
  Scenario: A linked identity naming an unknown actor dangles
    Given the KG index with actor "admin"
    When a github identity linked to actor "no-such-actor" is resolved
    Then the result is axis "actor", ref "no-such-actor", state "dangling"

  @test:schemas/todo.test.ts::not-checked_is_a_third_state_and_never_collapses::buildKgIndex_reads_the_live_harness_roles,_processes,_tasks_and_actors,_and_returns_undefined_for_absent_directories_(bean_c4rz)
  Scenario: buildKgIndex reads the live harness and leaves absent indexes undefined
    Given the harness root
    When buildKgIndex reads it
    Then roles, processes, tasks and actors are each defined and non-empty
    When buildKgIndex reads a nonexistent directory
    Then roles, processes, tasks and actors are each undefined
    And resolving a role, process and task against that index gives "not-checked" for all

  @test:schemas/todo.test.ts::a_todo's_theme_—_declared,_defaulted,_and_never_guessed::the_store_declares_a_default,_and_it_is_a_real_theme
  Scenario: The todo store declares a default theme that exists
    Given the todo store
    When todoDefaultTheme is read
    Then it is defined
    And themeById finds a theme with that id

  @test:schemas/todo.test.ts::a_todo's_theme_—_declared,_defaulted,_and_never_guessed::every_theme_a_todo_names_exists
  Scenario: Every theme named by a real todo exists
    Given the todos read from the store
    When each declared theme is looked up with themeById
    Then no theme is missing

  @test:schemas/todo.test.ts::a_todo's_theme_—_declared,_defaulted,_and_never_guessed::every_theme_a_todo_names_can_actually_BACK_a_sticky
  Scenario: Every theme named by a real todo has a complete backdrop
    Given the todos read from the store and the harness declaration's images
    When each declared theme's backdrop is resolved
    Then no todo's theme has missing images

  @test:schemas/todo.test.ts::a_todo's_theme_—_declared,_defaulted,_and_never_guessed::a_todo's_OWN_theme_is_kept_unresolved_—_the_default_is_applied_later
  Scenario: Parsing a todo with no theme does not fill in the default
    Given a todo node fixture with no theme
    When TodoNodeSchema parses it
    Then the parsed theme is undefined

  @test:schemas/todo.test.ts::a_todo's_theme_—_declared,_defaulted,_and_never_guessed::a_theme_id_that_is_not_kebab-case_is_refused
  Scenario: A theme id that is not kebab-case is refused
    Given a todo node with theme "Grumpy Cat"
    When TodoNodeSchema parses it
    Then the parse fails

  @test:schemas/todo.test.ts::a_todo_declares_its_theme_rather_than_having_one_inferred_(bean_`5y4b`)::the_field_is_OPTIONAL_—_absent_means_the_instance's_own_theme
  Scenario: A todo item without a theme parses with no theme
    Given a todo item with no theme
    When TodoItemSchema parses it
    Then the parse succeeds
    And the theme is undefined

  @test:schemas/todo.test.ts::a_todo_declares_its_theme_rather_than_having_one_inferred_(bean_`5y4b`)::a_declared_theme_survives_the_parse
  Scenario: A declared theme is kept by the parse
    Given a todo item with theme "library"
    When TodoItemSchema parses it
    Then the parse succeeds
    And the theme is "library"

  @test:schemas/todo.test.ts::a_todo_declares_its_theme_rather_than_having_one_inferred_(bean_`5y4b`)::an_unknown_theme_PARSES_—_it_is_a_rendering_finding,_not_a_parse_error
  Scenario: An unknown theme id still parses
    Given a todo item with theme "no-such-theme"
    When TodoItemSchema parses it
    Then the parse succeeds

  @test:schemas/todo.test.ts::a_todo_declares_its_theme_rather_than_having_one_inferred_(bean_`5y4b`)::an_empty_theme_is_refused_—_absent_and_blank_are_different_claims
  Scenario: An empty theme string is refused
    Given a todo item with theme ""
    When TodoItemSchema parses it
    Then the parse fails
