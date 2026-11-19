# Specifies, by reading docs-site.yml and feature-staging.yml, the collision
# each workflow allows when it runs publish-instance-files.ts.
Feature: Each workflow names the one served-name collision it chose

  @test:test/coordinator/publish-instance-files-workflows.test.ts::served-name_collisions_are_chosen,_never_won_by_step_order_(Phase_4,_bean_xsqm)::both_workflows_name_exactly_the_one_collision_they_chose
  Scenario: Both workflows allow exactly the bootstrap.json collision
    Given docs-site.yml and feature-staging.yml
    When the line that runs publish-instance-files.ts is found in each
    Then its --allow-collision value is "bootstrap.json"
