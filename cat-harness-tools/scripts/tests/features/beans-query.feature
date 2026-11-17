# scripts/beans-query.ts loads beans into an RDF store as N-Quads and answers named SPARQL queries
# over it, from code and from its command line. Each Scenario names the test that executes it.
Feature: Querying beans with SPARQL

  @test:scripts/tests/beans-query.test.ts::beans-query::beansToNQuads_converts_bean_nodes_to_valid_RDF_N-Quads
  Scenario: Bean nodes convert to N-Quads that load into an RDF store
    Given an epic "epic-1" with three child tasks, "child-1" blocking "child-2"
    When the beans are converted to N-Quads
    Then they hold the epic's subject IRI and its "in-progress" status and "epic" type
    And they hold a parent edge to the epic, a blocks edge to "child-2" and a blockedBy edge to "child-1"
    And loaded into an oxigraph store they give more than 15 quads

  @test:scripts/tests/beans-query.test.ts::beans-query::safe_drain_candidates_named_query_finds_leaves_with_>=_2_open_siblings
  Scenario: The safe_drain_candidates query finds leaves with at least two open siblings
    Given the epic and its three open child tasks loaded into a store
    When the safe_drain_candidates query runs
    Then it returns 3 rows: "child-1", "child-2" and "child-3"
    And the first row has 3 open siblings

  @test:scripts/tests/beans-query.test.ts::beans-query::actionable_leaves_named_query_excludes_blocked_leaves
  Scenario: The actionable_leaves query excludes blocked leaves
    Given the epic and its three child tasks loaded into a store
    When the actionable_leaves query runs
    Then "child-1", todo and unblocked, is included
    And "child-2", blocked by "child-1", is excluded
    And "child-3", in progress, is excluded

  @test:scripts/tests/beans-query.test.ts::beans-query::critical_path_blockers_counts_blocking_relationships
  Scenario: The critical_path_blockers query counts blocking relationships
    Given the epic and its three child tasks loaded into a store
    When the critical_path_blockers query runs
    Then it returns one row: blocker "child-1" blocking 1 bean

  @test:scripts/tests/beans-query.test.ts::beans-query::epic_burndown_aggregates_child_statuses_per_epic
  Scenario: The epic_burndown query aggregates child statuses per epic
    Given the epic and its three child tasks loaded into a store
    When the epic_burndown query runs
    Then it returns one row for "epic-1"
    And it has 3 children: 2 open, 1 in progress and 0 completed

  @test:scripts/tests/beans-query.test.ts::beans-query::unparented_open_tasks_finds_open_tasks_without_epic_or_milestone_parent
  Scenario: The unparented_open_tasks query finds open tasks without an epic or milestone parent
    Given the epic, its child tasks and a todo task "orphan-1" with no parent loaded into a store
    When the unparented_open_tasks query runs
    Then "orphan-1" is included
    And "epic-1" and "child-1" are not

  @test:scripts/tests/beans-query.test.ts::beans-query::circular_blockers_detects_mutual_deadlocks
  Scenario: The circular_blockers query detects mutual deadlocks
    Given tasks "lock-a" and "lock-b" each blocking the other, loaded into a store
    When the circular_blockers query runs
    Then it returns one row pairing "lock-a" with "lock-b"

  @test:scripts/tests/beans-query.test.ts::beans-query::buildBeanStore_loads_the_repository's_real_bean_store_cleanly
  Scenario: buildBeanStore loads the repository's real bean store cleanly
    Given this repository's bean store
    When the bean store is built
    Then it holds at least one bean
    And more quads than beans, all of them in the store
    And the active beans plus the archived beans number more than 500

  @test:scripts/tests/beans-query.test.ts::beans-query::CLI_--list_prints_available_named_queries
  Scenario: The command line lists the available named queries
    When beans-query.ts runs with "--list"
    Then it exits 0
    And it prints "Available Named Queries:" with "safe_drain_candidates", "actionable_leaves" and "circular_blockers"

  @test:scripts/tests/beans-query.test.ts::beans-query::CLI_--named_query_with_--format_ids_outputs_space_or_newline_separated_bean_IDs
  Scenario: A named query with the ids format prints whitespace-separated bean ids
    When beans-query.ts runs "--named safe_drain_candidates --format ids" on this repository
    Then it exits 0
    And it prints at least one id
    And the first id is lowercase letters, digits and hyphens

  @test:scripts/tests/beans-query.test.ts::beans-query::CLI_--named_query_with_--format_json_outputs_parseable_JSON_array
  Scenario: A named query with the json format prints a parseable JSON array
    When beans-query.ts runs "--named epic_burndown --format json" on this repository
    Then it exits 0
    And its output parses as a non-empty JSON array whose first row has "epicId"

  @test:scripts/tests/beans-query.test.ts::beans-query::CLI_--sparql_executes_arbitrary_SPARQL_1.1_query
  Scenario: An arbitrary SPARQL 1.1 query runs from the command line
    When beans-query.ts runs "--sparql" with a query counting every bean, in json format
    Then it exits 0
    And the output is a JSON array whose count is above 0
    And the count equals the number of beans buildBeanStore loads
