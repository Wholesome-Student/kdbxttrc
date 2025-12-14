#!/usr/bin/env bash

set -euo pipefail

source "$(dirname "$0")/.env"

COMPOSE="docker compose"
PROJECT_DIR=$(cd "$(dirname "$0")/.." && pwd)

echo "Dockerを停止し、ボリュームを削除しています..."
$COMPOSE down -v

echo "サービスを起動しています..."
$COMPOSE up -d