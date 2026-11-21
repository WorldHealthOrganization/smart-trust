# The Python dependency declaration (schemas/sdlc/python-deps.ts), the files
# generated from it, and the checks that catch it diverging from what the
# scripts import and what the Tools' images install (beans 68dt, ar1s).
# Each Scenario names the test that executes it.
Feature: The Python dependency declaration stays true

  @test:scripts/tests/python-deps.test.ts::the_declaration_matches_what_the_scripts_actually_import::nothing_imported_is_undeclared,_and_nothing_declared_is_dead
  Scenario: Nothing imported is undeclared and nothing declared is unused
    When the Python dependencies of this layer are checked
    Then no imported module is undeclared
    And no declared distribution is unused

  @test:scripts/tests/python-deps.test.ts::the_declaration_matches_what_the_scripts_actually_import::the_scan_finds_real_imports_—_not_a_vacuous_pass
  Scenario: The import scan finds real imports
    When this layer's Python files are scanned for imports
    Then more than 5 imports are found
    And "pymupdf" is among them

  @test:scripts/tests/python-deps.test.ts::the_declaration_matches_what_the_scripts_actually_import::local_sibling_modules_are_NOT_treated_as_dependencies
  Scenario: Local sibling modules are not dependencies
    When this layer's Python files are scanned for imports
    Then "translation_config", "translation_security" and "pull_translations" are not among them

  @test:scripts/tests/python-deps.test.ts::the_declaration_matches_what_the_scripts_actually_import::import_name_and_distribution_name_are_allowed_to_differ
  Scenario: Import name and distribution name may differ
    Then PyYAML imports as "yaml", pdfminer.six as "pdfminer" and camelot-py as "camelot"
    And lxml imports as "lxml"

  @test:scripts/tests/python-deps.test.ts::a_transitive_dependency_is_declared,_not_inferred::cffi_is_declared_transitive_and_says_what_needs_it
  Scenario: cffi is declared transitive though nothing imports it
    Then the declared "cffi" entry is marked transitive
    And no scanned Python file imports "cffi"

  @test:scripts/tests/python-deps.test.ts::a_transitive_dependency_is_declared,_not_inferred::Pillow_is_a_direct_import_now,_and_declared_as_one
  Scenario: Pillow is a direct, non-transitive import
    Then the declared "pillow" entry carries no transitive flag
    And a scanned Python file imports "PIL"

  @test:scripts/tests/python-deps.test.ts::a_transitive_dependency_is_declared,_not_inferred::the_schema_refuses_a_transitive_entry_whose_`why`_does_not_say_what_requires_it
  Scenario: A transitive entry must say what requires it
    Given a transitive entry whose why is "it is nice"
    Then the schema refuses it
    And the same entry with why "required by y, which imports it" is accepted

  @test:scripts/tests/python-deps.test.ts::the_two_tiers,_and_what_each_costs::each_extended_entry_carries_its_measured_cost
  Scenario: The extended tier is camelot-py, vosk and the OPUS-MT runner's three, each with a measured cost
    Then the extended tier's distributions are exactly "camelot-py", "vosk", "transformers", "torch" and "sentencepiece"
    And each one's reason states a size in MB

  @test:scripts/tests/python-deps.test.ts::the_two_tiers,_and_what_each_costs::every_lean_entry_is_installable_by_CI's_own_file
  Scenario: Every lean entry is in CI's lean requirements file
    Given the generated lean requirements file
    Then every lean distribution is on a line of its own in it
    And "camelot-py" is not

  @test:scripts/tests/python-deps.test.ts::the_generated_files_cannot_drift_from_the_declaration::both_are_current
  Scenario: The generated requirements files are current
    Then no tier's generated file is stale

  @test:scripts/tests/python-deps.test.ts::the_generated_files_cannot_drift_from_the_declaration::generation_is_deterministic_—_byte-identical_on_a_re-run
  Scenario: Generation is deterministic
    Then generating each tier's requirements body twice gives identical text

  @test:scripts/tests/python-deps.test.ts::the_generated_files_cannot_drift_from_the_declaration::each_file_says_it_is_generated_and_names_its_source
  Scenario: Each generated file says it is generated and names its source
    Then each tier's requirements file contains "GENERATED" and "schemas/sdlc/python-deps.ts"

  @test:scripts/tests/python-deps.test.ts::the_generated_files_cannot_drift_from_the_declaration::every_package_carries_a_machine-readable_`#_imports:`_line
  Scenario: Every package carries a machine-readable imports line
    When each tier's requirements body is generated
    Then its "# imports:" lines are the import names of that tier's packages, in distribution order

  @test:scripts/tests/python-deps.test.ts::the_generated_files_cannot_drift_from_the_declaration::the_mapping_that_differs_is_the_mapping_that_matters
  Scenario: The import names that differ are written before their distributions
    When the lean requirements body is generated
    Then it holds "# imports: PIL" before "pillow", "# imports: yaml" before "PyYAML" and "# imports: pdfminer" before "pdfminer.six"

  @test:scripts/tests/python-deps.test.ts::the_generated_files_cannot_drift_from_the_declaration::every_package's_reason_travels_into_the_file_with_it
  Scenario: Every package's reason travels into the requirements file
    Given the lean requirements file
    Then every lean distribution has a "# <distribution>:" reason line

  @test:scripts/tests/python-deps.test.ts::every_image_a_Tool_declares_installs_the_generated_set::the_build_line_names_the_Dockerfile
  Scenario: The Dockerfile is read from the build line
    Then "docker build -t x -f a/b/Dockerfile a/b" names "a/b/Dockerfile"
    And "docker build --file=a/Dockerfile ." names "a/Dockerfile"
    And "docker build -t x ." names none

  @test:scripts/tests/python-deps.test.ts::every_image_a_Tool_declares_installs_the_generated_set::installing_the_COPYed_generated_file_passes
  Scenario: Installing the COPYed generated file passes
    Given a Dockerfile that COPYs the generated lean file and pip-installs it with -r across a continuation
    Then it has no findings

  @test:scripts/tests/python-deps.test.ts::every_image_a_Tool_declares_installs_the_generated_set::an_image_with_no_pip_install_passes
  Scenario: An image with no pip install passes
    Given a Dockerfile that only apt-installs texlive-full
    Then it has no findings

  @test:scripts/tests/python-deps.test.ts::every_image_a_Tool_declares_installs_the_generated_set::a_retyped_declared_package_is_a_finding,_across_a_continuation
  Scenario: A retyped declared package is a finding across a continuation
    Given a Dockerfile that installs the generated file and then pip-installs "requests>=2.32" on a continued line
    Then a finding names "requests>=2.32"

  @test:scripts/tests/python-deps.test.ts::every_image_a_Tool_declares_installs_the_generated_set::a_requirements_file_that_is_not_the_generated_one_is_a_finding
  Scenario: A requirements file that is not the generated one is a finding
    Given a Dockerfile that pip-installs "-r r.txt" copied from another requirements file
    Then a finding names "-r r.txt"
    And a finding says "never `-r`"

  @test:scripts/tests/python-deps.test.ts::every_image_a_Tool_declares_installs_the_generated_set::a_wheel_or_build_tool_outside_the_declaration_is_not_a_retyped_list
  Scenario: A wheel or build tool outside the declaration is not a retyped list
    Given a Dockerfile that installs the generated file and then "maturin" and a local wheel
    Then it has no findings

  @test:scripts/tests/python-deps.test.ts::every_image_a_Tool_declares_installs_the_generated_set::a_Tool_whose_Dockerfile_is_missing_is_a_finding,_not_a_pass
  Scenario: A Tool whose Dockerfile is missing is a finding
    Given a Tool "gone" whose container builds "no/such/Dockerfile"
    When its images are checked
    Then the only finding is that the Dockerfile does not exist, for tool "gone" and that path

  @test:scripts/tests/python-deps.test.ts::every_image_a_Tool_declares_installs_the_generated_set::the_declared_images_exist_and_are_clean_—_and_there_are_some
  Scenario: The declared images exist and are clean
    Given the Tools this layer declares
    Then at least one declares a container image
    And their images have no findings
