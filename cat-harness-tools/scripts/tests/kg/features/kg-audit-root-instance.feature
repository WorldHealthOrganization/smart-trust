# What scripts/tests/kg/kg-audit-root-instance.test.ts covers: scripts/kg-audit.ts audits the layer declared at the
# repository root, resolving the checkout with checkoutRootFor. Each Scenario names the test that executes it.
Feature: kg:audit over the layer declared at the repository root

  @test:scripts/tests/kg/kg-audit-root-instance.test.ts::kg:audit_over_the_instance_declared_at_the_repository_root_(bean_`pgzn`)::checkoutRootFor_resolves_the_root_instance_to_the_checkout,_where_repoRootFor_climbs_out
  Scenario: checkoutRootFor resolves the root layer to the checkout where repoRootFor climbs out
    # Skipped: unless run inside the aggregate checkout (inAggregate())
    Given the aggregate checkout root
    When its repository root is resolved both ways
    Then repoRootFor gives a different directory
    And checkoutRootFor gives the checkout itself, which holds a package.json
    And for the nested cat-harness layer both give the same directory

  @test:scripts/tests/kg/kg-audit-root-instance.test.ts::kg:audit_over_the_instance_declared_at_the_repository_root_(bean_`pgzn`)::`--instance_.`_emits_a_report_rather_than_throwing
  Scenario: Auditing --instance . emits a report rather than throwing
    Given the aggregate checkout root
    When kg-audit.ts is run with "--instance . --check --json"
    Then stderr has no "ENOENT"
    And stdout parses as JSON with at least one report
