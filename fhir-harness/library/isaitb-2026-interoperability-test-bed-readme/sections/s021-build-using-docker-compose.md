---
doc_id: isaitb-2026-interoperability-test-bed-readme
doc_title: "Interoperability Test Bed"
section_id: s021-build-using-docker-compose
section_title: "Build using Docker Compose"
file: "README.md"
lines: 218-270
source_sha256: 0ecf193f1fed8fce
granularity: heading
---
## Build using Docker Compose

This approach is more suitable for a containerised build, avoiding any manual steps and developer tool installations (apart from Docker Compose). Make sure that your 
Docker Compose is at least at version `2.0.0`. Note that the overall build time in this case is slower compared to building with the relevant tools.

When using this approach the images are built directly from the repository's sources using the definitions in `docker-compose.yml`. As part of this process, select
configuration values are passed as Docker build arguments and embedded in the resulting images for development use. Before starting the build you must therefore define
the following environment variables in your shell:

- `MYSQL_ROOT_PASSWORD`: The MySQL root password. This is also used by the MySQL container's healthcheck.
- `MYSQL_PASSWORD`: The password of the `gitb` MySQL user.
- `DB_DEFAULT_PASSWORD`: The password used by `gitb-ui` to connect to MySQL. This **must match** `MYSQL_PASSWORD`.
- `APPLICATION_SECRET`: The Play secret used by `gitb-ui`.
- `MASTER_PASSWORD`: The password used by `gitb-ui` to encrypt sensitive persisted values.
- `HMAC_KEY`: The shared HMAC key used by `gitb-ui` and `gitb-srv`. This **must be the same** for both components.

For a quick local setup you can define these directly in your shell before starting Docker Compose. For example on Linux/macOS:

```bash
export MYSQL_ROOT_PASSWORD='rootPasswordForLocalBuild'
export MYSQL_PASSWORD='gitbPasswordForLocalBuild'
export DB_DEFAULT_PASSWORD="$MYSQL_PASSWORD"
export APPLICATION_SECRET='a-local-development-application-secret-at-least-32-chars'
export MASTER_PASSWORD='a-local-development-master-password'
export HMAC_KEY='a-local-development-hmac-key'
docker compose up -d --build
```

On Windows PowerShell, the equivalent would be:

```powershell
$env:MYSQL_ROOT_PASSWORD = 'rootPasswordForLocalBuild'
$env:MYSQL_PASSWORD = 'gitbPasswordForLocalBuild'
$env:DB_DEFAULT_PASSWORD = $env:MYSQL_PASSWORD
$env:APPLICATION_SECRET = 'a-local-development-application-secret-at-least-32-chars'
$env:MASTER_PASSWORD = 'a-local-development-master-password'
$env:HMAC_KEY = 'a-local-development-hmac-key'
docker compose up -d --build
```

Alternatively, you may place the same variables in a `.env` file in the repository's root folder so that Docker Compose picks them up automatically.

Once these variables are defined, build and launch all containers from the repository's root folder with:

```bash
docker compose up -d --build
```

> **Note**
>
> The values above are used to build development-ready images from source. If you later adapt your setup for a more secure deployment, note that the published images
> continue to support runtime secret configuration via environment variables and the `_FILE` variants described in the installation guides.
