#!/usr/bin/env bash
# Downloads the backend's Swagger JSON into ./swagger.json.
# Override the source with BACKEND_URL, e.g. BACKEND_URL=http://staging:3001 npm run download:swagger
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
OUTPUT="${OUTPUT:-swagger.json}"

echo "Downloading ${BACKEND_URL}/swagger-json -> ${OUTPUT}"
curl -fsSL "${BACKEND_URL}/swagger-json" -o "${OUTPUT}"
echo "Done."
