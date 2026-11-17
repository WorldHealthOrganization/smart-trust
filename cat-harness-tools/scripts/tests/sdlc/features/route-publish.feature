# publishRoute in scripts/branch-store.ts publishes a route-keyed directory from the working tree
# to its branch, replacing it wholesale; tested on real git repositories with a bare file:// remote.
# Each Scenario names the test that executes it.
Feature: Publishing a route-keyed directory

  @test:scripts/tests/sdlc/route-publish.test.ts::publishRoute_replaces_the_route_WHOLESALE::a_path_the_checkout_no_longer_holds_is_REMOVED_from_the_branch
  Scenario: A path the checkout no longer holds is removed from the branch
    Given a route-keyed branch holding "a.md" and "gone.md", and a checkout holding only the same "a.md"
    When the route is published
    Then the state is "pushed" with 0 written, 1 deleted and 1 unchanged
    And "gone.md" is no longer on the branch
    And "a.md" is still on the branch, unchanged

  @test:scripts/tests/sdlc/route-publish.test.ts::publishRoute_replaces_the_route_WHOLESALE::changed_and_new_files_are_written;_byte-identical_ones_are_not_in_the_push_at_all
  Scenario: Changed and new files are written, and byte-identical ones are left out of the push
    Given a branch holding "a.md" and "same.md", and a checkout with a changed "a.md", the same "same.md" and a new "new.md"
    When the route is published
    Then the state is "pushed" with 2 written, 0 deleted and 1 unchanged
    And the branch holds the new "a.md" and "new.md"

  @test:scripts/tests/sdlc/route-publish.test.ts::publishRoute_replaces_the_route_WHOLESALE::nothing_to_do_is_`unchanged`,_and_the_tip_does_not_move
  Scenario: Nothing to do is unchanged and the tip does not move
    Given a branch and a checkout holding the same "a.md"
    When the route is published
    Then the state is "unchanged"
    And the branch tip is the same commit as before

  @test:scripts/tests/sdlc/route-publish.test.ts::what_it_refuses,_naming_the_reason::a_TIP-keyed_directory_—_refused_by_the_DECLARATION's_keying,_not_by_the_branch's
  Scenario: A tip-keyed directory is refused by the declaration's keying
    Given a declaration and branch manifest both keyed by "tip", and a changed "a.md" in the checkout
    When the route is published
    Then the state is "refused"
    And the reason names "directory uml-pages" and says "not route"

  @test:scripts/tests/sdlc/route-publish.test.ts::what_it_refuses,_naming_the_reason::a_COMMIT-keyed_directory_—_the_case_only_the_declaration_guard_can_reach
  Scenario: A commit-keyed directory is refused by the declaration guard
    Given a declaration and branch manifest keyed by "commit", and a changed "a.md" in the checkout
    When the route is published
    Then the state is "refused"
    And the reason names "directory uml-pages"

  @test:scripts/tests/sdlc/route-publish.test.ts::what_it_refuses,_naming_the_reason::a_route_the_checkout_does_not_hold_—_a_route_is_published_FROM_the_working_tree
  Scenario: A route missing from the checkout is refused, since a route is published from the working tree
    Given a route-keyed branch and a checkout whose route directory has been deleted
    When the route is published
    Then the state is "refused"

  @test:scripts/tests/sdlc/route-publish.test.ts::no_`expect`_is_ever_sent,_which_is_what_route_keying_means::a_sibling's_write_to_ANOTHER_path_survives,_and_to_the_SAME_path_is_overwritten
  Scenario: A sibling's write to another route survives, and to the same path is overwritten
    Given a route-keyed branch holding "a.md", a checkout with a changed "a.md"
    And a sibling push that adds "x.md" under another route "docs/uml/other" on the same branch
    And a sibling push that rewrites the route's "a.md" behind the publisher's back
    And a sibling push that adds "sibling.md" under the route behind the publisher's back
    When the route is published
    Then the state is "pushed"
    And the other route's "x.md" is still on the branch, unchanged
    And the branch holds the checkout's "a.md", not the sibling's
    And "sibling.md" is no longer on the branch, since the route is replaced wholesale

  @test:scripts/tests/sdlc/route-publish.test.ts::the_checkout's_ignore_rules_are_honoured::a_gitignored_file_under_the_route_is_not_published
  Scenario: A gitignored file under the route is not published
    Given an empty route branch and a checkout holding "a.md" and "logs/run.txt", with the route's "logs/" gitignored
    When the route is published
    Then the state is "pushed"
    And the branch holds "a.md"
    And "logs/run.txt" is not on the branch
