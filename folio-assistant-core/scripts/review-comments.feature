Feature: building the review comments of a pull request

  @test:scripts/review-comments.test.ts::buildReviewComments::writesTodoKindAndRest
  Scenario: writes the todo kind itself, with what was not ingested beside it
    When a tagged, an untagged and a malformed comment are built
    Then one review comment is written, one untagged and one malformed counted

  @test:scripts/review-comments.test.ts::buildReviewComments::appliesResolveOnce
  Scenario: applies `resolve:` decisions in the same build, once, and does not count them as conversation (423d)
    When a defect and an editor's addressed and resolved decisions, plus a reopen by its author, are built
    Then the comment is resolved naming the decision comment
    And no decision is counted as conversation and the reopen is malformed
    And building again over its own output changes nothing

  @test:scripts/review-comments.test.ts::buildReviewComments::writesNewlyDecided
  Scenario: writes each newly decided comment for the caller to commit, and nothing on a second run (423d)
    When the decided comments are written, then written again once committed
    Then the decided comment is written with its status and decision
    And the second time nothing is written

  @test:scripts/review-comments.test.ts::buildReviewComments::ingestsVerdicts
  Scenario: ingests verdicts from the same comments, and does not count them as untagged (px0t)
    When a verdict and a thank-you are built
    Then no comment is written, one verdict is recorded at the block's hash and one is untagged
    And the verdict is kept on a later build

  @test:scripts/review-comments.test.ts::buildReviewComments::pageVerdictAtPin
  Scenario: records a `page:` verdict against the build's pin, and refuses one the build cannot place (bnjs)
    When a page verdict and one on an unknown page are built
    Then the first is recorded at the build's pin and the second is malformed

  @test:scripts/review-comments.test.ts::buildReviewComments::idempotentKeepsStatus
  Scenario: is idempotent over its own output, and keeps a status the process set
    When the comments are built again over output whose status was moved
    Then the moved status is kept

  @test:scripts/review-comments.test.ts::buildReviewComments::followsRenameOrphans
  Scenario: follows a rename the next build makes, and orphans rather than drops
    When the block is renamed and then removed
    Then the comment follows the rename and is then orphaned, not dropped

  @test:scripts/review-comments.test.ts::the_command,_offline,_as_the_refresh_job_calls_it::commandWritesValidFile
  Scenario: reads --blocks and --comments, writes a valid review-comments.json, and re-runs cleanly
    When the command runs twice offline with blocks and comments
    Then both runs exit 0 and the file validates with one high-priority defect

  @test:scripts/review-comments.test.ts::the_command,_offline,_as_the_refresh_job_calls_it::refusesWithoutBlocks
  Scenario: refuses to run without a way to know the blocks
    When the command runs with no way to know the blocks
    Then it exits 2
