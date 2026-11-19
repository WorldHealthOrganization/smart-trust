# What scripts/tests/kg/kg-criterion-scope.test.ts covers: each kg-qa criterion (schemas/sdlc/kg-qa.ts) declares whose
# corpus can answer it, and an instance run of scripts/kg-audit.ts says when it withheld one.
# Each Scenario names the test that executes it.
Feature: A criterion declares its scope and an instance run reports what it withheld

  @test:scripts/tests/kg/kg-criterion-scope.test.ts::every_criterion_has_decided_its_scope::each_scope_is_one_of_the_declared_vocabulary
  Scenario: Every criterion's scope is in the declared vocabulary
    Given every kg-qa criterion
    When its scope is read
    Then it is one of the declared criterion scopes

  @test:scripts/tests/kg/kg-criterion-scope.test.ts::every_criterion_has_decided_its_scope::it_found_criteria_at_all_—_otherwise_the_loops_above_prove_nothing
  Scenario: The criteria list is not empty
    Given the kg-qa criteria
    When they are counted
    Then there are more than 50
    And the by-id index has the same number of entries

  @test:scripts/tests/kg/kg-criterion-scope.test.ts::every_criterion_has_decided_its_scope::every_`repo`-scoped_criterion_carries_a_scopeBasis,_and_it_is_evidence_not_a_restatement
  Scenario: Every repo-scoped criterion carries a checkable scopeBasis
    Given the criteria scoped "repo", of which there is at least one
    When each one's scopeBasis is read
    Then it is longer than 80 characters
    And it names repoRootFor, the repository root, repository-level, or MEASURED

  @test:scripts/tests/kg/kg-criterion-scope.test.ts::every_criterion_has_decided_its_scope::an_`instance`-scoped_criterion_does_NOT_carry_a_scopeBasis
  Scenario: An instance-scoped criterion carries no scopeBasis
    Given the criteria scoped "instance"
    When each one's scopeBasis is read
    Then it is undefined

  @test:scripts/tests/kg/kg-criterion-scope.test.ts::the_auditor_acts_on_scope,_measured_by_running_it::an_instance_run_reports_ZERO_criticals_where_it_once_reported_76,_and_writes_nothing
  Scenario: An instance run reports zero criticals, says what it withheld, and writes nothing
    Given a snapshot of the files under bootstrap/test
    When kg-audit.ts is run with "--instance ./bootstrap --check"
    Then its summary reports more than 10 subjects
    And the output contains no "CRITICAL"
    And it says "instance run: bootstrap" with a count above zero of repo-scoped results recorded n/a
    And the files under bootstrap/test are unchanged
