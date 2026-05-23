Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
  if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    throw "pnpm was not found. Run scripts/setup.ps1 first."
  }

  pnpm dev
} finally {
  Pop-Location
}
