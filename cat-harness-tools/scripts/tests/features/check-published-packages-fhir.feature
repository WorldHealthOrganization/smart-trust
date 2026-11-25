# scripts/check-published-packages.ts excuses a package.json that is not an npm manifest, such as
# a FHIR template package, with a reason instead of installing it.
# Each Scenario names the test that executes it.
Feature: FHIR package manifests are not npm packages

  @test:scripts/tests/check-published-packages-fhir.test.ts::notAnNpmManifest::a_FHIR_template_package_is_named_as_one
  Scenario: A FHIR template package is named as one
    Given a manifest with type "fhir.template"
    When it is checked as an npm manifest
    Then the reason contains "a FHIR package"

  @test:scripts/tests/check-published-packages-fhir.test.ts::notAnNpmManifest::npm's_own_`type`_values,_and_an_absent_one,_are_npm's
  Scenario: npm's own type values, and no type, are npm manifests
    Given manifests with no type, with type "module" and with type "commonjs"
    When each is checked as an npm manifest
    Then none is excused

  @test:scripts/tests/check-published-packages-fhir.test.ts::notAnNpmManifest::any_other_`type`_is_not_npm's,_whatever_it_is
  Scenario: Any other type is not an npm manifest
    Given a manifest with type "something-else"
    When it is checked as an npm manifest
    Then the reason contains "not an npm package"
