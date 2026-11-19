Feature: whether running a process is logged

  @test:scripts/tests/log-writer.test.ts::the_process_says_whether_running_it_is_logged::namedProcessesDeclareCapture
  Scenario: the three processes the owner named declare capture
    When crdm-requirements, editing-hci-validation and content-lifecycle are found and loaded
    Then each is found and declares log capture on

  @test:scripts/tests/log-writer.test.ts::the_process_says_whether_running_it_is_logged::unhonourableCaptureRefused
  Scenario: a capture value the engine cannot honour refuses to load
    When a process declaring capture "sometimes" is loaded
    Then it is refused saying that value is not implemented

  @test:scripts/tests/log-writer.test.ts::the_process_says_whether_running_it_is_logged::markingDidNotChangeEnforcement
  Scenario: marking a strict process did NOT change what it enforces
    When editing-hci-validation and content-lifecycle are loaded
    Then each is strict and no node calls the activity log process
