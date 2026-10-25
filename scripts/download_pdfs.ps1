param(
  [string]$ConfigPath = "config/sources.json"
)

if (-not (Test-Path $ConfigPath)) {
  Write-Error "Config file not found: $ConfigPath"
  exit 1
}

$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json

foreach ($src in $config.priceListSources) {
  $target = Join-Path -Path (Get-Location) -ChildPath $src.localFile
  Write-Host "Downloading $($src.url) -> $target"
  Invoke-WebRequest -Uri $src.url -OutFile $target
}

Write-Host "Download complete."
