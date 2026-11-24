# The folio's Lean workspace: the root toolchain and lakefile, its
# dependencies, and each registered paper Lake package (schemas/lean-packages.ts).
# Every assertion is about the folio, so with no folio attached these skip.
# Each Scenario names the test that executes it.
Feature: Lean projects in the folio

  @test:scripts/tests/lean-projects.test.ts::Lean_root_workspace::root_lean-toolchain_exists
  Scenario: The root workspace has a lean-toolchain
    Given a folio is attached
    Then its Lean directory holds "lean-toolchain"

  @test:scripts/tests/lean-projects.test.ts::Lean_root_workspace::root_lean-toolchain_has_valid_version
  Scenario: The root lean-toolchain names a Lean 4 version
    Given a folio is attached
    Then its lean-toolchain matches "leanprover/lean4:v<major>.<minor>"

  @test:scripts/tests/lean-projects.test.ts::Lean_root_workspace::root_lakefile.toml_exists
  Scenario: The root workspace has a lakefile.toml
    Given a folio is attached
    Then its Lean directory holds "lakefile.toml"

  @test:scripts/tests/lean-projects.test.ts::Lean_root_workspace::root_lakefile_declares_every_paper_package
  Scenario: The root lakefile declares every registered paper package
    Given a folio is attached
    Then its root lakefile.toml holds name = "<name>" for every registered paper package

  @test:scripts/tests/lean-projects.test.ts::Lean_dependencies::mathlib_is_declared
  Scenario: mathlib is a declared dependency
    Given a folio is attached
    Then the discovered dependencies include "mathlib"

  @test:scripts/tests/lean-projects.test.ts::Lean_dependencies::every_registered_paper_package_is_declared
  Scenario: Every registered paper package is a declared dependency
    Given a folio is attached
    Then the discovered dependencies include every registered paper package's name

  @test:scripts/tests/lean-projects.test.ts::Lean_project_discovery::at_least_one_project_found
  Scenario: At least one Lean project is discovered
    Given a folio is attached
    Then at least one Lean project is discovered

  @test:scripts/tests/lean-projects.test.ts::Lean_project_discovery::every_LEAN_PACKAGES_entry's_lib_is_discovered
  Scenario: Every registered package's library is discovered
    Given a folio is attached
    Then every registered package's lib is among the discovered projects

  @test:scripts/tests/lean-projects.test.ts::Paper_package:_%s_(lib:_%s)::lakefile.toml_exists
  Scenario: Each paper package has a lakefile.toml
    Given a folio is attached and a registered paper package
    Then its Lake root holds "lakefile.toml"

  @test:scripts/tests/lean-projects.test.ts::Paper_package:_%s_(lib:_%s)::library_directory_exists
  Scenario: Each paper package's library directory exists
    Given a folio is attached and a registered paper package
    Then its library directory exists under its Lake root

  @test:scripts/tests/lean-projects.test.ts::Paper_package:_%s_(lib:_%s)::has_.lean_files
  Scenario: Each paper package's library holds .lean files
    Given a folio is attached and a registered paper package
    Then its library directory holds at least one .lean file

  @test:scripts/tests/lean-projects.test.ts::Paper_package:_%s_(lib:_%s)::%s::is_non-empty
  Scenario: Each .lean file of a paper package is non-empty
    Given a .lean file of a registered paper package
    Then its trimmed content is not empty

  @test:scripts/tests/lean-projects.test.ts::Paper_package:_%s_(lib:_%s)::%s::declares_something_or_imports_something
  Scenario: Each .lean file declares or imports something
    Given a .lean file of a registered paper package
    Then it has an import line, or a declaration keyword line, or is the library's root module

  @test:scripts/tests/lean-projects.test.ts::Paper_package:_%s_(lib:_%s)::sorry_audit_(report)
  Scenario: The sorry audit reports over a real set of files
    # Gap: a report, not a check: sorry counts are only logged; only that the package has .lean files is asserted
    Given a folio is attached and a registered paper package
    When the sorry occurrences of its .lean files are counted and logged
    Then the package has at least one .lean file

  @test:scripts/tests/lean-projects.test.ts::Paper_package:_%s_(lib:_%s)::no_.lake/_artifacts_tracked_in_git
  Scenario: No .lake/ build artifacts are tracked in git
    Given a folio is attached and a registered paper package
    When git lists the tracked files under its Lake root's .lake/
    Then the list is empty, and only git being unavailable is tolerated
