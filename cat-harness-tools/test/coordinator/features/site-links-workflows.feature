# Specifies, by reading docs-site.yml and feature-staging.yml, that both run
# the site-links checker over the built site.
Feature: Both publishing workflows check their own site's links

  @test:test/coordinator/site-links-workflows.test.ts::both_publishing_workflows_check_their_own_tiles::`docs-site.yml`_and_`feature-staging.yml`_each_verify_the_links
  Scenario: Both workflows run site-links.ts against ./_site
    Given docs-site.yml and feature-staging.yml
    When each is read
    Then it contains "scripts/site-links.ts"
    And it contains "--site ./_site"
