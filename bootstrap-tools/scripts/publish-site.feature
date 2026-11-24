Feature: publish-site — any runner, any git remote (bootstrap-tools#7)

  Background:
    Given a fresh bare git remote whose gh-pages branch holds one stale file, stale.html
    And staged site directories built from the files each scenario names

  @test:scripts/publish-site.test.ts::publish-site_—_any_runner,_any_git_remote_(bootstrap-tools#7)::fullReplaceRemovesStale
  Scenario: a full replace: the staged site lands and a file it does not hold is gone
    When a site holding index.html and subgraph/v0/context.jsonld is published to the remote
    Then the result is published
    And gh-pages holds both files with their staged content
    And stale.html is gone

  @test:scripts/publish-site.test.ts::publish-site_—_any_runner,_any_git_remote_(bootstrap-tools#7)::republishIsCurrent
  Scenario: publishing the same site twice is `current`, not a second commit
    When the same site is published twice
    Then the first result is published
    And the second result is current

  @test:scripts/publish-site.test.ts::publish-site_—_any_runner,_any_git_remote_(bootstrap-tools#7)::refusesEmptySite
  Scenario: an empty or missing site is refused, never published over the branch
    When an empty site is published, and then a site directory that does not exist
    Then both fail
    And stale.html is still on gh-pages

  @test:scripts/publish-site.test.ts::publish-site_—_any_runner,_any_git_remote_(bootstrap-tools#7)::unreachableRemoteFails
  Scenario: an unreachable remote fails with a reason rather than throwing
    When a site is published to a remote that does not exist, with one attempt
    Then the result is failed

  @test:scripts/publish-site.test.ts::publish-site_—_any_runner,_any_git_remote_(bootstrap-tools#7)::intoReplacesSubtreeOnly
  Scenario: --into replaces only that subtree: the root and other previews stay
    When sites are published into STAGING/a and STAGING/b, and then a different site into STAGING/a again
    Then each publish succeeds
    And stale.html remains at the root
    And STAGING/b/index.html is unchanged
    And STAGING/a holds only the newer site's fresh.html, not its old index.html

  @test:scripts/publish-site.test.ts::publish-site_—_any_runner,_any_git_remote_(bootstrap-tools#7)::keepPreservesTopLevelPaths
  Scenario: --keep: a full replace keeps the named top-level paths, and the staged site cannot overwrite them
    Given a preview published into STAGING/p
    When a full site that also holds a STAGING/p/index.html is published keeping STAGING
    Then the result is published
    And the root index.html is the new one and stale.html is gone
    And STAGING/p/index.html is still the preview's

  @test:scripts/publish-site.test.ts::publish-site_—_any_runner,_any_git_remote_(bootstrap-tools#7)::refusesBadIntoOrKeep
  Scenario: an --into or --keep outside the branch, or both at once, is refused
    Then publishing into "../x", "/abs", ".", "a/../../b" or ".git" fails
    And keeping the nested path "a/b" fails
    And giving --into and --keep together fails
    And stale.html is still on gh-pages

  @test:scripts/publish-site.test.ts::publish-site_—_any_runner,_any_git_remote_(bootstrap-tools#7)::checksOutOnlyWrittenPaths
  Scenario: only what a publish writes is checked out: kept paths and other previews are not
    Then a full replace with nothing kept has no sparse patterns
    And publishing into "STAGING/a/" checks out only "/STAGING/a/"
    And keeping STAGING and branches checks out "/*" except "/STAGING/" and "/branches/"
