---
doc_id: isaitb-2026-interoperability-test-bed-readme
doc_title: "Interoperability Test Bed"
section_id: s017-frontend-gitb-ui
section_title: "Frontend (gitb-ui)"
file: "README.md"
lines: 196-202
source_sha256: 0ecf193f1fed8fce
granularity: heading
---
### Frontend (gitb-ui)

1. From the ``gitb-ui`` folder issue ``sbt clean dist``. This builds all Play code and automatically calls the required
   prod build target from its Angular app.
2. Unzip the contents of the ``gitb-ui/target/universal/gitb-1.0-SNAPSHOT.zip`` archive to a separate folder. The name of the resulting unzipped folder should be ``gitb-ui``.
3. Use the Dockerfile ``etc/docker/gitb-ui/Dockerfile`` from the same folder to build the image with `docker build -t isaitb/gitb-ui .`.
