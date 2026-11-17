Feature: the processes that call the shared adjudication

  @test:scripts/tests/adjudication-marker.test.ts::the_split_—_bean_`bvuk`,_the_owner's_shape::callersDeclareOwnAnswers
  Scenario: the other four call the shared half, reach NO outcome task, and declare their OWN answers
    When refresh-materialized, translation-workflow, ingest-l1-completeness-gate and content-change-review-committee are loaded
    Then each adjudication step calls Process_Adjudication and declares its own answers
    And none of them reaches the scope-criterion or dispensation outcome task
