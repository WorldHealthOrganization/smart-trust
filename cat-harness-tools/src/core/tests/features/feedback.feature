# The feedback store of src/core/feedback.ts in the declared todos/ graph (keeping legacy
# .folio-feedback readable), the TodoTags its producers write, and the KgIndex they resolve
# against. Each Scenario names the test that executes it.
Feature: Feedback in the declared todos graph

  @test:src/core/tests/feedback.test.ts::FeedbackStore_declared_`todos/`_node_+_`.folio-feedback`_transition::resolves_the_declared_`todo-feedback`_directory_from_`todos/todos.json`
  Scenario: The feedback directory resolves to the declared todo-feedback node
    Given a repository with no todos graph
    Then no declared feedback directory resolves
    And once "todos/todos.json" is written, it resolves to "todos/feedback" from the repository root and from "todos"

  @test:src/core/tests/feedback.test.ts::FeedbackStore_declared_`todos/`_node_+_`.folio-feedback`_transition::writes_to_`todos/feedback`_while_still_reading_legacy_`.folio-feedback`_items
  Scenario: A store writes to todos/feedback while still reading legacy .folio-feedback items
    Given a repository with a todos graph and legacy items on def-1 and def-2 under ".folio-feedback/paper-a"
    When a feedback store is opened on ".folio-feedback"
    Then its directory is "todos/feedback", with ".folio-feedback" as a fallback
    And def-1 reads "todo-legacy-1", and all items are the two legacy ones
    And creating "todo-new-1" on def-1 with role "reviewer" tags it with that role and writes "todos/feedback/paper-a/def-1.json"
    And def-1 then reads the legacy item and the new one, without duplicates
    And all items are "todo-legacy-1", "todo-new-1", then "todo-legacy-2"

  @test:src/core/tests/feedback.test.ts::FeedbackStore_declared_`todos/`_node_+_`.folio-feedback`_transition::readFolioContentConfig_defaults_feedbackDir_to_the_declared_`todo-feedback`_node
  Scenario: The folio content config defaults feedbackDir to the declared todo-feedback node
    Given a repository with no todos graph
    Then its content config's feedbackDir is ".folio-feedback"
    And once a todos graph is written, it is "todos/feedback"

  @test:src/core/tests/feedback.test.ts::Feedback_producer_writes_real_`TodoTags`::createFeedbackItem_and_buildFeedbackTags_populate_roles,_processes,_tasks,_identities_and_references
  Scenario: Feedback producers populate roles, processes, tasks, identities, references and artefacts
    When a feedback item is created with an author, a github identity, an actor, two roles, a process, a task, a target label and a pull-request artefact
    Then its tags carry those roles, process and task
    And one identity, github "adalovelace" with the author's display name and the actor "admin"
    And a block reference to "lem:compactness" and the pull-request artefact
    And tags built from only an author and email carry an email identity "grace@navy.mil" and the role "author"

  @test:src/core/tests/feedback.test.ts::buildKgIndex_preserves_`undefined`_≠_empty_contract::absent_directories_yield_`undefined`_axes_so_`resolveTodoTags`_reports_`not-checked`
  Scenario: Absent directories give undefined axes, so tags resolve as not-checked
    Given an empty checkout
    When its KG index is built
    Then its roles, processes, tasks and actors are all undefined
    And tags with an identity, actor, role, process and task all resolve as "not-checked", none dangling

  @test:src/core/tests/feedback.test.ts::buildKgIndex_preserves_`undefined`_≠_empty_contract::present-but-empty_directories_yield_empty_Sets/Maps_so_`resolveTodoTags`_reports_`dangling`
  Scenario: Present but empty directories give empty sets, so tags resolve as dangling
    Given a checkout with an empty roles list, an empty actors directory and an empty processes directory
    When its KG index is built
    Then its roles, processes, tasks and actors are defined and empty
    And the same tags all resolve as "dangling", four of them

  @test:src/core/tests/feedback.test.ts::buildKgIndex_preserves_`undefined`_≠_empty_contract::populated_roles,_actors_and_BPMN_processes/tasks_resolve_known_tags_and_flag_unknown_ones
  Scenario: Populated roles, actors and BPMN processes and tasks resolve known tags and flag unknown ones
    Given a checkout with role "reviewer", actor "alice", and a process "Process_Review" with tasks "A_Triage" and "A_Verify"
    When its KG index is built
    Then it holds exactly those roles, actors, processes and tasks
    And tags naming alice, reviewer, Process_Review and A_Triage all resolve
    And tags naming actor "bob", role "unknown-role" and task "A_Missing" dangle as "role:unknown-role", "task:Process_Review▸A_Missing" and "actor:bob"
