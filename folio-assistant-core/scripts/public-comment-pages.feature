Feature: public comment and change-set pages

  @test:scripts/public-comment-pages.test.ts::a_change-set's_page::changeSetListsComments
  Scenario: lists each comment it answers, linked to the comment's own page, from its own harness only
    When a change-set's page is made
    Then its comments section links each comment's page, from its own harness only

  @test:scripts/public-comment-pages.test.ts::a_change-set's_page::missingReferenceSaid
  Scenario: says so when a reference names no comment, rather than dropping it
    When the change-set's page is read
    Then a reference naming no comment says it was not found

  @test:scripts/public-comment-pages.test.ts::the_change-set_dashboard::dashboardCountsOpen
  Scenario: counts the comments in an open change-set; a merged set no longer covers its comments
    When the change-set dashboard is made
    Then it counts one comment in an open change-set and two in none, listing them

  @test:scripts/public-comment-pages.test.ts::coverage_leaves_out_a_comment_whose_decision_changes_nothing::decidedNoChangeApart
  Scenario: noted and not-accepted are counted apart; an accepted comment still needs a change-set
    When the dashboard is made over noted, not-accepted and accepted comments
    Then noted and not-accepted are counted as decided with no change needed
    And the accepted comment still needs a change-set

  @test:scripts/public-comment-pages.test.ts::a_comment's_page::commentListsChangeSets
  Scenario: lists the change-sets it is in, with their status
    When a comment's page is made
    Then it lists its change-set with status merged

  @test:scripts/public-comment-pages.test.ts::a_comment's_page::commentInNone
  Scenario: and says when it is in none
    When the page of a comment in no change-set is made
    Then it says it is in no change-set yet
