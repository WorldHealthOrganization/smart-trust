---
doc_id: isaitb-2026-interoperability-test-bed-readme
doc_title: "Interoperability Test Bed"
section_id: s010-test-engine-gitb-srv
section_title: "Test engine (gitb-srv)"
file: "README.md"
lines: 110-125
source_sha256: 0ecf193f1fed8fce
granularity: heading
---
## Test engine (gitb-srv)

To build and run the ``gitb-srv`` component carry out the following steps:
1. From folder ``gitb`` run ``mvn clean install -DskipTests=true``.
2. Create a run configuration in your IDE as follows (or set up outside your IDE). The run configuration
   can be defined in one of two ways:
   - **As a Java Application (best):** Set class ``Application`` from the ``gitb-testbed-service`` module as
     your entry point. This is the best approach as it allows direct debugging without extra configuration.
   - **Via Maven:** Run ``mvn spring-boot:run`` from the ``gitb-testbed-service`` module.
3. Adapt your run definition's environment variables to add the following:
   - ``remote.testcase.repository.url`` = http://localhost:9000/repository/tests/:test_id/definition
   - ``remote.testresource.repository.url`` = http://localhost:9000/repository/resource/:test_id/:resource_id

Note that defining a run configuration is something specific. If running outside an IDE you can follow either
approach but ensure that the environment variables are correctly set up.
