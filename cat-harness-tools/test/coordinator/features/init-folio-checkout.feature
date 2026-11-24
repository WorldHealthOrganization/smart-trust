# Specifies initFolio and remotePlatformLayers (scripts/init-folio.ts) over
# the adapters this checkout holds: the scaffolded config's adapter module and
# dependencies, and the derived remote mounts.
Feature: A scaffolded folio names its adapter and what it stands on, from the checkout's declarations

  @test:test/coordinator/init-folio-checkout.test.ts::what_gets_written::the_config_selects_the_adapter_matching_the_content_type
  Scenario: The config selects the adapter for its content type
    Given a folio scaffolded as "document" and another as "paper", linked at "folio-assistant"
    When their inline configs in index.config.json are read
    Then the document config's adapter module is "./folio-assistant/folio-assistant-core/adapters/document/index.ts", with no ".."
    And the paper config's adapter module is "./folio-assistant/folio-assistant-sci/adapters/paper/index.ts"

  @test:test/coordinator/init-folio-checkout.test.ts::what_gets_written::the_adapter_path_is_normalised,_and_a_non-default_link_path_is_honoured
  Scenario: The adapter path is normalised under a non-default link path
    Given a paper folio scaffolded with the platform at "vendor/fa"
    When its config is read
    Then its adapter module is "./vendor/fa/folio-assistant-sci/adapters/paper/index.ts"
    And it contains no ".."

  @test:test/coordinator/init-folio-checkout.test.ts::a_scaffold_says_what_it_stands_on_(zmdo)::a_document_folio_stands_on_its_adapter's_instance,_folio-assistant-core
  Scenario: A document folio stands on folio-assistant-core
    Given a document folio scaffolded at "folio-assistant"
    When its config's dependencies are read
    Then they name folio-assistant-core at "folio-assistant/folio-assistant-core"
    And with the checkout linked at "folio-assistant", its declaration chain includes folio-assistant-core and cat-harness
    And its skill roots include "folio-assistant-core/skills"

  @test:test/coordinator/init-folio-checkout.test.ts::a_scaffold_says_what_it_stands_on_(zmdo)::a_paper_folio_stands_on_folio-assistant-sci;_a_sibling_link_path_is_honoured
  Scenario: A paper folio stands on folio-assistant-sci under a sibling link path
    Given a paper folio scaffolded with a sibling link at "../platform"
    When its config's dependencies are read
    Then they name folio-assistant-sci at "../platform/folio-assistant-sci"

  @test:test/coordinator/init-folio-checkout.test.ts::remote_mounts_derived_from_the_checkout's_declarations_(--link_remote)::a_document_folio_mounts_the_platform_and_the_document_adapter's_instance
  Scenario: A document folio mounts the platform and folio-assistant-core
    Given the checkout holds the content adapters (the test is skipped where it does not)
    When the remote platform layers for "document" are derived
    Then they are cat-harness, cat-harness-tools, bootstrap, bootstrap-tools and folio-assistant-core

  @test:test/coordinator/init-folio-checkout.test.ts::remote_mounts_derived_from_the_checkout's_declarations_(--link_remote)::a_paper_folio_mounts_the_paper_adapter's_instance_after_what_it_needs
  Scenario: A paper folio mounts the platform, folio-assistant-core and folio-assistant-sci
    Given the checkout holds the content adapters (the test is skipped where it does not)
    When the remote platform layers for "paper" are derived
    Then they are cat-harness, cat-harness-tools, bootstrap, bootstrap-tools, folio-assistant-core and folio-assistant-sci

  @test:test/coordinator/init-folio-checkout.test.ts::remote_mounts_derived_from_the_checkout's_declarations_(--link_remote)::a_contentless_instance_mounts_the_platform_alone
  Scenario: A contentless instance mounts the platform alone
    Given no content type
    When the remote platform layers are derived
    Then they are cat-harness, cat-harness-tools, bootstrap and bootstrap-tools
