---
doc_id: isaitb-2026-interoperability-test-bed-readme
doc_title: "Interoperability Test Bed"
section_id: s016-test-engine-gitb-srv
section_title: "Test engine (gitb-srv)"
file: "README.md"
lines: 190-195
source_sha256: 0ecf193f1fed8fce
granularity: heading
---
### Test engine (gitb-srv)

1. From the current (root) folder issue ``mvn clean install -DskipTests=true -Denv=docker``
2. Copy file ``gitb-testbed-service/target/itbsrv.war`` to a separate folder to build its Docker image.
3. Use Dockerfile ``etc/docker/gitb-srv/Dockerfile`` from the same folder to build the image with `docker build -t isaitb/gitb-srv .`.
