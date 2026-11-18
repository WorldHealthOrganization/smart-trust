# scripts/session-start-coord-sweep.sh, run for real against a local fixture remote, must refresh origin/<default> rather than trust a stale
# tracking ref, and must say when a narrowed fetch refspec hides sibling branches. Each Scenario names the test that executes it.
Feature: Session-start sweep refreshes the default branch

  @test:scripts/tests/fetch-tracking-ref.test.ts::session-start_sweep:_origin/<default>_must_be_refreshed,_not_assumed::reports_the_true_distance_when_the_clone's_refspec_is_narrowed
  Scenario: The sweep reports the true distance behind under a narrowed refspec
    Given a clone whose fetch refspec covers only "some-sibling"
    And upstream main then advances by 3 commits
    When the sweep runs in the clone
    Then it reports origin/main ahead by 3 commits

  @test:scripts/tests/fetch-tracking-ref.test.ts::session-start_sweep:_origin/<default>_must_be_refreshed,_not_assumed::reports_the_true_distance_under_a_normal_refspec_too
  Scenario: The sweep reports the true distance behind under a normal refspec
    Given a clone with the normal "refs/heads/*" fetch refspec
    And upstream main then advances by 2 commits
    When the sweep runs in the clone
    Then it reports origin/main ahead by 2 commits

  @test:scripts/tests/fetch-tracking-ref.test.ts::session-start_sweep:_origin/<default>_must_be_refreshed,_not_assumed::a_narrowed_refspec_is_named_as_blind,_not_reported_as_no_siblings
  Scenario: A narrowed refspec is named as hiding siblings
    Given a clone whose fetch refspec covers only "some-sibling"
    When the sweep runs in the clone
    Then it prints "Sibling branches: not visible from this clone"
    And it names "remote.origin.fetch"

  @test:scripts/tests/fetch-tracking-ref.test.ts::session-start_sweep:_origin/<default>_must_be_refreshed,_not_assumed::with_a_normal_refspec_the_sibling_branch_is_listed_and_no_warning_fires
  Scenario: A normal refspec lists the sibling branch without a warning
    Given a clone with the normal fetch refspec and an upstream branch "claude/sibling-work"
    When the sweep runs in the clone
    Then it lists "claude/sibling-work"
    And it does not print "not visible from this clone"
