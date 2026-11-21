---
doc_id: isaitb-2026-interoperability-test-bed-readme
doc_title: "Interoperability Test Bed"
section_id: s009-additional-test-bed-components
section_title: "Additional Test Bed components"
file: "README.md"
lines: 94-109
source_sha256: 0ecf193f1fed8fce
granularity: heading
---
### Additional Test Bed components

The focus of this README file is the ``gitb-srv`` and ``gitb-ui`` components. To run a complete Test Bed instance
you will also require at least:
- A MySQL database (version 8+) for its persistence.
- A REDIS instance (version 7+) for the caching of user sessions.

Both these instances are set up separately (e.g. via Docker) environment. These can be set up from Docker
as follows:
- MySQL: ``docker run --name gitb-mysql -p 3306:3306 -d isaitb/gitb-mysql``
- REDIS: ``docker run --name gitb-redis -p 6379:6379 -d isaitb/gitb-redis``

> **Note**  
> 
> All images and containers are defined in ``docker-compose.yml`` and explained in detail the [developer installation guide](https://www.itb.ec.europa.eu/docs/guides/latest/installingTheTestBed/index.html). You may build and launch the complete service as described [here](#build-for-deployment).
