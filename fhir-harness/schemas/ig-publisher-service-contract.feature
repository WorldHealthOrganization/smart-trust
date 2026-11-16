Feature: The IG Publisher service contract: its role, actor, policy grant and capabilities

  @test:schemas/ig-publisher-service-contract.test.ts::the_role_is_mechanical,_and_its_contract_is_a_skill_it_carries::roleSystemOnlyCarriesContract
  Scenario: played only by a system Actor, carrying ig-publisher-service-contract
    Then the role is played only by system actors
    And the role carries the skill "ig-publisher-service-contract"

  @test:schemas/ig-publisher-service-contract.test.ts::the_role_is_mechanical,_and_its_contract_is_a_skill_it_carries::actorPlaysRoleWithCapabilities
  Scenario: the Actor named in the contract plays it, with both capabilities
    Then the actor is a system actor that plays "ig-publisher-service"
    And its capabilities include "ig-publisher" and "fhir-validator"

  @test:schemas/ig-publisher-service-contract.test.ts::1._build_a_FHIR_Implementation_Guide_and_report_its_QA::actorDescriptionSaysBuildAndQa
  Scenario: the actor's own description says so
    Then the actor's description mentions "FHIR IG Publisher build and QA reporting"

  @test:schemas/ig-publisher-service-contract.test.ts::1._build_a_FHIR_Implementation_Guide_and_report_its_QA::odrlGrantsQaReporting
  Scenario: ODRL grants it qa-reporting
    When the policy grants are read from the policies directory
    Then "ig-publisher-service" is granted "qa-reporting"

  @test:schemas/ig-publisher-service-contract.test.ts::2._complete_the_IG_Publisher_build_with_no_errors_in_qa.html,_after_SUSHI_has_compiled_the_FSH::publisherSatisfiesQaRequirement
  Scenario: the ig-publisher capability satisfies req:fhir-validation#ig-publisher-qa
    Then the ig-publisher capability satisfies "req:fhir-validation#ig-publisher-qa"

  @test:schemas/ig-publisher-service-contract.test.ts::2._complete_the_IG_Publisher_build_with_no_errors_in_qa.html,_after_SUSHI_has_compiled_the_FSH::qaStatementDemandsNoErrors
  Scenario: that statement demands no errors in qa.html, and depends on #sushi-compile
    Given the requirement statement "ig-publisher-qa"
    Then its text demands "no errors in qa.html"
    And it depends on "sushi-compile", which is also a statement

  @test:schemas/ig-publisher-service-contract.test.ts::3._validate_individual_resources_and_profiles_against_a_package_—_distinct_from_a_whole-IG_build::validatorIsSeparateCapability
  Scenario: fhir-validator is its own capability, and does not claim the whole-IG statement
    Then the validator capability has the id "fhir-validator", different from the publisher's
    And it does not satisfy "req:fhir-validation#ig-publisher-qa"

  @test:schemas/ig-publisher-service-contract.test.ts::4._be_detectable:_`--version`_/_`-version`_on_a_machine_with_a_Java_runtime::detectedByVersionCommand
  Scenario: each capability is detected by a command that asks the jar its version
    Then the publisher is detected by a command "java -jar <jar> --version"
    And the validator is detected by a command "java -jar <jar> -version"

  @test:schemas/ig-publisher-service-contract.test.ts::4._be_detectable:_`--version`_/_`-version`_on_a_machine_with_a_Java_runtime::bothRequireJavaRuntime
  Scenario: each requires java-runtime, which is itself a declared capability
    Then the publisher and the validator each require exactly "java-runtime"
    And "java-runtime" is a declared capability
