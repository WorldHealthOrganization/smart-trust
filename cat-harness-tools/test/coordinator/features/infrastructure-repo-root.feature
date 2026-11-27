# Specifies the checkout's container infrastructure: the MCP server's
# Dockerfile in cat-harness-tools, the containerised workflows (the paper
# folio's Lean templates), and the retired workflows: the image workflows, and
# publish.yml, dropped with the qou split (folio-assistant#3066).
Feature: One paper-assistant image, used by every containerised workflow, and no deprecated image workflows

  @test:test/coordinator/infrastructure-repo-root.test.ts::Unified_paper-assistant_image::Dockerfile_exists
  Scenario: The MCP server's Dockerfile exists
    Given the checkout
    When cat-harness-tools/adapters/mcp-server/Dockerfile is looked up
    Then it exists

  @test:test/coordinator/infrastructure-repo-root.test.ts::Unified_paper-assistant_image::Dockerfile_includes_TeX_Live
  Scenario: The Dockerfile installs TeX Live
    Given the MCP server's Dockerfile
    When it is read
    Then it contains "texlive-full"

  @test:test/coordinator/infrastructure-repo-root.test.ts::Unified_paper-assistant_image::Dockerfile_includes_gh_CLI
  Scenario: The Dockerfile installs the gh CLI
    Given the MCP server's Dockerfile
    When it is read
    Then an apt-get install line names gh
    And it runs "gh --version"

  @test:test/coordinator/infrastructure-repo-root.test.ts::Unified_paper-assistant_image::Dockerfile_installs_the_generated_Python_set
  Scenario: The Dockerfile installs the generated Python requirements
    Given the MCP server's Dockerfile
    When it is read
    Then it copies cat-harness-tools/python/requirements.txt
    And a pip3 install continues onto a "-r /tmp/requirements.txt" line

  @test:test/coordinator/infrastructure-repo-root.test.ts::Unified_paper-assistant_image::no_CI_workflow_regressed_to_a_pre-unification_image
  Scenario: No containerised workflow uses a pre-unification image
    Given the paper folio's lean-build.yml and blueprint.yml templates
    When each is read
    Then the templates are found, two of them
    And none mentions "texlive/texlive" or "latex-ci"

  @test:test/coordinator/infrastructure-repo-root.test.ts::Unified_paper-assistant_image::no_containerised_workflow_hardcodes_a_folio's_image
  Scenario: No containerised workflow hardcodes a folio's image
    Given the same containerised workflows
    When the images of those that declare a container are read
    Then each image is the paper-assistant image or a "${{" expression

  @test:test/coordinator/infrastructure-repo-root.test.ts::Unified_paper-assistant_image::publish.yml_is_gone_with_the_qou_split,_and_no_workflow_here_still_calls_it
  Scenario: publish.yml is gone, and nothing here still calls it
    Given the checkout's .github/workflows
    When publish.yml and every workflow's uses: lines are looked up
    Then publish.yml does not exist
    And no workflow uses .github/workflows/publish.yml

  @test:test/coordinator/infrastructure-repo-root.test.ts::Unified_paper-assistant_image::the_deprecated_image_workflows_are_gone,_with_their_images
  Scenario: The deprecated image workflows and their images are gone
    Given the checkout root
    When the old image workflows and image files are looked up
    Then neither docker-ci-image.yml nor build-latex-image.yml exists under .github/workflows
    And neither .github/docker nor a root Dockerfile exists
