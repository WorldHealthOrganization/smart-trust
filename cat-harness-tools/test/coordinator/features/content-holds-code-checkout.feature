# Specifies contentInstanceCode and contentCodeFindings
# (scripts/content-holds-code.ts) over the checkout's instances.
Feature: A content instance holding code is a QA warning naming each file; other instances pass or are n/a

  @test:test/coordinator/content-holds-code-checkout.test.ts::contentInstanceCode_—_this_checkout::who-iris_is_a_QA_warning,_naming_its_IRIS-specific_code_files
  Scenario: who-iris is a minor finding naming its IRIS-specific code files
    Given the checkout holds who-iris (the test is skipped where it does not)
    When the code who-iris holds is judged
    Then the criterion "content-instance-holds-code" has severity "minor"
    And the verdict is "judged" and lists exactly the expected IRIS-specific files
    And the findings name exactly those files
    And none of them is one of the moved generic files

  @test:test/coordinator/content-holds-code-checkout.test.ts::contentInstanceCode_—_this_checkout::bootstrap_—_the_content_half_of_a_real_pair_—_passes
  Scenario: The bootstrap instance holds no code
    Given the checkout's bootstrap instance
    When the code it holds is judged
    Then the verdict is "judged" with no files

  @test:test/coordinator/content-holds-code-checkout.test.ts::contentInstanceCode_—_this_checkout::a_platform_instance_that_has_not_said_is_n/a
  Scenario: A platform instance that has not said is n/a
    Given the checkout's cat-harness instance
    When the code it holds is judged
    Then the verdict is "n/a"
