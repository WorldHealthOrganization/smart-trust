---
doc_id: isaitb-2026-interoperability-test-bed-readme
doc_title: "Interoperability Test Bed"
section_id: s005-technology-stack
section_title: "Technology stack"
file: "README.md"
lines: 62-70
source_sha256: 0ecf193f1fed8fce
granularity: heading
---
# Technology stack

Both ``gitb-srv`` and ``gitb-ui`` are Java-based applications. Specifically, ``gitb-srv`` is packaged
as a Spring Boot application using Akka as its primary internal framework, whereas ``gitb-ui``
is developed in Scala and uses the Play Framework.

The frontend of the ``gitb-ui`` component is an Angular app developed in TypeScript, and is managed in terms
of scaffolding and build using Angular CLI.
