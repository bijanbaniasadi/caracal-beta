param(
  [string] $ComposeFile = "docker-compose.prod.yml",
  [string] $EnvFile = ".env.production",
  [string] $BackupDir = "backups",
  [string] $PostgresUser = $env:POSTGRES_USER,
  [string] $PostgresDb = $env:POSTGRES_DB
)

$ErrorActionPreference = "Stop"
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")

function Get-EnvFileValue {
  param([string] $Key)

  if (-not (Test-Path -LiteralPath $EnvFile)) {
    return $null
  }

  $line = Get-Content -LiteralPath $EnvFile |
    Where-Object { $_ -match "^$([regex]::Escape($Key))=" } |
    Select-Object -Last 1

  if (-not $line) {
    return $null
  }

  return ($line -replace "^[^=]+=", "").Trim('"', "'")
}

if (-not $PostgresUser) {
  $PostgresUser = Get-EnvFileValue -Key "POSTGRES_USER"
}

if (-not $PostgresDb) {
  $PostgresDb = Get-EnvFileValue -Key "POSTGRES_DB"
}

$PostgresUser = if ($PostgresUser) { $PostgresUser } else { "caracal" }
$PostgresDb = if ($PostgresDb) { $PostgresDb } else { "caracal" }

if ([System.IO.Path]::IsPathRooted($BackupDir)) {
  $backupPath = $BackupDir
} else {
  $backupPath = Resolve-Path -LiteralPath "." | ForEach-Object { Join-Path $_ $BackupDir }
}
New-Item -ItemType Directory -Force -Path $backupPath | Out-Null

$dbDump = Join-Path $backupPath "postgres-$timestamp.sql"
$uploadsArchive = Join-Path $backupPath "api-uploads-$timestamp.tgz"
$logsArchive = Join-Path $backupPath "api-logs-$timestamp.tgz"
$configArchive = Join-Path $backupPath "config-$timestamp.zip"

Write-Host "Creating PostgreSQL backup: $dbDump"
docker compose --env-file $EnvFile -f $ComposeFile exec -T postgres `
  pg_dump -U $PostgresUser -d $PostgresDb --clean --if-exists |
  Out-File -FilePath $dbDump -Encoding utf8

Write-Host "Creating upload volume backup: $uploadsArchive"
docker run --rm `
  -v caracal-api-uploads:/data:ro `
  -v "${backupPath}:/backup" `
  alpine:3.20 tar -czf "/backup/$(Split-Path $uploadsArchive -Leaf)" -C /data .

Write-Host "Creating API log volume backup: $logsArchive"
docker run --rm `
  -v caracal-api-logs:/data:ro `
  -v "${backupPath}:/backup" `
  alpine:3.20 tar -czf "/backup/$(Split-Path $logsArchive -Leaf)" -C /data .

Write-Host "Creating deployment config backup: $configArchive"
$configItems = @(
  ".env.production",
  "docker-compose.yml",
  "docker-compose.prod.yml",
  "docker/nginx/conf.d",
  "docker/nginx/certs/README.md"
) | Where-Object { Test-Path -LiteralPath $_ }
Compress-Archive -Path $configItems -DestinationPath $configArchive -Force

Write-Host "Backup complete:"
Write-Host "- $dbDump"
Write-Host "- $uploadsArchive"
Write-Host "- $logsArchive"
Write-Host "- $configArchive"
