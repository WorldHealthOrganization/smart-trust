# scripts/mount-from-lock.ts leaves a viewer route that ignores itself (a .gitignore of a lone
# "*") out of the mount digest. Each Scenario names the test that executes it.
Feature: Self-ignoring routes stay out of the mount digest

  @test:test/mount-self-ignored-routes.test.ts::self-ignoring_routes::only_a_lone_`*`_pattern_is_a_self-ignore
  Scenario: Only a .gitignore whose sole pattern is a lone star is a self-ignore
    Then a .gitignore of a comment line and "*" is a self-ignore
    And a .gitignore of just "*" is a self-ignore
    And "*" followed by "!keep.md" is not
    And "*.svg" is not
    And a comment alone is not

  @test:test/mount-self-ignored-routes.test.ts::self-ignoring_routes::a_built_route_leaves_the_digest_unchanged
  Scenario: Adding self-ignored built routes leaves the mount digest unchanged
    Given a tree with x.json and docs/index.md, and its digest
    When glossary routes under docs/en and docs/fr are added, each with a .gitignore of "*"
    Then the digest is unchanged
    And the covered files are exactly "docs/index.md" and "x.json"

  @test:test/mount-self-ignored-routes.test.ts::self-ignoring_routes::a_partial_ignore,_and_the_instance's_own_root_.gitignore,_hide_nothing
  Scenario: A partial ignore and the root .gitignore hide nothing
    Given a tree whose root .gitignore is "*" and whose docs/a/.gitignore is "*.svg"
    When the self-ignored files are removed from ".gitignore", "docs/a/.gitignore" and "docs/a/b.md"
    Then all three files remain
