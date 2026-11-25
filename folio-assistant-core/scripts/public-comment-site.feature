Feature: the public-comment dashboard and its links

  @test:scripts/public-comment-site.test.ts::public-comment-site::stagingSlugMatchesWorkflow
  Scenario: the staging slug is folio-staging.yml's
    When staging slugs are made
    Then "pc/1.1 definitions" gives pc-1.1-definitions and "--a//b--" gives a-b

  @test:scripts/public-comment-site.test.ts::public-comment-site::linksPointAtAnchor
  Scenario: before, after and PR links point at the anchor
    When a comment with an open PR is placed on the site
    Then it is editing in section 1.1
    And its document, before, after, PR, review and record links point at the anchor

  @test:scripts/public-comment-site.test.ts::public-comment-site::prLinksStagingReview
  Scenario: a comment or change-set with a pull request links its staging review page (owner, 2026-10-30)
    When staging review URLs are made and comments with change-sets are placed
    Then the URL is under the branch's staging site, or the given staging base, or undefined with neither
    And a change-set with an open PR links its staging review page from the row and the dashboard
    And a merged PR, or no PR information, links no staging review

  @test:scripts/public-comment-site.test.ts::public-comment-site::dashboardUnderLocale
  Scenario: the dashboard's page is under the locale and reads its records where they stay (#2527)
    When the dashboard is rendered under the locale
    Then it fetches its records from where they stay and links the document
    And a dashboard at the root fetches comments.json

  @test:scripts/public-comment-site.test.ts::public-comment-site::commentTextEscaped
  Scenario: comment text is escaped in the dashboard and cannot close the overlay's script
    When a comment whose summary closes a script is rendered
    Then the dashboard and the overlay do not carry it raw

  @test:scripts/public-comment-site.test.ts::public-comment-site::onlySafeHrefs
  Scenario: only http(s), relative and fragment URLs from the record become links
    When URLs are checked for linking
    Then http(s), relative and fragment URLs are kept
    And javascript:, data: and missing URLs are dropped
    And the dashboard links no javascript: URL but still shows the discussion, recommendation and committee move

  @test:scripts/public-comment-site.test.ts::public-comment-site::statusTypeEscapedInScript
  Scenario: a comment's status and type are escaped when the dashboard script lists a change-set's comments
    When the dashboard script lists a change-set's comments
    Then it escapes the status and type cells

  @test:scripts/public-comment-site.test.ts::public-comment-site::tilesAreToggles
  Scenario: the count tiles are toggles, and every row carries what they filter on (owner, 2026-10-05)
    When the dashboard is rendered
    Then each count tile is a toggle button
    And each row carries its phase, status and placement

  @test:scripts/public-comment-site.test.ts::public-comment-site::searchPreindexedDebounced
  Scenario: the dashboard script pre-indexes comments and debounces search input for fast filtering
    When the dashboard is rendered
    Then its script pre-indexes the comments, debounces search and only touches changed rows

  @test:scripts/public-comment-site.test.ts::public-comment-site::committeeRolledUp
  Scenario: each change-set shows its committee, rolled up from its comments' TWG routing (owner, 2026-10-13)
    When comments routed Clinical, Clinical and Core architects form a change-set with an unknown fourth
    Then the change-set shows Clinical, 2 of 4, with 1 not routed
    And there is a committee filter and each comment carries its committee

  @test:scripts/public-comment-site.test.ts::public-comment-site::reroutedShowsHistory
  Scenario: a manually re-routed change-set shows the new committee and its move history on the dashboard (bean se3i, issue #197)
    When a change-set re-routed by hand is rendered
    Then it shows the new committee marked rerouted, with its move history and who moved it

  @test:scripts/public-comment-site.test.ts::public-comment-site::editAndFeedbackPerComment
  Scenario: every comment has [edit] and [feedback], built in the page from its record (owner, 2026-10-13)
    When the dashboard is rendered with actions
    Then each comment carries edit and feedback links built from its record
    And without actions there is no edit link
