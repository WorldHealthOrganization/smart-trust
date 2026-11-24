# src/workflow/work-plan-store-select.ts picks the Tool that backs the work plan from the deployment
# description named by CAT_DEPLOYMENT; every wrong answer is a refusal with its reason, never the default store.
# Each Scenario names the test that executes it.
Feature: The deployment description chooses the work-plan store

  @test:scripts/tests/sdlc/work-plan-store-select.test.ts::the_schema::a_description_may_name_a_Tool_per_store_Role
  Scenario: A deployment description may name a Tool for the work-plan store role
    Given a deployment description whose stores map "work-plan" to "beans-git-branch"
    When it is validated against the deployment-description schema
    Then it is accepted

  @test:scripts/tests/sdlc/work-plan-store-select.test.ts::the_schema::and_must_name_it_by_id,_not_by_a_path_or_a_URL
  Scenario: A store Tool named by URL is rejected
    Given a deployment description whose stores map "work-plan" to "https://beans.example"
    When it is validated against the deployment-description schema
    Then it is rejected
    # Gap: only a URL is tried; a filesystem path is not checked.

  @test:scripts/tests/sdlc/work-plan-store-select.test.ts::workPlanStoreFor::CAT_DEPLOYMENT_unset:_the_git_branch,_as_every_checkout_today
  Scenario: With CAT_DEPLOYMENT unset the git-branch store is used
    Given an environment with no CAT_DEPLOYMENT
    When the work-plan store is chosen
    Then the tool is "beans-git-branch" with no deployment
    And the store is a mounted git-branch store

  @test:scripts/tests/sdlc/work-plan-store-select.test.ts::workPlanStoreFor::a_deployment_that_names_the_git_branch_gets_it
  Scenario: A deployment naming the git-branch store gets it
    Given a "dev" deployment description naming "beans-git-branch" for the work plan
    When the work-plan store is chosen with CAT_DEPLOYMENT "dev"
    Then the tool is "beans-git-branch" and the deployment is "dev"

  @test:scripts/tests/sdlc/work-plan-store-select.test.ts::workPlanStoreFor::a_deployment_that_names_no_work-plan_Tool_gets_the_default
  Scenario: A deployment naming no work-plan Tool gets the default
    Given a "dev" deployment description with no stores
    When the work-plan store is chosen with CAT_DEPLOYMENT "dev"
    Then the tool is "beans-git-branch"

  @test:scripts/tests/sdlc/work-plan-store-select.test.ts::workPlanStoreFor::a_deployment_naming_a_Tool_this_toolset_lacks_is_REFUSED_—_never_written_to_the_real_plan_instead
  Scenario: A deployment naming a Tool this toolset lacks is refused
    Given a "bench" deployment description naming "beans-run-scoped" for the work plan
    When the work-plan store is chosen with CAT_DEPLOYMENT "bench"
    Then it throws saying the toolset "does not implement" it and is "Refused"

  @test:scripts/tests/sdlc/work-plan-store-select.test.ts::workPlanStoreFor::an_id_no_description_has_is_refused
  Scenario: A deployment id with no description is refused
    Given only a "dev" deployment description
    When the work-plan store is chosen with CAT_DEPLOYMENT "prod"
    Then it throws "no deployment description"
