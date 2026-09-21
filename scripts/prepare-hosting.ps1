# Prepare Firebase Hosting public/ from static/ (keeps /static/* URLs).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Src = Join-Path $Root "static"
$Dst = Join-Path $Root "hosting\public"

if (-not (Test-Path $Src)) { throw "Missing static/ folder" }

if (Test-Path $Dst) {
  Get-ChildItem $Dst -Force | Where-Object { $_.Name -ne ".gitkeep" } | Remove-Item -Recurse -Force
} else {
  New-Item -ItemType Directory -Path $Dst | Out-Null
}

$StaticOut = Join-Path $Dst "static"
New-Item -ItemType Directory -Path $StaticOut -Force | Out-Null
Copy-Item (Join-Path $Src "*") $StaticOut -Recurse -Force

# Root index for Hosting
Copy-Item (Join-Path $Src "index.html") (Join-Path $Dst "index.html") -Force

Write-Host "Hosting public ready: $Dst"
