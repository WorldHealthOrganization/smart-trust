Feature: checking the agent's feedback and status cells

  @test:tools/review-log-watch/lint.test.ts::feedbackProblems_(Q-FBK-1_A)::layoutPasses
  Scenario: the layout passes
    When well-laid-out feedback marked Needs human is checked
    Then there are no problems

  @test:tools/review-log-watch/lint.test.ts::feedbackProblems_(Q-FBK-1_A)::needsHumanWithoutQuestion
  Scenario: Needs human with no question is flagged (dth-hrh#81 to #85)
    When Needs human feedback without a Decision needed question is checked
    Then it is flagged

  @test:tools/review-log-watch/lint.test.ts::feedbackProblems_(Q-FBK-1_A)::buriedAskFlagged
  Scenario: a buried ask, history and a missing recommendation are flagged
    When feedback that buries its question, has history lines and no recommendation is checked
    Then each is flagged

  @test:tools/review-log-watch/lint.test.ts::feedbackProblems_(Q-FBK-1_A)::historyBelongsInDisposition
  Scenario: decision history belongs in Disposition (agent)
    When feedback holding a decision history line is checked
    Then it is told to move it to Disposition (agent)

  @test:tools/review-log-watch/lint.test.ts::prStateProblems::mergedPrRecordedOpen
  Scenario: a merged PR still recorded as open is flagged (CS-001)
    When a status says PR open for a merged PR
    Then it is flagged as merged on GitHub

  @test:tools/review-log-watch/lint.test.ts::prStateProblems::explainedStatusLeft
  Scenario: a status that says what happened is left alone
    When a status says the PR was reverted
    Then it is left alone

  @test:tools/review-log-watch/lint.test.ts::lint::lintJoinsTabs
  Scenario: joins the two tabs by Change-set
    When the feedback and agent tabs are linted together
    Then one finding is reported for CS-001

  @test:tools/review-log-watch/lint.test.ts::sectionProblems_(Q-FBK-3_A)::noSectionMustAsk
  Scenario: feedback with no section selected must ask which
    When feedback with no selected section is checked with and without a question asking which
    Then without the question it is flagged and with it it passes

  @test:tools/review-log-watch/lint.test.ts::sectionProblems_(Q-FBK-3_A)::prOutsideChaptersFlagged
  Scenario: a PR outside the selected chapters is flagged unless declared
    When a PR touches chapter 6 while chapter 5 is selected
    Then it is flagged unless the feedback declares it or the selection includes it
