# Process_BeanDrain (bean-drain.bpmn) walked through src/workflow/instance.ts: build the queue, then
# per bean OPEN, work and CLOSE, then refill. Each Scenario names the test that executes it.
Feature: Bean drain process walk

  @test:scripts/tests/bean-drain-walk.test.ts::Process_BeanDrain_runs_OPEN_→_work_→_CLOSE_per_bean,_then_refills::calls_exactly_the_shared_OPEN_and_CLOSE
  Scenario: The drain calls exactly the shared OPEN and CLOSE processes
    Given the bean-drain.bpmn diagram
    When its process model is loaded
    Then the model id is "Process_BeanDrain"
    And its child processes are exactly Process_BeanClose and Process_BeanOpen

  @test:scripts/tests/bean-drain-walk.test.ts::Process_BeanDrain_runs_OPEN_→_work_→_CLOSE_per_bean,_then_refills::one_bean_through_OPEN_→_work_→_CLOSE,_then_a_refill,_a_second_bean,_and_the_queue_drained
  Scenario: Two beans go through OPEN, work and CLOSE, then the queue drains
    Given a drain instance started on the Process_BeanDrain model
    When the queue is built, a bean taken, opened, worked and walked through CLOSE
    Then the layer is not reported as only archive left
    And the instance is still running with only Drain_More enabled
    And after a refill and taking the next bean, Open_CheckExists is enabled again
    And after the second bean is opened, worked and closed, a refill that finds the queue empty completes the instance

  @test:scripts/tests/bean-drain-walk.test.ts::Process_BeanDrain_runs_OPEN_→_work_→_CLOSE_per_bean,_then_refills::a_bean_someone_else_holds_is_skipped,_not_worked,_and_the_drain_goes_on
  Scenario: A bean someone else holds is skipped and the drain goes on
    Given a drain instance that takes a bean which exists and is owned by someone else
    When OPEN leaves it alone and the claim gateway answers "not yours"
    Then only Drain_Skip is enabled
    And after the skip no Drain_Close child was started
    And the instance is still running with only Drain_More enabled
