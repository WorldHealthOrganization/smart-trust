# Specifies findContentRepoRoot, readEffectiveConfig,
# readDeclaredFolioProfile and folioOptionalAxes over the real checkout: the
# content root and its index.config.json entry agree.
Feature: The checkout's content root and its config agree

  @test:test/coordinator/repo-config-agreement.test.ts::this_repository's_content_root_and_its_config_agree_—_bean_`zkgs`::the_content_root_resolves_to_its_index_entry,_not_to_nothing
  Scenario: The content root resolves to its index entry
    Given the content root found from the checkout
    When its effective config is read
    Then its state is "ok"
    And it comes via "index"
    And it is from an index.config.json entry

  @test:test/coordinator/repo-config-agreement.test.ts::this_repository's_content_root_and_its_config_agree_—_bean_`zkgs`::the_declared_profile_is_`document`,_never_the_third_state
  Scenario: The declared profile is document
    Given the content root
    When its declared folio profile is read
    Then the profile is "document"
    And it is not declared "undetermined"

  @test:test/coordinator/repo-config-agreement.test.ts::this_repository's_content_root_and_its_config_agree_—_bean_`zkgs`::`cat-harness/`_resolves_to_its_OWN_entry,_not_another_instance's
  Scenario: cat-harness resolves to its own index entry
    Given the cat-harness directory beside the content root
    When its effective config and declared profile are read
    Then the config state is "ok" and is from the entry "cat-harness"
    And the profile is "document", declared by the entry "cat-harness", not "undetermined"

  @test:test/coordinator/repo-config-agreement.test.ts::this_repository's_content_root_and_its_config_agree_—_bean_`zkgs`::the_optional-axes_reader_reads_where_the_config_actually_is
  Scenario: The optional QA axes are the content root's entry's qaAxes
    Given the content root's effective config
    When the folio's optional axes are read
    Then the config state is "ok"
    And the axes equal the entry's qaAxes, or none where it declares none
