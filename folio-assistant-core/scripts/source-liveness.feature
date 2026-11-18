Feature: whether a catalogued source is still there

  @test:scripts/source-liveness.test.ts::probeLiveness::liveStatuses
  Scenario: 2xx and 3xx are live
    When 200 and 302 answers are probed
    Then both are live

  @test:scripts/source-liveness.test.ts::probeLiveness::goneStatuses
  Scenario: 404 and 410 are gone
    When 404 and 410 answers are probed
    Then both are gone

  @test:scripts/source-liveness.test.ts::probeLiveness::refusalCouldNotDetermine
  Scenario: a refusal, an error or no answer is could-not-determine — never live, never gone
    When 403, 401, 500 and no answer are probed
    Then each is could-not-determine

  @test:scripts/source-liveness.test.ts::probeLiveness::timeoutCouldNotDetermine
  Scenario: a timeout is could-not-determine
    When a probe times out
    Then it is could-not-determine

  @test:scripts/source-liveness.test.ts::probeSnapshot::snapshotFound
  Scenario: a closest available snapshot is found, with its URL
    When the archive answers with a closest snapshot
    Then it is found with its URL

  @test:scripts/source-liveness.test.ts::probeSnapshot::emptySnapshotNone
  Scenario: an empty answer is none
    When the archive answers with no snapshot
    Then it is none

  @test:scripts/source-liveness.test.ts::probeSnapshot::oddSnapshotCouldNotDetermine
  Scenario: no answer, or an odd one, is could-not-determine
    When the archive gives no answer, a 503 or an unexpected body
    Then each is could-not-determine

  @test:scripts/source-liveness.test.ts::over_the_real_who-iris_catalogue,_with_the_network_refused::refusedNetworkExits2
  Scenario: every node is could-not-determine, and the run exits 2 — not clean
    When the real catalogue is checked with the network refused
    Then every node is could-not-determine and the exit code is 2

  @test:scripts/source-liveness.test.ts::over_the_real_who-iris_catalogue,_with_the_network_refused::probedViaHandleElseHost
  Scenario: a node is probed through its Handle when it carries one, else through its host URL
    When the real catalogue is checked
    Then items are probed through their Handle
    And a container is probed through its Handle only when it has one

  @test:scripts/source-liveness.test.ts::over_the_real_who-iris_catalogue,_with_the_network_refused::oneGoneExits1
  Scenario: one gone node makes the run exit 1, whatever else is undetermined
    When one node answers 404 and the rest 200
    Then that node is gone and the exit code is 1

  @test:scripts/source-liveness.test.ts::over_the_real_who-iris_catalogue,_with_the_network_refused::allLiveExits0
  Scenario: all live exits 0
    When every node answers 200
    Then the exit code is 0

  @test:scripts/source-liveness.test.ts::destination_checks_and_redirect_validation_(bean_folio-core-xpsq)::refusesNonHttpsAndHosts
  Scenario: probeLiveness and probeSnapshot refuse non-https URLs and unexpected hosts
    When http and unexpected-host URLs are probed for liveness and snapshot
    Then each is could-not-determine with the reason

  @test:scripts/source-liveness.test.ts::destination_checks_and_redirect_validation_(bean_folio-core-xpsq)::safeFetcherRedirects
  Scenario: createSafeFetcher follows allowed https redirects and refuses redirects to http:// or unexpected hosts
    When a probe is redirected to an allowed https host, and to http
    Then the allowed redirect is followed and live
    And the http redirect is refused as could-not-determine
