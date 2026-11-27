# scripts/index-render.ts rootDeclaredInstance: index:render is not applicable at a root that declares its own instance, since there the entry files are the instance's own.
# Each Scenario names the test that executes it.
Feature: index:render recognises a root that declares its own instance

  @test:scripts/tests/index-render-root-instance.test.ts::rootDeclaredInstance::a_content_instance's_root_(declaration_beside_index.config.json)_names_itself
  Scenario: A content instance's root names its declared instance
    Given a root holding index.config.json and a declaration smart-ips-pilgrimage.json named "smart-ips-pilgrimage"
    When rootDeclaredInstance is asked about the root
    Then it returns "smart-ips-pilgrimage"

  @test:scripts/tests/index-render-root-instance.test.ts::rootDeclaredInstance::an_index_root_that_declares_nothing_is_not_excused
  Scenario: An index root that declares no instance is not excused
    Given a root holding index.config.json, index.lock.json and a package.json named "folio-assistant"
    When rootDeclaredInstance is asked about the root
    Then it returns undefined
