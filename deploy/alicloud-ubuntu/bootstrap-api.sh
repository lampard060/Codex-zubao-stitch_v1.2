#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${1:-/srv/zubao}"
API_DIR="$REPO_DIR/api-server"

if [ ! -d "$API_DIR" ]; then
  echo "[bootstrap-api] api-server directory not found: $API_DIR" >&2
  exit 1
fi

cd "$API_DIR"

if [ ! -f ".env" ]; then
  if [ -f ".env.production.example" ]; then
    cp .env.production.example .env
    echo "[bootstrap-api] created .env from .env.production.example"
  else
    echo "[bootstrap-api] missing .env and .env.production.example" >&2
    exit 1
  fi
fi

echo "[bootstrap-api] installing dependencies"
npm install

echo "[bootstrap-api] applying schema"
npm run db:schema

echo "[bootstrap-api] applying upgrades"
npm run db:upgrade

echo "[bootstrap-api] applying baseline seed"
npm run db:seed

echo "[bootstrap-api] done"
