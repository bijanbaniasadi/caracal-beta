Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Resolve-Path "$PSScriptRoot\.."
$requiredPaths = @(
  '.git',
  '.gitignore',
  'package.json',
  'pnpm-workspace.yaml',
  'turbo.json',
  'tsconfig.json',
  'apps/web/package.json',
  'apps/web/src/app/layout.tsx',
  'apps/web/src/app/page.tsx',
  'apps/api/package.json',
  'apps/api/src/server.ts',
  'packages/@caracal/types/package.json',
  '.github/ISSUE_TEMPLATE/BUG_REPORT.md',
  '.github/PULL_REQUEST_TEMPLATE.md',
  'README.md'
)

foreach ($path in $requiredPaths) {
  $fullPath = Join-Path $root $path
  if (-not (Test-Path -LiteralPath $fullPath)) {
    throw "Missing required path: $path"
  }
}

Get-ChildItem -Path $root -Recurse -Filter package.json |
  ForEach-Object {
    Get-Content -Raw -LiteralPath $_.FullName | ConvertFrom-Json | Out-Null
  }

Write-Host 'Repository structure validation passed.'
