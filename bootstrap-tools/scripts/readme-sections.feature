Feature: README sections, written standalone, and where a bootstrap term link points

  @test:scripts/readme-sections.test.ts::README_sections,_written_standalone::writesOnlyBetweenMarkers
  Scenario: only between a section's own markers, in the harness's form
    Given a README with text before and after a kg:files begin/end region holding "old"
    When "new body" is injected into the kg:files section
    Then only the region changes, now holding the new body set off by blank lines

  @test:scripts/readme-sections.test.ts::README_sections,_written_standalone::leavesUnoptedReadme
  Scenario: a README that has not opted in is left exactly as it is
    Given a README with no markers
    When a body is injected into the kg:files section
    Then the README is unchanged

  @test:scripts/readme-sections.test.ts::a_term_link_outside_bootstrap_is_the_published_page,_whatever_sits_beside_it;_inside,_a_relative_path::siblingClonesLinkPublished
  Scenario: sibling clones: the tools' README links the published page
    Given bootstrap and bootstrap-tools as two sibling git repositories
    When the term link for Process is computed from the tools' scripts directory
    Then it is "https://litlfred.github.io/bootstrap/schemas/#process"

  @test:scripts/readme-sections.test.ts::a_term_link_outside_bootstrap_is_the_published_page,_whatever_sits_beside_it;_inside,_a_relative_path::oneRepoLinksPublished
  Scenario: one repository holding both: still the published page, never a sibling-relative path
    Given bootstrap and bootstrap-tools inside one git repository
    When the term link for Process is computed from the tools' scripts directory
    Then it is "https://litlfred.github.io/bootstrap/schemas/#process"

  @test:scripts/readme-sections.test.ts::a_term_link_outside_bootstrap_is_the_published_page,_whatever_sits_beside_it;_inside,_a_relative_path::toolsAloneLinkPublished
  Scenario: the tools alone, with no bootstrap anywhere: the same published page
    Given bootstrap-tools in a git repository with no bootstrap
    When the term link for Process is computed from the tools' scripts directory
    Then it is "https://litlfred.github.io/bootstrap/schemas/#process"

  @test:scripts/readme-sections.test.ts::a_term_link_outside_bootstrap_is_the_published_page,_whatever_sits_beside_it;_inside,_a_relative_path::bootstrapLinksRelatively
  Scenario: bootstrap's own README, in its own repository, links relatively
    Given bootstrap and bootstrap-tools as two sibling git repositories
    When the term link for Process is computed from bootstrap's root
    Then it is "schemas/README.md#process"
    When it is computed from bootstrap's schemas directory
    Then it is "README.md#process"
