# Deploy Dayline: Cloud Run (FastAPI) + Firebase Hosting (web).
# Prerequisites: gcloud + firebase-tools authenticated; Artifact Registry repo created (see DEPLOY.md).
param(
  [string]$ProjectId = "dayline-app",
  [string]$Region = "europe-west1",
  [string]$Service = "dayline-api",
  [string]$Repository = "dayline",
  [switch]$HostingOnly,
  [switch]$ApiOnly
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$Image = "$Region-docker.pkg.dev/$ProjectId/$Repository/api:latest"

Write-Host "==> Project: $ProjectId  Region: $Region"

if (-not $HostingOnly) {
  Write-Host "==> Build & push Cloud Run image"
  gcloud builds submit --tag $Image --project $ProjectId

  Write-Host "==> Deploy Cloud Run service $Service"
  gcloud run deploy $Service `
    --image $Image `
    --project $ProjectId `
    --region $Region `
    --platform managed `
    --allow-unauthenticated `
    --port 8080 `
    --memory 512Mi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 3 `
    --set-env-vars "ENVIRONMENT=production,APP_HOST=0.0.0.0,DATABASE_URL=sqlite:////tmp/dayline.db,CORS_ORIGINS=https://$ProjectId.web.app,https://$ProjectId.firebaseapp.com,http://localhost:8081"
}

if (-not $ApiOnly) {
  Write-Host "==> Prepare Hosting public/"
  & "$PSScriptRoot\prepare-hosting.ps1"

  Write-Host "==> Firebase Hosting deploy"
  firebase deploy --only hosting --project $ProjectId
}

Write-Host ""
Write-Host "Done."
Write-Host "  Web:  https://$ProjectId.web.app"
Write-Host "  API:  https://$ProjectId.web.app/api/…  (via Hosting → Cloud Run)"
Write-Host "  Health rewrite: https://$ProjectId.web.app/health"
