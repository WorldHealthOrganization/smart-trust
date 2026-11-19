# Specifies scanTriggers (src/core/workflow-events.ts) over the checkout's
# workflows for the pull_request event.
Feature: At least one of the checkout's workflows is required on pull_request

  @test:test/coordinator/workflow-events-workflows.test.ts::this_repository's_own_workflows::at_least_one_workflow_is_REQUIRED_on_pull_request
  Scenario: A pull_request scan reads every workflow and finds a required one
    Given the checkout's workflows
    When their pull_request triggers are scanned
    Then no workflow is unreadable
    And at least one trigger is "required"
