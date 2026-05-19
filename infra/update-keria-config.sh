#!/usr/bin/env bash
# Re-pulls KERIA + witness config from cardano-foundation/veridian-wallet.
# These files configure the demo witness network and KERIA backer OOBIs.
set -euo pipefail
DEST="$(cd "$(dirname "$0")" && pwd)/keria-config"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git clone --depth 1 https://github.com/cardano-foundation/veridian-wallet "$TMP/vw"
rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$TMP/vw/keria-config/." "$DEST/"
echo "Vendored keria-config from veridian-wallet:"
ls -R "$DEST"
