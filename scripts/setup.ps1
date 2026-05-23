Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Add-PathIfExists {
  param([string]$Path)

  if ((Test-Path -LiteralPath $Path) -and -not (($env:PATH -split ';') -contains $Path)) {
    $env:PATH = "$Path;$env:PATH"
  }
}

function Require-Command {
  param([string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found on PATH."
  }
}

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
  Add-PathIfExists 'C:\Program Files\nodejs'
  Add-PathIfExists (Join-Path $env:APPDATA 'npm')

  Require-Command git
  Require-Command node

  if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    if (Get-Command corepack -ErrorAction SilentlyContinue) {
      $npmDir = Join-Path $env:APPDATA 'npm'
      New-Item -ItemType Directory -Force -Path $npmDir | Out-Null
      corepack enable --install-directory $npmDir
      corepack prepare pnpm@8.15.9 --activate
    } else {
      throw "pnpm was not found and corepack is unavailable."
    }
  }

  if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    pnpm --version | Out-Null
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
