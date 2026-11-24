# Stores are drawn as data stores, not lanes: a store and a data object load
# without becoming steps, a step's reads and writes name the store by its Role
# id, and a reference or association that names nothing is refused.
Feature: Data stores are drawn, not walked

  @test:scripts/tests/process/data-stores.test.ts::a_store_is_drawn,_not_walked::a_store_declared_elsewhere_loads,_and_is_not_a_step
  Scenario: A store declared elsewhere loads and is not a step
    Given a process whose steps write to a data store reference "DSR_Plan" (dataStoreRef "work-plan", not declared in the file) and a data object "DOR_Draft"
    When it is loaded
    Then its nodes are exactly A_Open, A_Read, End_T and Start_T
    And its data stores are DSR_Plan (store "work-plan", not declared) and DOR_Draft

  @test:scripts/tests/process/data-stores.test.ts::a_store_is_drawn,_not_walked::a_store_declared_in_the_file_resolves_the_same_way
  Scenario: A store declared in the file resolves to the same store
    Given the same process with a <bpmn:dataStore id="work-plan"> in the file
    When it is loaded
    Then its first data store has store "work-plan" and is declared

  @test:scripts/tests/process/data-stores.test.ts::a_store_is_drawn,_not_walked::each_step_names_what_it_reads_and_writes,_a_store_by_its_Role_id
  Scenario: Each step names what it reads and writes
    Given the same process
    When it is loaded
    Then A_Open reads nothing and writes "work-plan"
    And A_Read reads "work-plan" and writes "DOR_Draft"
    And Start_T reads and writes nothing

  @test:scripts/tests/process/data-stores.test.ts::what_is_still_refused::a_store_reference_that_names_no_store
  Scenario: A store reference that names no store is refused
    Given the process with the data store reference's dataStoreRef removed
    When it is loaded
    Then loading rejects with UnsupportedBpmn saying it names no store

  @test:scripts/tests/process/data-stores.test.ts::what_is_still_refused::a_write_to_something_that_is_not_a_drawn_store_or_data_object
  Scenario: A write to a task is refused
    Given the process with A_Open's output association targeting the task A_Read
    When it is loaded
    Then loading rejects saying the target is not a data store or data object

  @test:scripts/tests/process/data-stores.test.ts::a_file_of_shared_stores_is_passed_by_like_a_global-tasks_file::no_process_and_a_bpmn:dataStore
  Scenario: A file of only a data store is a global-tasks file
    Given a definitions document holding a bpmn:dataStore and no process
    When it is classified
    Then it is a global-tasks file

  @test:scripts/tests/process/data-stores.test.ts::a_file_of_shared_stores_is_passed_by_like_a_global-tasks_file::a_process_file_with_a_store_is_still_a_process
  Scenario: A file with a data store and a process is not a global-tasks file
    Given a definitions document holding a bpmn:dataStore and a process
    When it is classified
    Then it is not a global-tasks file
