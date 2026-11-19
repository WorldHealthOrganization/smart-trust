Feature: The ITI-108 Consent Registry read client

  @test:schemas/iti-108-consent-client.test.ts::ITI-108_Consent_Registry_read_client_(PCF7)::findsActiveIgnoresOthers
  Scenario: against a test FHIR server: finds active Consents and ignores expired, future, inactive, other-patient, and informational OperationOutcome entries
    Given a test FHIR server holding active, expired, future, inactive and other-patient Consents and an informational OperationOutcome
    When access consents are searched for a patient, actor and purpose with a bearer token
    Then the status is "determined"
    And the consents found are "consent-active-1" and "consent-active-open", the first at version "1" with the basic profile
    And the expired, future, inactive and other-patient Consents and the OperationOutcome are ignored, each with its reason
    And the request accepted FHIR JSON and carried the bearer token
    And the request searched by patient, status "active", actor and purpose

  @test:schemas/iti-108-consent-client.test.ts::ITI-108_Consent_Registry_read_client_(PCF7)::followsNextLinks
  Scenario: follows Bundle next links across pages when followNext is enabled
    Given a server that returns the Consents across two Bundle pages
    When the client searches for the patient
    Then the status is "determined"
    And the consents are "consent-page-1" and "consent-page-2" and the Bundle total is 2

  @test:schemas/iti-108-consent-client.test.ts::ITI-108_Consent_Registry_read_client_(PCF7)::emptyBundleIsDeterminedEmpty
  Scenario: returns determined with empty consents array when server returns an empty searchset Bundle
    Given a server that returns an empty searchset Bundle
    When consents are searched
    Then the status is "determined" with no consents, nothing ignored and a Bundle total of 0

  @test:schemas/iti-108-consent-client.test.ts::ITI-108_Consent_Registry_read_client_(PCF7)::connectionRefusedIsUnreachable
  Scenario: unreachable server (connection refused) gives status: unknown with reason: unreachable
    Given a local port whose server has been stopped
    When consents are searched there
    Then the status is "unknown" with the reason "unreachable"
    And the request URL contains "/Consent?"

  @test:schemas/iti-108-consent-client.test.ts::ITI-108_Consent_Registry_read_client_(PCF7)::slowServerIsTimeout
  Scenario: request timeout gives status: unknown with reason: timeout
    Given a slow endpoint and a 40 ms timeout
    When consents are searched
    Then the status is "unknown" with the reason "timeout"

  @test:schemas/iti-108-consent-client.test.ts::ITI-108_Consent_Registry_read_client_(PCF7)::http503IsHttpError
  Scenario: non-2xx HTTP status (503) gives status: unknown with reason: http-error and httpStatus
    Given an endpoint that answers 503
    When consents are searched
    Then the status is "unknown" with the reason "http-error" and the HTTP status 503

  @test:schemas/iti-108-consent-client.test.ts::ITI-108_Consent_Registry_read_client_(PCF7)::badJsonOrBundleIsUnknown
  Scenario: malformed JSON and non-searchset Bundles give status: unknown
    When consents are searched at endpoints answering malformed JSON, a Bundle of the wrong type, and an error OperationOutcome
    Then each status is "unknown"
    And the reasons are "invalid-json", "invalid-bundle" and "invalid-bundle"

  @test:schemas/iti-108-consent-client.test.ts::ITI-108_Consent_Registry_read_client_(PCF7)::buildsSearchUrlAndDateOnlyPeriod
  Scenario: buildIti108SearchUrl and date-only period boundary evaluation
    When a search URL is built with a patient, patient identifier, two actors, purpose, category, security label and profile
    Then its path is "/fhir/Consent" and it carries patient, patient.identifier, status "active", both actors and the profile
    Given a Consent whose permit period ends on the date "2026-10-30"
    Then it is not expired late on 2026-10-30 and is expired at the start of 2026-10-31
    And it is valid for "pat-1" late on 2026-10-30
