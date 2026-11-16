#Requires -Version 5.1
<#
.SYNOPSIS
    Bring a bare Windows machine to a working folio-assistant checkout.

.DESCRIPTION
    The Windows counterpart to the bun-install step in start-folio-assistant.sh.

    Scope is deliberately narrow: get `bun` onto the machine and dependencies
    installed, then hand over to `bun run check-deps`, which is the platform's
    own capability probe and speaks for every other toolchain. This script does
    NOT install LaTeX, Lean, Java or the IG Publisher - those are per content
    type, and check-deps reports them with install hints.

    Why this exists (issue #740, item 6): before it, a person on Windows with
    only a git client could not reach `bun install`. The single documented
    instruction was `curl -fsSL https://bun.sh/install | bash`
    (installation.md, README.md) - POSIX-only - and the two bootstrap scripts
    that do exist are bash and branch on `chromeos|debian`. Measured
    2026-09-21: 54 `.sh` in the repository, 0 `.ps1`.

.PARAMETER CheckOnly
    Report what is present and what is missing; install nothing. Safe to run
    first.

.EXAMPLE
    .\cat-harness\scripts\bootstrap.ps1 -CheckOnly
    .\cat-harness\scripts\bootstrap.ps1

.NOTES
    Targets Windows PowerShell 5.1, which is what ships with Windows 11 - so no
    ternary, no null-coalescing, and no `&&` chaining, none of which 5.1 parses.

    ASCII ONLY, deliberately. Windows PowerShell 5.1 decodes a .ps1 as the
    system ANSI codepage unless the file carries a UTF-8 BOM, so a UTF-8
    em-dash written by a POSIX editor renders as mojibake. The first draft of
    this file did exactly that. A BOM would also fix it, but it travels badly
    through tools that assume plain UTF-8; staying inside ASCII removes the
    question rather than answering it. Keep it that way when editing.
#>
[CmdletBinding()]
param(
    [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'

function Write-Step { param([string]$Message) Write-Host "`n==> $Message" -ForegroundColor Cyan }
function Write-Ok   { param([string]$Message) Write-Host "  [ok] $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message) Write-Host "  [!!] $Message" -ForegroundColor Yellow }

function Test-Have {
    param([string]$Name)
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    return ($null -ne $cmd)
}

# ---------------------------------------------------------------------------
# Repository root
#
# Found by WALKING UP for the directory that holds package.json, rather than
# by counting `..` from the script's location. That is not defensive
# programming for its own sake: start-folio-assistant.sh computes
# REPO_ROOT="$SCRIPT_DIR/.." and so resolves to cat-harness/ since the
# repository split, then probes cat-harness/package.json and finds nothing.
# It has been broken on every platform since, which is the bug this avoids by
# construction. Reported on #740.
# ---------------------------------------------------------------------------
function Get-RepoRoot {
    $dir = $PSScriptRoot
    while ($null -ne $dir -and $dir -ne '') {
        if (Test-Path (Join-Path $dir 'package.json')) { return $dir }
        $parent = Split-Path $dir -Parent
        if ($parent -eq $dir) { break }
        $dir = $parent
    }
    throw "Could not locate the repository root above '$PSScriptRoot' (no package.json found walking up)."
}

# ---------------------------------------------------------------------------
# PATH refresh
#
# An installer writes the user PATH in the registry; the CURRENT process does
# not see it. Without this the script installs bun and then cannot call it,
# which reads to the user as a failed install.
# ---------------------------------------------------------------------------
function Update-SessionPath {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user    = [Environment]::GetEnvironmentVariable('Path', 'User')
    $bunBin  = Join-Path $env:USERPROFILE '.bun\bin'
    $parts   = @($machine, $user, $bunBin) | Where-Object { $_ }
    $env:Path = ($parts -join ';')
}

function Install-Bun {
    # winget first: it verifies a package signature from a curated manifest.
    # `irm https://bun.sh/install.ps1 | iex` executes whatever that URL serves
    # at the moment it is run, unreviewed - the documented bash line has the
    # same property. Preferring winget is the one place this script declines to
    # mirror the POSIX path.
    if (Test-Have 'winget') {
        Write-Host "  installing via winget (Oven-sh.Bun)..."
        winget install --id Oven-sh.Bun --exact --silent --accept-source-agreements --accept-package-agreements
        Update-SessionPath
        if (Test-Have 'bun') { return $true }
        Write-Warn "winget completed but 'bun' is still not on PATH; falling back to the official installer."
    }
    else {
        Write-Warn "winget not available; using the official installer."
    }

    # Windows PowerShell 5.1 may default to TLS 1.0/1.1, which modern endpoints
    # refuse. Set 1.2 explicitly or the download fails with an opaque error.
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $installer = Join-Path $env:TEMP 'bun-install.ps1'
    Write-Host "  downloading https://bun.sh/install.ps1 -> $installer"
    Invoke-RestMethod -Uri 'https://bun.sh/install.ps1' -OutFile $installer
    Write-Host "  running it (review it first if you prefer: $installer)"
    & powershell -NoProfile -ExecutionPolicy Bypass -File $installer
    Update-SessionPath
    return (Test-Have 'bun')
}

# ---------------------------------------------------------------------------

$repoRoot = Get-RepoRoot
Write-Host "folio-assistant bootstrap (Windows)" -ForegroundColor White
Write-Host "repository: $repoRoot"

Write-Step 'Checking what is already present'
Update-SessionPath
$haveGit = Test-Have 'git'
$haveBun = Test-Have 'bun'

if ($haveGit) { Write-Ok "git  $((git --version) -replace 'git version ','')" }
else          { Write-Warn 'git is NOT installed. Install it first: winget install Git.Git' }

if ($haveBun) { Write-Ok "bun  $(bun --version)" }
else          { Write-Warn 'bun is NOT installed - it is the only hard requirement for the platform.' }

if ($CheckOnly) {
    Write-Host "`n-CheckOnly: nothing installed. Re-run without it to install." -ForegroundColor White
    if ($haveBun) { exit 0 }
    exit 1
}

if (-not $haveGit) {
    throw 'git is required and was not found. Install it, then re-run this script.'
}

if (-not $haveBun) {
    Write-Step 'Installing bun'
    if (-not (Install-Bun)) {
        throw "bun could not be installed automatically. Install it manually (winget install Oven-sh.Bun), open a new terminal, and re-run this script."
    }
    Write-Ok "bun $(bun --version)"
}

Write-Step 'Installing dependencies (bun install)'
Push-Location $repoRoot
try {
    bun install
    if ($LASTEXITCODE -ne 0) { throw "bun install exited $LASTEXITCODE" }
    Write-Ok 'dependencies installed'

    Write-Step 'Probing capabilities (bun run check-deps)'
    # Informational: this reports per-content-type toolchains (LaTeX, Lean,
    # Java, the IG Publisher) and is EXPECTED to report some as missing. A
    # non-zero exit here is not a bootstrap failure, so it is not treated as one.
    bun run check-deps
}
finally {
    Pop-Location
}

Write-Host "`nBootstrap complete." -ForegroundColor Green
Write-Host @"

Next:
  bun run gates          # every fast gate CI runs
  bun run start          # the MCP server (stdio)
  bun run check-deps     # what each content type still needs

If 'bun' is not found in a NEW terminal, open one and try again - the PATH
change this session made applies to new shells too, but only after they start.
"@
