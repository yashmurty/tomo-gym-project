#!/usr/bin/env bash
# Regenerates the typed API client from swagger.json via Orval.
set -euo pipefail

npx orval --config orval.config.ts
