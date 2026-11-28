# The certification-resolves audit (auditCertifications in scripts/test-plan-audit.ts) judges each filed
# certification: a certified decision, a held test plan and evidence that resolves. Each Scenario names the test that executes it.
Feature: Filed certifications resolve

  @test:scripts/tests/certification-resolves.test.ts::certification-resolves::nothing_filed_is_`n/a`,_never_a_pass_over_nothing
  Scenario: No filed certification is n/a
    Given the tiny test plan and no certification files
    When certifications are audited
    Then the result is "n/a"

  @test:scripts/tests/certification-resolves.test.ts::certification-resolves::a_certified_entry_naming_a_held_plan_and_present_evidence_passes
  Scenario: A certified entry naming a held plan with present evidence passes
    Given a certification file with one "certified" entry for "tiny-workflow-tool" whose evidence "reports/test-report.json" exists
    When certifications are audited
    Then the result is "pass" with no findings

  @test:scripts/tests/certification-resolves.test.ts::certification-resolves::FALSIFICATION:_a_refusal_filed_as_a_certification_fails
  Scenario: A refusal filed as a certification fails
    Given a certification entry whose decision is "refused"
    When certifications are audited
    Then the result is "fail"
    And the first finding's detail names "refused"

  @test:scripts/tests/certification-resolves.test.ts::certification-resolves::FALSIFICATION:_a_plan_no_declared_directory_holds_fails
  Scenario: A certification naming a plan no declared directory holds fails
    Given a certification entry for the test plan "no-such-plan"
    When certifications are audited
    Then the result is "fail"

  @test:scripts/tests/certification-resolves.test.ts::certification-resolves::FALSIFICATION:_a_certification_with_no_evidence_fails
  Scenario: A certification with no evidence fails
    Given a certification entry with no evidence
    When certifications are audited
    Then the result is "fail"

  @test:scripts/tests/certification-resolves.test.ts::certification-resolves::FALSIFICATION:_a_file_that_is_not_the_certification_family_fails
  Scenario: A file that does not match the certification family shape fails
    Given a qa-attestations file of family "certification" with no certifications list and a subject of kind "x" and no path
    When certifications are audited
    Then the result is "fail"

  @test:scripts/tests/certification-resolves.test.ts::certification-resolves::evidence_kept_on_qa-reports,_not_in_this_checkout,_is_`unknown`_—_never_a_pass
  Scenario: Evidence kept on qa-reports outside the checkout is unknown
    Given a certification entry whose evidence is "test/results/tests/x/y/r1/test-report.json", absent from the checkout
    When certifications are audited
    Then the result is "unknown"
    And the first finding's detail mentions "qa:fetch"
