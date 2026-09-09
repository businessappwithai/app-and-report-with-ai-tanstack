#!/usr/bin/env bash
#
# Prove both applications are actually serving on port 80.
#
# Deliberately checks content types, not just status codes. The failure this
# exists to catch does not produce a 404: an application served under a URL
# prefix it was not built for answers a stylesheet request with its own HTML
# fallback, 200 and all, and a browser reports nothing while the page renders
# unstyled and inert. `%{content_type}` is the assertion that catches it.
#
#   ORIGIN=http://localhost bash common/build/smoke.sh
set -uo pipefail

ORIGIN="${ORIGIN:-http://localhost}"
FAILED=0

probe() { # url, expected-status, expected-content-type-substring, label
  local url="$1" want_status="$2" want_type="$3" label="$4"
  local out status type size
  out=$(curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}' --max-time 30 "$url" 2>/dev/null) || out="000 - 0"
  read -r status type size <<<"$out"
  if [[ "$status" == "$want_status" && "$type" == *"$want_type"* ]]; then
    printf '  ok    %-46s %s  %s  %sb\n' "$label" "$status" "$type" "$size"
  else
    printf '  FAIL  %-46s %s  %s  %sb  (wanted %s / %s)\n' \
      "$label" "$status" "$type" "$size" "$want_status" "$want_type"
    FAILED=$((FAILED + 1))
  fi
}

echo "Front door"
probe "$ORIGIN/healthz" 200 text/plain "/healthz"

echo
echo "The generated application"
probe "$ORIGIN/app/"            200 text/html        "/app/ (its own redirect followed)"
probe "$ORIGIN/api/me/health"   200 application/json "/api/me/health"

# Its assets are root-absolute and its own — the proxy routes those namespaces
# to it, because that framework version cannot be built under a prefix.
mapfile -t APP_ASSETS < <(curl -sL --max-time 30 "$ORIGIN/app/" 2>/dev/null \
  | grep -aoE '(src|href)="/_build/[^"]*"' | sed 's/.*="//;s/"//' | sort -u | head -4)
if [[ ${#APP_ASSETS[@]} -eq 0 ]]; then
  echo "  FAIL  /app/ referenced no /_build/ asset — the page is not the application"
  FAILED=$((FAILED + 1))
else
  for a in "${APP_ASSETS[@]}"; do
    case "$a" in
      *.css) probe "$ORIGIN$a" 200 text/css "$a" ;;
      *)     probe "$ORIGIN$a" 200 javascript "$a" ;;
    esac
  done
fi

echo
echo "The reporting platform"
probe "$ORIGIN/report/"           200 text/html        "/report/"
probe "$ORIGIN/report/api/health" 200 application/json "/report/api/health"

# Everything it asks for is under its own prefix, which is what keeps the two
# from contending for a path.
mapfile -t REPORT_ASSETS < <(curl -sL --max-time 30 "$ORIGIN/report/" 2>/dev/null \
  | grep -aoE 'href="/report/assets/[^"]*"' | sed 's/.*="//;s/"//' | sort -u | head -3)
if [[ ${#REPORT_ASSETS[@]} -eq 0 ]]; then
  echo "  FAIL  /report/ referenced no /report/assets/ asset — the prefix did not apply"
  FAILED=$((FAILED + 1))
else
  for a in "${REPORT_ASSETS[@]}"; do
    case "$a" in
      *.css) probe "$ORIGIN$a" 200 text/css "$a" ;;
      *)     probe "$ORIGIN$a" 200 javascript "$a" ;;
    esac
  done
fi

echo
if [[ $FAILED -gt 0 ]]; then
  echo "${FAILED} check(s) failed."
  exit 1
fi
echo "Both applications are serving on ${ORIGIN}."
