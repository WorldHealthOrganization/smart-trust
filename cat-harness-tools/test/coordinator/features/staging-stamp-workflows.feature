# Specifies that feature-staging.yml no longer rewrites the exported JSON-LD
# to stamp it as staging.
Feature: The staging workflow does not stamp the export out of band

  @test:test/coordinator/staging-stamp-workflows.test.ts::the_workflow_no_longer_stamps_out_of_band::feature-staging.yml_does_not_rewrite_the_export_after_writing_it
  Scenario: feature-staging.yml does not set d.staging
    Given feature-staging.yml
    When it is read
    Then it contains no "d.staging =" assignment
