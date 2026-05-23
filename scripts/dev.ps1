Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Add-PathIfExists {
  param([string]$Path)

  if ((Test-Path -LiteralPath $Path) -and -not (($env:PATH -split ';') -contains $Path)) {
    $env:PATH = "$Path;$env:PATH"
  }
}

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
  Add-PathIfExists 'C:\Program Files\nodejs'
  Add-PathIfExists (Join-Path $env:APPDATA 'npm')

  if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    throw "pnpm was not found. Run scripts/setup.ps1 first."
  }

  pnpm dev
} finally {
  Pop-Location
}
