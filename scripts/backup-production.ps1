param(
  [string] $ComposeFile = "docker-compose.prod.yml",
  [string] $EnvFile = ".env.production",
  [string] $BackupDir = "backups",
  [string] $PostgresUser = $(if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "caracal" }),
  [string] $PostgresDb = $(if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "caracal" })
)

$ErrorActionPreference = "Stop"
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$backupPath = Resolve-Path -LiteralPath "." | ForEach-Object { Join-Path $_ $BackupDir }
New-Item -ItemType Directory -Force -Path $backupPath | Out-Null

$dbDump = Join-Path $backupPath "postgres-$timestamp.sql"
$uploadsArchive = Join-Path $backupPath "api-uploads-$timestamp.tgz"
$logsArchive = Join-Path $backupPath "api-logs-$timestamp.tgz"

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

Write-Host "Backup complete:"
Write-Host "- $dbDump"
Write-Host "- $uploadsArchive"
Write-Host "- $logsArchive"
