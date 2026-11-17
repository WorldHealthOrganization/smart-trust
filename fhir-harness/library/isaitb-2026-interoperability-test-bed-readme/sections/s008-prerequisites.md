---
doc_id: isaitb-2026-interoperability-test-bed-readme
doc_title: "Interoperability Test Bed"
section_id: s008-prerequisites
section_title: "Prerequisites"
file: "README.md"
lines: 83-93
source_sha256: 0ecf193f1fed8fce
granularity: heading
---
## Prerequisites

To build and run the Test Bed's components you need to have the following tools:
- JDK 21+, used as the base platform for both ``gitb-srv`` and ``gitb-ui``.
- Maven 3.9+, used to build ``gitb-srv``.
- SBT 1.10+, used to build ``gitb-ui``.
- Scala 2.13+, used to build the backend app of ``gitb-ui``.
- Node version 22+, used to build the frontend app of ``gitb-ui``.

Although not mandatory, the proposed IDE to use is IntelliJ, and VS Code for ``gitb-ui``'s Angular app.
