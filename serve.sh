#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
lsof -ti :8080 2>/dev/null | while read -r pid; do kill -9 "$pid" 2>/dev/null || true; done
exec python3 -m http.server 8080
