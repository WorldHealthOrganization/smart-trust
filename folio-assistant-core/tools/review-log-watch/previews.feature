Feature: keeping review previews current with main

  @test:tools/review-log-watch/previews.test.ts::previewSteps:_previews_follow_main::behindMergedUp
  Scenario: a PR behind main is merged up so its preview rebuilds
    When a PR three commits behind main is planned
    Then its step is to merge main up

  @test:tools/review-log-watch/previews.test.ts::previewSteps:_previews_follow_main::conflictNamed
  Scenario: a conflict is named, not hidden as behind
    When a PR behind with conflicts is planned
    Then its step is to resolve the conflict

  @test:tools/review-log-watch/previews.test.ts::previewSteps:_previews_follow_main::currentNoneClosedForkOut
  Scenario: current PRs need nothing; closed and fork PRs are left out
    When a current PR, a closed PR and a fork PR are planned
    Then only the current one is listed, needing nothing

  @test:tools/review-log-watch/previews.test.ts::previewRequest:_people_ask_for_a_current_preview::asksFound
  Scenario: asks are found
    When requests to update the preview, staging or rebase are read
    Then each is an ask

  @test:tools/review-log-watch/previews.test.ts::previewRequest:_people_ask_for_a_current_preview::otherFeedbackNotAsk
  Scenario: other feedback is not an ask
    When feedback about the glossary or a good preview is read
    Then neither is an ask

  @test:tools/review-log-watch/previews.test.ts::refresh_mode_(owner,_07:34Z:_automatic_as_the_default)::automaticUnlessOnFeedback
  Scenario: automatic unless the Config says on-feedback
    When the refresh mode is read from no, empty and on-feedback config
    Then it is automatic unless on-feedback
    And automatic always checks and on-feedback checks only on feedback
