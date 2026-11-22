#!/usr/bin/env bash
# Packages the app into build-<version>.<build_number>.zip
# Usage: scripts/build.sh <build_number> <commit_sha>
set -euo pipefail

BUILD_NUMBER="${1:-local}"
COMMIT="${2:-local}"
VERSION="$(node -p "require('./package.json').version")"
ARTIFACT="build-v${VERSION}.${BUILD_NUMBER}.zip"

rm -rf dist "$ARTIFACT"
mkdir -p dist

cp -r src package.json package-lock.json dist/
cat > dist/build-info.json <<EOF
{
  "version": "${VERSION}",
  "build": "${BUILD_NUMBER}",
  "commit": "${COMMIT:0:7}",
  "builtAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

# Install production dependencies inside dist so the server needs no npm step
(cd dist && npm ci --omit=dev --no-audit --no-fund)

(cd dist && zip -qr "../${ARTIFACT}" .)
echo "Created ${ARTIFACT}"
echo "$ARTIFACT" > artifact-name.txt
