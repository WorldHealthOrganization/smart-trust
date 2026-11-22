# src/routes/work-plan.ts serves GET /api/work-plan/beans-processed: the local work-plan store's
# process rows and unplaced items, to localhost only, and never an empty plan when the store cannot be read.
# Each Scenario names the test that executes it.
Feature: The local work-plan route

  @test:scripts/tests/sdlc/work-plan-route.test.ts::/api/work-plan/beans-processed::another_path_is_not_this_route's
  Scenario: Another path is not handled by the route
    When "http://localhost/api/other" is requested
    Then the route returns nothing

  @test:scripts/tests/sdlc/work-plan-route.test.ts::/api/work-plan/beans-processed::a_request_addressed_to_anything_but_localhost_is_refused:_the_work_plan_is_not_served_to_a_network
  Scenario: A request addressed to a non-localhost host is refused
    When the route is requested at host "192.168.1.5:8080"
    Then the status is 403

  @test:scripts/tests/sdlc/work-plan-route.test.ts::/api/work-plan/beans-processed::on_localhost_it_answers_the_rows,_the_beans_in_no_process,_and_which_store_Tool_it_read
  Scenario: On localhost the route answers the rows, the unplaced items and the store tool
    Given a store with "fx-aaaa" in the running instance "ccr--a" at "Task_Review" and "fx-bbbb" in no process
    When the route is requested at "localhost:8080"
    Then the status is 200 with cache-control "no-store"
    And the tool is "beans-git-branch"
    And the rows are instance "ccr--a" with tokens "Task_Review"
    And the unplaced items are "fx-bbbb"

  @test:scripts/tests/sdlc/work-plan-route.test.ts::/api/work-plan/beans-processed::a_localhost_origin_may_read_it_cross-origin;_any_other_origin_gets_no_CORS_header
  Scenario: Only a localhost origin gets a CORS header
    When the route is requested on localhost with origin "http://localhost:4000"
    Then access-control-allow-origin is "http://localhost:4000"
    And with origin "https://litlfred.github.io" there is no access-control-allow-origin header

  @test:scripts/tests/sdlc/work-plan-route.test.ts::/api/work-plan/beans-processed::a_store_that_cannot_be_chosen_is_503_with_the_reason,_never_an_empty_plan
  Scenario: A store that cannot be chosen answers 503 with the reason
    Given CAT_DEPLOYMENT is "nowhere"
    When the route is requested at "127.0.0.1:8080"
    Then the status is 503
    And the error names "CAT_DEPLOYMENT=nowhere"
