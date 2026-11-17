# schemas/tools/tool.ts lets a Tool state remedies: what to reach for when a host refuses it.
# Covers the remedy schema, the gate on network Tools, and remediesFor. Each Scenario names the test that executes it.
Feature: Tool remedies for refused hosts

  @test:scripts/tests/tools/tool-remedies.test.ts::ToolRemedySchema::names_exactly_one_of_tool_or_none
  Scenario: A remedy names exactly one of tool or none
    Given ToolRemedySchema
    Then a remedy with a host and a tool parses
    And a remedy with a host and a none reason parses
    And a remedy with only a host is refused
    And a remedy with both a tool and a none is refused

  @test:scripts/tests/tools/tool-remedies.test.ts::ToolRemedySchema::a_host_is_a_bare_host_name,_not_a_URL
  Scenario: A remedy host is a bare host name, not a URL
    Given ToolRemedySchema
    Then the host "https://packages.fhir.org" is refused
    And the host "packages.fhir.org/x" is refused
    And the host "localhost" is refused

  @test:scripts/tests/tools/tool-remedies.test.ts::the_gate:_a_network_Tool_states_its_remedies::network:_true_with_no_remedies_is_reported;_with_remedies,_or_offline,_it_is_not
  Scenario: A network Tool with no remedies is reported
    Given Tools "bare" and "empty" needing the network with no or empty remedies
    And a network Tool "stated" with a remedy, an offline Tool and one with no requirement
    When networkToolsWithoutRemedies runs over them
    Then it reports exactly "bare" and "empty"

  @test:scripts/tests/tools/tool-remedies.test.ts::the_gate:_a_network_Tool_states_its_remedies::a_remedy_naming_no_declared_Tool_is_dangling
  Scenario: A remedy naming an undeclared Tool is dangling
    Given a Tool "sushi-ish" whose remedy for "packages.fhir.org" names the Tool "seeder"
    When danglingRemedies runs without a "seeder" Tool
    Then it reports the remedy with its Tool, host and remedy name
    And once "seeder" is declared it reports nothing

  @test:scripts/tests/tools/tool-remedies.test.ts::remediesFor_—_from_the_symptom_in_hand::a_bare_host_finds_its_Tool_and_the_Tool's_command
  Scenario: A bare host finds the remedy Tool and its command
    Given a Tool "ig" whose remedy for "packages.fhir.org" is the Tool "seeder"
    When remediesFor is asked about "packages.fhir.org"
    Then it returns one match needed by "ig" naming "seeder" and its invoke command "run-seeder"

  @test:scripts/tests/tools/tool-remedies.test.ts::remediesFor_—_from_the_symptom_in_hand::a_URL_or_a_pasted_error_line_containing_the_host_matches,_case-insensitively
  Scenario: A pasted error line holding the host in another case matches
    Given an error line containing "HTTPS://PACKAGES.FHIR.ORG/..." and a 403
    When remediesFor is asked about that line
    Then the matched remedy Tools are exactly "seeder"

  @test:scripts/tests/tools/tool-remedies.test.ts::remediesFor_—_from_the_symptom_in_hand::the_error_text_matches_when_the_host_is_not_in_the_message
  Scenario: A remedy's error text matches when the host is absent from the message
    Given a Tool "lean" whose remedy carries the error text "Host not in allowlist"
    When remediesFor is asked about "403 Host not in allowlist"
    Then the only match is needed by "lean"

  @test:scripts/tests/tools/tool-remedies.test.ts::remediesFor_—_from_the_symptom_in_hand::a_stated_none_is_an_answer,_not_an_absence
  Scenario: A stated none is returned as an answer
    Given a Tool "ig" whose remedy for "tx.fhir.org" is none, "no terminology server here"
    When remediesFor is asked about "tx.fhir.org"
    Then it returns that none reason, needed by "ig"

  @test:scripts/tests/tools/tool-remedies.test.ts::remediesFor_—_from_the_symptom_in_hand::an_unrelated_host_matches_nothing
  Scenario: An unrelated host matches no remedy
    When remediesFor is asked about "example.org"
    Then it returns no matches
