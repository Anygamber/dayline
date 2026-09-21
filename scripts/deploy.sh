#!/usr/bin/env bash
# Deploy Dayline: Cloud Run (FastAPI) + Firebase Hosting (web).
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-dayline-app}"
REGION="${REGION:-europe-west1}"
SERVICE="${SERVICE:-dayline-api}"
REPOSITORY="${REPOSITORY:-dayline}"
HOSTING_ONLY="${HOSTING_ONLY:-0}"
API_ONLY="${API_ONLY:-0}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/api:latest"

echo "==> Project: $PROJECT_ID  Region: $REGION"

if [[ "$HOSTING_ONLY" != "1" ]]; then
  echo "==> Build & push Cloud Run image"
  gcloud builds submit --tag "$IMAGE" --project "$PROJECT_ID"

  echo "==> Deploy Cloud Run service $SERVICE"
  gcloud run deploy "$SERVICE" \
    --image "$IMAGE" \
    --project "$PROJECT_ID" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --port 8080 \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 3 \
    --set-env-vars "ENVIRONMENT=production,APP_HOST=0.0.0.0,DATABASE_URL=sqlite:////tmp/dayline.db,CORS_ORIGINS=https://${PROJECT_ID}.web.app,https://${PROJECT_ID}.firebaseapp.com,http://localhost:8081"
fi

if [[ "$API_ONLY" != "1" ]]; then
  echo "==> Prepare Hosting public/"
  bash "$ROOT/scripts/prepare-hosting.sh"

  echo "==> Firebase Hosting deploy"
  firebase deploy --only hosting --project "$PROJECT_ID"
fi

echo ""
echo "Done."
echo "  Web:  https://${PROJECT_ID}.web.app"
echo "  API:  https://${PROJECT_ID}.web.app/api/…  (via Hosting → Cloud Run)"
