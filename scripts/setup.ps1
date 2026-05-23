Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Require-Command {
  param([string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found on PATH."
  }
}

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
  Require-Command git
  Require-Command node

  if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    if (Get-Command corepack -ErrorAction SilentlyContinue) {
      corepack enable
      corepack prepare pnpm@8.15.9 --activate
    } else {
      throw "pnpm was not found and corepack is unavailable."
    }
  }

  if (-not (Test-Path -LiteralPath '.env.local') -and (Test-Path -LiteralPath '.env.example')) {
    Copy-Item -LiteralPath '.env.example' -Destination '.env.local'
    Write-Host 'Created .env.local from .env.example'
  }

  pnpm install
  Write-Host 'Setup complete. Start development with: pnpm dev'
} finally {
  Pop-Location
}
