# print-published-path gives an instance's site path by its name (bean
# cat-tools-sthf). Each Scenario names the test that executes it.
Feature: An instance's published site path

  @test:scripts/tests/print-published-path.test.ts::print-published-path_—_an_instance's_site_path,_by_name_(bean_cat-tools-sthf)::is_publishedPath's_instance_case,_without_the_leading_slash
  Scenario: The path is publishedPath's instance case without the leading slash
    Then bootstrap's site path is bootstrap/
    And a path inside it equals the published instance path with its leading slash dropped

  @test:scripts/tests/print-published-path.test.ts::print-published-path_—_an_instance's_site_path,_by_name_(bean_cat-tools-sthf)::uses_the_NAME,_never_a_stub
  Scenario: The name is used, never a stub
    Then an instance named cat-harness with stub folio-assistant is at cat-harness/

  @test:scripts/tests/print-published-path.test.ts::print-published-path_—_an_instance's_site_path,_by_name_(bean_cat-tools-sthf)::answers_nothing_for_an_instance_declared_not_published
  Scenario: An instance declared not published has no path
    Then an instance with enabled false has none
    And with enabled true it is at its name
