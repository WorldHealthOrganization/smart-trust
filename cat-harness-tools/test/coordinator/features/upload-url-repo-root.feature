# Specifies uploadUrl (scripts/upload-url.ts) for cat-harness as configured
# in this checkout.
Feature: cat-harness's upload URL resolves in this checkout

  @test:test/coordinator/upload-url-repo-root.test.ts::the_URL::resolves_for_this_instance
  Scenario: The upload URL resolves for cat-harness
    Given the cat-harness instance in the checkout
    When its upload URL is computed
    Then it resolves
