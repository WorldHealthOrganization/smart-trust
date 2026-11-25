# schemas/sdlc/health-report.js defines the pages-serving observation: what a CI job with egress saw
# of the published site, read offline by pages-publish-health.
# Each Scenario names the test that executes it.
Feature: The pages-serving observation schema

  @test:schemas/pages-serving.test.ts::PagesServingObservationSchema::a_dated_observation_of_at_least_one_URL_parses
  Scenario: A dated observation of one URL parses
    Given an observation dated "2026-10-11T06:00:00Z" of one URL with status 200
    When it is parsed
    Then it parses with 1 URL

  @test:schemas/pages-serving.test.ts::PagesServingObservationSchema::an_observation_of_nothing_is_refused_—_it_would_count_as_an_instrument_over_no_evidence
  Scenario: An observation with no URLs is refused
    Given the observation with an empty list of URLs
    When it is parsed
    Then parsing fails

  @test:schemas/pages-serving.test.ts::PagesServingObservationSchema::an_undated_observation_is_refused_—_staleness_is_judged_from_the_date
  Scenario: An observation without a valid date is refused
    Given the observation with "observedAt" removed
    Then parsing fails
    And with "observedAt" set to "yesterday" parsing fails

  @test:schemas/pages-serving.test.ts::PagesServingObservationSchema::Pages'_own_404_is_expressible_apart_from_the_status
  Scenario: A Pages 404 is recorded as not the expected page
    Given an observation of a URL with status 404 and "expectedPage" false
    When it is parsed
    Then the URL's "expectedPage" is false

  @test:schemas/pages-serving.test.ts::PagesServingObservationSchema::an_unknown_field_is_refused,_so_a_writer's_typo_cannot_pass_silently
  Scenario: An unknown field is refused
    Given the observation with an extra "observed_at" field
    When it is parsed
    Then parsing fails
