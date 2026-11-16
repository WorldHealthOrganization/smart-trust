# scripts/publish-instance-files.ts copies an instance's files onto the site as they sit,
# renders each .md beside itself as HTML, and fails on served-name collisions nobody chose.
# Each Scenario names the test that executes it.
Feature: Publishing an instance's own files

  @test:scripts/tests/sdlc/publish-instance-files.test.ts::publish-instance-files_(bean_iwtn,_ruling_3)::a_link_to_a_.md_file_points_at_its_.html_rendering,_anchor_kept;_others_untouched
  Scenario: A link to a .md file points at its .html rendering, and other links are untouched
    Given HTML linking skills/a.md, b.md#x, a JSON schema anchor and an external .md URL
    When the .md links are rewritten
    Then skills/a.md becomes skills/a.html and b.md#x becomes b.html#x
    And the JSON schema link and the external URL are unchanged

  @test:scripts/tests/sdlc/publish-instance-files.test.ts::publish-instance-files_(bean_iwtn,_ruling_3)::the_title_is_the_first_heading
  Scenario: The page title is the first heading
    Given markdown with intro text, then "# The Title" and a subheading
    When its title is taken
    Then it is "The Title"
    And markdown with no heading takes its file name "f.md"

  @test:scripts/tests/sdlc/publish-instance-files.test.ts::publish-instance-files_(bean_iwtn,_ruling_3)::files_are_copied_as_they_sit,_.md_rendered_beside_them,_README_also_as_index,_nothing_overwritten
  Scenario: Files are copied as they sit, .md rendered beside them, README also as index, nothing overwritten
    Given an instance with README.md, skills/a.md with front matter, and inst.json
    And an output directory that already holds inst.json
    When the instance files are published
    Then inst.json is skipped and its existing content is kept
    And README.html, README.md, index.html, skills/a.html and skills/a.md are written
    And README.html is titled "Inst", links skills/a.html and renders the table
    And skills/a.html does not render its front matter

  @test:scripts/tests/sdlc/publish-instance-files.test.ts::publish-instance-files_(bean_iwtn,_ruling_3)::bootstrap's_declared_reachableAt_is_one_of_its_own_files
  Scenario: Bootstrap's declared reachableAt is one of its own files
    Given bootstrap.json in the repository
    When its renderExemption reachableAt is read
    Then it is a relative path inside bootstrap
    And the file exists there

  @test:scripts/tests/sdlc/publish-instance-files.test.ts::served-name_collisions_are_chosen,_never_won_by_step_order_(Phase_4,_bean_xsqm)::a_byte-identical_file_is_not_a_collision;_a_different_one_is
  Scenario: A byte-identical file is not a collision and a different one is
    Given an instance with bootstrap.json and ns.jsonld
    And a site already holding a different bootstrap.json and an identical ns.jsonld
    When the instance files are published
    Then both files are skipped
    And only bootstrap.json is a collision

  @test:scripts/tests/sdlc/publish-instance-files.test.ts::served-name_collisions_are_chosen,_never_won_by_step_order_(Phase_4,_bean_xsqm)::the_step_FAILS_on_a_collision_nobody_named,_and_passes_when_it_is_named
  Scenario: The step fails on a collision nobody named and passes when it is named
    Given an instance and a site where bootstrap.json collides
    When the publish script is run
    Then it exits 1
    And run with "--allow-collision bootstrap.json" it exits 0
