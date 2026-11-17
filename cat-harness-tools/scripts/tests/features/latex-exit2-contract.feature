# The LaTeX tooling exits 2 (could not determine) when the platform holds no
# paper content or a required input is absent (folio-assistant-jh2j Finding 1).
# Each Scenario names the test that executes it.
Feature: The LaTeX tooling's exit-2 contract

  @test:scripts/tests/latex-exit2-contract.test.ts::LaTeX_family_exit-2_contract_(Finding_1_on_jh2j)::headless-render-qc_exits_2_on_could-not-determine_(no_paper.json_in_platform)
  Scenario: headless-render-qc exits 2 when the platform holds no paper.json
    When headless-render-qc.ts runs from the workspace root
    Then it exits with code 2

  @test:scripts/tests/latex-exit2-contract.test.ts::LaTeX_family_exit-2_contract_(Finding_1_on_jh2j)::latexmk-compile.sh_exits_2_on_usage_/_missing_file
  Scenario: latexmk-compile.sh exits 2 on a missing argument or a missing file
    When latexmk-compile.sh runs with no argument
    Then it exits with code 2
    And when it runs on a .tex file that does not exist, it exits with code 2

  @test:scripts/tests/latex-exit2-contract.test.ts::LaTeX_family_exit-2_contract_(Finding_1_on_jh2j)::generate-main-tex_exits_2_on_could-not-determine_(no_paper_manifest_in_platform)
  Scenario: generate-main-tex exits 2 when the platform holds no paper manifest
    When generate-main-tex.ts runs from the workspace root
    Then it exits with code 2
