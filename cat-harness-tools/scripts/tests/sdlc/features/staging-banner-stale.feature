# The staging banner client in scripts/staging-banner.ts asks GitHub for the branch head
# and says "stale" when it moved past the built commit, run here against fakes of the DOM
# and fetch. Each Scenario names the test that executes it.
Feature: Staging banner live staleness

  @test:scripts/tests/sdlc/staging-banner-stale.test.ts::staging_banner:_live_staleness::says_stale_when_the_branch_head_moved_past_the_built_commit
  Scenario: The banner says stale when the branch head moved past the built commit
    Given a preview of branch "claude/x y" built from "abc1234"
    And GitHub reports the branch head as "def5678…"
    When the banner client runs
    Then it asks "https://api.github.com/repos/o/r/commits/claude%2Fx%20y"
    And the stale note reads "⚠ stale: the branch is now at " followed by "def5678"

  @test:scripts/tests/sdlc/staging-banner-stale.test.ts::staging_banner:_live_staleness::says_nothing_when_the_head_is_the_built_commit,_or_GitHub_cannot_be_asked
  Scenario: The banner says nothing when the head is the built commit or GitHub cannot be asked
    Given a preview built from "abc1234"
    When GitHub reports "abc1234…" as the head, or the request fails, or it returns an HTML rate-limit page
    Then no stale note is shown in any of the three cases
