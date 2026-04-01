#!/usr/bin/env bash
# Creates credentials.json for EAS iOS builds (no Apple ID needed in terminal).
# Usage: ./create-credentials-json.sh [path-to.p12] [path-to.mobileprovision]
# Or run and pass paths when prompted. P12 password is always prompted.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_FILE="${SCRIPT_DIR}/credentials.json"

DEFAULT_P12="${SCRIPT_DIR}/Certificates.p12"
DEFAULT_PROV="${SCRIPT_DIR}/EstateLink_iOS_AppStore.mobileprovision"

P12_PATH="${1:-$DEFAULT_P12}"
PROV_PATH="${2:-$DEFAULT_PROV}"

if [ ! -f "$P12_PATH" ]; then
  echo "Path to .p12 file (default $DEFAULT_P12):"
  read -r P12_PATH
  P12_PATH="${P12_PATH:-$DEFAULT_P12}"
fi
if [ ! -f "$PROV_PATH" ]; then
  echo "Path to .mobileprovision file (default $DEFAULT_PROV):"
  read -r PROV_PATH
  PROV_PATH="${PROV_PATH:-$DEFAULT_PROV}"
fi

if [ ! -f "$P12_PATH" ]; then
  echo "Error: P12 file not found: $P12_PATH"
  exit 1
fi
if [ ! -f "$PROV_PATH" ]; then
  echo "Error: Provisioning profile not found: $PROV_PATH"
  exit 1
fi

echo "P12 password:"
read -rs CERT_PASSWORD
echo ""

# Paths: use basename if files are in SCRIPT_DIR (run eas credentials from Estate_link_App)
P12_RELATIVE="$(basename "$P12_PATH")"
PROV_RELATIVE="$(basename "$PROV_PATH")"
if [ "$(cd "$(dirname "$P12_PATH")" && pwd)" != "$SCRIPT_DIR" ] || [ "$(cd "$(dirname "$PROV_PATH")" && pwd)" != "$SCRIPT_DIR" ]; then
  P12_RELATIVE="$P12_PATH"
  PROV_RELATIVE="$PROV_PATH"
fi

# Escape for JSON (backslash and quote)
escape_json() { echo "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
P12_ESC=$(escape_json "$P12_RELATIVE")
PROV_ESC=$(escape_json "$PROV_RELATIVE")
CERT_PASSWORD_ESC=$(escape_json "$CERT_PASSWORD")
unset CERT_PASSWORD

# EAS expects path-based format (see docs.expo.dev/app-signing/local-credentials)
# Run "eas credentials" from Estate_link_App so these paths resolve.
cat > "$OUT_FILE" << CREDEOF
{
  "ios": {
    "provisioningProfilePath": "$PROV_ESC",
    "distributionCertificate": {
      "path": "$P12_ESC",
      "password": "$CERT_PASSWORD_ESC"
    }
  }
}
CREDEOF

echo "Created: $OUT_FILE"
echo "Run 'eas credentials --platform ios' from $(basename "$SCRIPT_DIR")/ then: credentials.json → Upload"
