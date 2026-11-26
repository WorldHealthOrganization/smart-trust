/**
 * Package Manifest — Docker and system dependency declarations.
 *
 * Each skill package declares its runtime requirements so the Docker
 * image builder can aggregate dependencies across all active packages.
 *
 * ## Standards used
 *
 * | Concern | Standard |
 * |---------|----------|
 * | Image metadata | [OCI Image Annotations](https://github.com/opencontainers/image-spec/blob/main/annotations.md) |
 * | APT versions | [Debian control file relationships](https://www.debian.org/doc/debian-policy/ch-relationships.html) |
 * | Python versions | [PEP 440](https://peps.python.org/pep-0440/) |
 * | Node versions | [semver](https://semver.org/) |
 * | Health checks | [OCI image config](https://github.com/opencontainers/image-spec/blob/main/config.md) |
 *
 * ## Usage
 *
 * Each skill package exports a `PackageManifest` in its directory.
 * The Docker image build aggregates all manifests from active packages
 * (as declared in `skills-config.json`) to generate a unified
 * Dockerfile layer.
 *
 * @module assistant-package
 * @graphNode schema
 */

/**
 * An APT package dependency with optional version constraint.
 *
 * Version syntax follows Debian control file conventions:
 * `>>1.0`, `>=2.3`, `=1.2.3-1`, `<<3.0`.
 *
 * @example
 * ```ts
 * { package: "texlive-full", reason: "LaTeX rendering" }
 * { package: "ripgrep", version: ">=13.0", reason: "lean-lsp-mcp search" }
 * ```
 */
export interface AptDependency {
  /** Debian package name (e.g., "texlive-full", "ripgrep"). */
  package: string;
  /** Debian version relation (e.g., ">=2.3"). Omit for any version. */
  version?: string;
  /** Why this package is needed. */
  reason?: string;
}

/**
 * A tool installed via curl/script rather than APT.
 *
 * @example
 * ```ts
 * {
 *   name: "bun",
 *   installCommand: "curl -fsSL https://bun.sh/install | bash",
 *   binary: "bun",
 *   reason: "MCP server runtime",
 * }
 * ```
 */
export interface InstallerDependency {
  /** Tool identifier. */
  name: string;
  /** Shell command to install the tool. */
  installCommand: string;
  /** Expected binary on PATH after install. */
  binary: string;
  /** Pin to a specific version (empty = latest). */
  version?: string;
  /** Why this tool is needed. */
  reason?: string;
}

/**
 * A Python package installed via pip/uv.
 *
 * Version syntax follows [PEP 440](https://peps.python.org/pep-0440/).
 */
export interface PythonDependency {
  /** PyPI package name. */
  package: string;
  /** PEP 440 version specifier (e.g., ">=1.0,<2.0"). */
  version?: string;
  reason?: string;
}

/**
 * An npm/bun package dependency.
 *
 * Version syntax follows [semver](https://semver.org/).
 */
export interface NodeDependency {
  /** npm package name. */
  package: string;
  /** semver range (e.g., "^1.0.0", ">=2.0.0"). */
  version?: string;
  reason?: string;
}

/**
 * Package manifest declaring all runtime requirements for a skill package.
 *
 * The Docker image build process reads these manifests to generate
 * an aggregate Dockerfile layer that satisfies all active packages.
 *
 * @example
 * ```ts
 * const manifest: PackageManifest = {
 *   packageId: "local",
 *   name: "authoring-math",
 *   description: "Formal math authoring (Lean 4 + LaTeX)",
 *   baseImage: "ubuntu:24.04",
 *   apt: [
 *     { package: "texlive-full", reason: "LaTeX rendering" },
 *     { package: "ripgrep", reason: "Lean MCP search" },
 *   ],
 *   installers: [
 *     { name: "elan", binary: "elan",
 *       installCommand: "curl -sSf .../elan-init.sh | sh -s -- -y",
 *       reason: "Lean toolchain manager" },
 *   ],
 * };
 * ```
 */
export interface PackageManifest {
  /** Package identifier matching skills-config.json name or "local". */
  packageId: string;
  /** Human-readable name (e.g., "authoring-math", "authoring-who-smart-guidelines"). */
  name: string;
  /** What this package provides. */
  description: string;
  /**
   * Base Docker image. Ubuntu LTS only.
   * @default "ubuntu:24.04"
   */
  baseImage: string;
  /** Target CPU architecture(s). */
  architectures?: ("amd64" | "arm64")[];
  /**
   * OCI image annotations.
   * @see https://github.com/opencontainers/image-spec/blob/main/annotations.md
   */
  ociAnnotations?: {
    "org.opencontainers.image.title"?: string;
    "org.opencontainers.image.description"?: string;
    "org.opencontainers.image.authors"?: string;
    "org.opencontainers.image.url"?: string;
    "org.opencontainers.image.source"?: string;
    "org.opencontainers.image.licenses"?: string;
    [key: string]: string | undefined;
  };
  /** APT packages (Ubuntu/Debian). */
  apt?: AptDependency[];
  /** Tools installed via custom scripts/curl. */
  installers?: InstallerDependency[];
  /** Python packages (installed via uv/pip). */
  python?: PythonDependency[];
  /** Node/Bun packages. */
  node?: NodeDependency[];
  /** Environment variables required at runtime. */
  envVars?: {
    name: string;
    description: string;
    required: boolean;
    default?: string;
  }[];
  /** Ports exposed by services in this package. */
  exposedPorts?: {
    port: number;
    protocol: "tcp" | "udp";
    service: string;
  }[];
  /** OCI-compatible healthcheck. */
  healthcheck?: {
    test: string[];
    interval?: string;
    timeout?: string;
    retries?: number;
  };
}
