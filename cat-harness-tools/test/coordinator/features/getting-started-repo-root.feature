# Specifies derivePagesUrl (scripts/pages-bootstrap.ts) over this checkout's
# git remote.
Feature: The checkout's Pages address is derived from its git remote

  @test:test/coordinator/getting-started-repo-root.test.ts::pages-bootstrap_—_deriving_the_address::this_repo's_own_address_is_derived_from_the_remote
  Scenario: The checkout's Pages URL comes from the remote
    Given the checkout's instance root
    When its Pages URL is derived
    Then the URL is "https://litlfred.github.io/folio-assistant/"
    And its source is "git remote"
