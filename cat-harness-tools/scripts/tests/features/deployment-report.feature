# scripts/lib/role-isa.ts builds the role IS-A relation the deployment report hands the resolver,
# from each role's inherits list. Each Scenario names the test that executes it.
Feature: The deployment report's role IS-A closure

  @test:scripts/tests/deployment-report.test.ts::isAFrom::follows_inherits_transitively
  Scenario: A role is a role it inherits from, directly or transitively
    Given roles "viewer", "reviewer" inheriting "viewer", and "qc-reviewer" inheriting "reviewer"
    When IS-A is built from them
    Then "qc-reviewer" is a "reviewer"
    And "qc-reviewer" is a "viewer"

  @test:scripts/tests/deployment-report.test.ts::isAFrom::never_upward,_and_never_itself
  Scenario: IS-A never runs upward and never relates a role to itself
    Given roles "viewer", "reviewer" inheriting "viewer", and "qc-reviewer" inheriting "reviewer"
    When IS-A is built from them
    Then "viewer" is not a "reviewer"
    And "reviewer" is not a "reviewer"

  @test:scripts/tests/deployment-report.test.ts::isAFrom::no_graph_is_no_IS-A
  Scenario: No role graph gives no IS-A relation
    Given no role graph
    When IS-A is built from it
    Then "reviewer" is not a "viewer"
