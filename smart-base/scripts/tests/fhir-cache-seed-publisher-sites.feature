Feature: smart-base publisher-site rules for fhir-cache-seed-npm
  smart-base supplies the smart.who.int. publisher-site rule to fhir-harness's
  package-cache seeder and passes it on the seeder's command line.

  @test:smart-base/scripts/tests/fhir-cache-seed-publisher-sites.test.ts::smart-base_publisher-site_rules_for_fhir-cache-seed-npm::suppliesWhoPublisherSiteRule
  Scenario: the WHO rule is supplied, naming the repository the seeder used before #2436
    Given smart-base's publisher-site repositories
    Then the rule for "smart.who.int." is "WorldHealthOrganization/smart-html@main"

  @test:smart-base/scripts/tests/fhir-cache-seed-publisher-sites.test.ts::smart-base_publisher-site_rules_for_fhir-cache-seed-npm::passesRuleAsSiteRepoArguments
  Scenario: the rule is passed as the seeder's --site-repo PREFIX=OWNER/REPO[@BRANCH] arguments
    When the seeder arguments are built from the rules
    Then they are exactly "--site-repo" and "smart.who.int.=WorldHealthOrganization/smart-html@main"

  @test:smart-base/scripts/tests/fhir-cache-seed-publisher-sites.test.ts::smart-base_publisher-site_rules_for_fhir-cache-seed-npm::toolInvokesSeederWithRule
  Scenario: the smart-base Tool invokes the seeder with the rule
    Given the smart-base Tool "smart-fhir-cache-seed"
    Then its shell command runs "fhir-harness/scripts/fhir-cache-seed-npm.ts"
    And it passes "--site-repo smart.who.int.=WorldHealthOrganization/smart-html@main"
