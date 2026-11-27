# scripts/tests/infrastructure.test.ts checks the platform's infrastructure files: the lean-artifact guard, MCP and deploy config, the TeX docker helper, test-path anchoring and the schema files.
# Folio-side checks are skipped when no content repo is attached. Each Scenario names the test that executes it.
Feature: Platform infrastructure files are present and well-formed

  @test:scripts/tests/infrastructure.test.ts::check-no-lean-artifacts.sh::passes_on_clean_repo
  Scenario: The lean-artifact guard passes on a clean repository
    Given the scripts/check-no-lean-artifacts.sh script
    When it is run from the instance root
    Then it does not fail within 5 seconds

  @test:scripts/tests/infrastructure.test.ts::lean-mcp.config.json::is_valid_JSON
  Scenario: The folio's lean-mcp.config.json is valid JSON
    # Skipped: when no folio is attached
    Given the folio's lean-mcp.config.json
    When it is parsed
    Then parsing does not throw

  @test:scripts/tests/infrastructure.test.ts::lean-mcp.config.json::has_required_fields
  Scenario: lean-mcp.config.json has its required fields
    # Skipped: when no folio is attached
    Given the folio's lean-mcp.config.json
    When it is parsed
    Then it has "image", "mcp_internal_port", "auth" and "folio"
    And its folio has a "domain"

  @test:scripts/tests/infrastructure.test.ts::lean-mcp.config.json::has_llm_provider_config
  Scenario: lean-mcp.config.json has an LLM provider config
    # Skipped: when no folio is attached
    Given the folio's lean-mcp.config.json
    When it is parsed
    Then it has "llm" with a "provider" and "providers"

  @test:scripts/tests/infrastructure.test.ts::.mcp.json::is_valid_JSON
  Scenario: The repository's .mcp.json is valid JSON
    # Skipped: when no folio is attached
    Given the repository root's .mcp.json
    When it is parsed
    Then parsing does not throw

  @test:scripts/tests/infrastructure.test.ts::.mcp.json::has_paper-assistant_server
  Scenario: .mcp.json registers the paper-assistant server
    # Skipped: when no folio is attached
    Given the repository root's .mcp.json
    When it is parsed
    Then its mcpServers include "paper-assistant"

  @test:scripts/tests/infrastructure.test.ts::Unified_paper-assistant_image::the_platform_ships_no_folio-specific_builder_Dockerfile
  Scenario: The platform ships no folio-specific builder image
    Given the repository root of the instance
    Then .github/docker/Dockerfile.paper-builder does not exist
    And .github/workflows/paper-builder-image.yml does not exist

  @test:scripts/tests/infrastructure.test.ts::Unified_paper-assistant_image::docker-tex.sh_helper_exists
  Scenario: The docker-tex.sh helper exists
    Given this layer's scripts directory
    Then scripts/lib/docker-tex.sh exists

  @test:scripts/tests/infrastructure.test.ts::Unified_paper-assistant_image::render-on-change.sh_uses_docker-tex.sh
  Scenario: render-on-change.sh uses the docker-tex.sh helper
    Given scripts/render-on-change.sh
    Then its source contains "docker-tex.sh"

  @test:scripts/tests/infrastructure.test.ts::Unified_paper-assistant_image::render-pre-commit.sh_uses_docker-tex.sh
  Scenario: render-pre-commit.sh uses the docker-tex.sh helper
    Given scripts/render-pre-commit.sh
    Then its source contains "docker-tex.sh"

  @test:scripts/tests/infrastructure.test.ts::Unified_paper-assistant_image::config_image_matches_build_workflow
  Scenario: The configured image and the build workflow both name paper-assistant
    # Skipped: when no folio is attached
    # Gap: only checks both mention "paper-assistant", not that the image names match exactly
    Given the folio's lean-mcp.config.json and the build-lean-mcp.yml workflow
    Then the config's image contains "paper-assistant"
    And the workflow contains "paper-assistant"

  @test:scripts/tests/infrastructure.test.ts::Deploy_infrastructure::Caddyfile.template_uses_domain_variable
  Scenario: The Caddyfile template uses the domain variable
    Given deploy/Caddyfile.template
    Then it contains "${FOLIO_DOMAIN}"

  @test:scripts/tests/infrastructure.test.ts::Deploy_infrastructure::self-update.sh_preserves_.env
  Scenario: self-update.sh excludes deploy/.env
    # Gap: source-text check only; the update is not run
    Given deploy/self-update.sh
    Then it contains "exclude='deploy/.env'"

  @test:scripts/tests/infrastructure.test.ts::.gitignore::blocks_deploy/.env
  Scenario: The .gitignore lists deploy/.env
    # Skipped: when no folio is attached
    Given the repository root's .gitignore
    Then it contains "deploy/.env"

  @test:scripts/tests/infrastructure.test.ts::.gitignore::blocks_folio/quantum-observable-universe/lean/.lake/
  Scenario: The .gitignore lists the paper's lean/.lake/ directory
    # Skipped: when no folio is attached
    Given the repository root's .gitignore
    Then it contains "folio/quantum-observable-universe/lean/.lake/"

  @test:scripts/tests/infrastructure.test.ts::tests_anchor_repo_paths_at_import.meta.dir,_not_process.cwd()::scans_a_plausible_number_of_test_files
  Scenario: The cwd-anchoring sweep covers a plausible number of test files
    Given the .ts files in scripts/tests
    Then there are more than 50 of them

  @test:scripts/tests/infrastructure.test.ts::tests_anchor_repo_paths_at_import.meta.dir,_not_process.cwd()::no_test_builds_a_repo_path_from_the_runner's_cwd
  Scenario: No test builds a repository path from process.cwd()
    Given every .ts file in scripts/tests, with comments masked, except those opting out with "allow-cwd-anchored-paths"
    When the code is searched for join or resolve over process.cwd(), or process.cwd() plus a string
    Then no file has such a match

  @test:scripts/tests/infrastructure.test.ts::Schema_files::formalization-types.ts_exists
  Scenario: The formalization types schema file exists
    Given this layer's schemas directory
    Then schemas/formalization-types.ts exists

  @test:scripts/tests/infrastructure.test.ts::Schema_files::formalization-types.ts_exports_all_key_types
  Scenario: formalization-types.ts exports the key proof, visualizer and skills types
    Given schemas/formalization-types.ts
    Then it exports the interfaces ProofObjectsManifest, ProofObject and ReviewRecord
    And it exports the interface VizState and the type VizMode
    And it exports the interfaces SkillsConfig and SkillPackage

  @test:scripts/tests/infrastructure.test.ts::Schema_files::constraints.ts_exports_Zod_schemas_for_cat-harness's_own_block_kinds
  Scenario: constraints.ts exports the schemas for cat-harness's own block kinds
    # Gap: source-text check for the export names; the schemas are not run
    Given schemas/constraints.ts
    Then it exports AlgorithmSchema, ExampleSchema, RemarkSchema, ProseSchema, ComputationSchema and ProvableBaseSchema

  @test:scripts/tests/infrastructure.test.ts::Schema_files::proof-objects.json_has_valid_structure
  Scenario: The folio's proof-objects.json has a valid structure
    # Skipped: when no folio is attached
    # Gap: only the first object is checked
    Given the folio's proof-objects.json
    When it is parsed
    Then its version is "1.0" with an objects array and a manuscript
    And the manuscript has a repo, commit_sha and generated_at
    And if there are objects, the first has a label, an object_type and a latex file and line
    And its object_type is one of definition, theorem, lemma, proposition, corollary, conjecture, example or remark
