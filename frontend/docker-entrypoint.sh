#!/bin/sh
set -eu

HTPASSWD_FILE="/etc/nginx/.htpasswd_admin"

if [ -n "${ADMIN_BASIC_AUTH_USER:-}" ] && [ -n "${ADMIN_BASIC_AUTH_PASS:-}" ]; then
  # Overwrite each boot so updates take effect after container restart.
  htpasswd -bc "$HTPASSWD_FILE" "$ADMIN_BASIC_AUTH_USER" "$ADMIN_BASIC_AUTH_PASS" >/dev/null 2>&1 || {
    echo "Failed to generate htpasswd file" >&2
    exit 1
  }
else
  # No credentials provided: create an effectively unusable credential so /api/admin stays protected.
  # (Prevents nginx startup failure due to missing auth file.)
  RANDOM_PASS="$(date +%s | sha256sum | head -c 32)"
  htpasswd -bc "$HTPASSWD_FILE" "disabled" "$RANDOM_PASS" >/dev/null 2>&1 || true
fi

exec nginx -g "daemon off;"

