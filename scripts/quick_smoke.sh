#!/usr/bin/env bash
# Quick smoke test for IIoT Gateway webapp.
# Runs the most critical checks in ~30s.
# Usage: bash scripts/quick_smoke.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass=0
fail=0
warn=0

log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; pass=$((pass+1)); }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; fail=$((fail+1)); }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; warn=$((warn+1)); }

echo "=== IIoT Gateway Quick Smoke Test ==="
echo ""

# 1. Docker stack running
echo "--- 1. Stack health ---"
SERVICES=$(docker compose ps --services 2>/dev/null)
if [ -z "$SERVICES" ]; then
  log_fail "Docker stack not running. Run 'make up' first."
  exit 1
fi
for svc in postgres influxdb emqx redis backend webapp; do
  STATUS=$(docker compose ps --format "{{.Status}}" --status running "$svc" 2>/dev/null | head -1)
  if echo "$STATUS" | grep -q "Up\|healthy"; then
    log_pass "Service $svc: $STATUS"
  else
    log_fail "Service $svc: $STATUS (or not found)"
  fi
done
echo ""

# 2. Backend health
echo "--- 2. Backend health ---"
HEALTH=$(curl -sf http://localhost:8000/healthz 2>/dev/null || echo "FAIL")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  log_pass "GET /healthz: $HEALTH"
else
  log_fail "GET /healthz: $HEALTH"
fi
DOCS=$(curl -sI http://localhost:8000/docs 2>/dev/null | head -1)
if echo "$DOCS" | grep -q "200"; then
  log_pass "GET /docs (Swagger UI): $DOCS"
else
  log_fail "GET /docs: $DOCS"
fi
echo ""

# 3. Webapp serves
echo "--- 3. Webapp ---"
WEBAPP=$(curl -sI http://localhost:5173/ 2>/dev/null | head -1)
if echo "$WEBAPP" | grep -q "200"; then
  log_pass "Webapp on 5173: $WEBAPP"
else
  log_fail "Webapp: $WEBAPP"
fi
echo ""

# 4. Auth flow
echo "--- 4. Auth flow ---"
COOKIE_FILE=$(mktemp)
LOGIN=$(curl -s -c "$COOKIE_FILE" -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  -o /dev/null -w "%{http_code}")
if [ "$LOGIN" = "200" ]; then
  log_pass "POST /api/auth/login: 200"
else
  log_fail "POST /api/auth/login: $LOGIN (check .env ADMIN_BOOTSTRAP_PASSWORD_HASH)"
fi

if [ "$LOGIN" = "200" ]; then
  ME=$(curl -s -b "$COOKIE_FILE" http://localhost:8000/api/auth/me 2>/dev/null)
  if echo "$ME" | grep -q '"username":"admin"'; then
    log_pass "GET /api/auth/me: $ME"
  else
    log_fail "GET /api/auth/me: $ME"
  fi
fi
rm -f "$COOKIE_FILE"
echo ""

# 5. Devices API
echo "--- 5. Devices ---"
COOKIE_FILE=$(mktemp)
curl -s -c "$COOKIE_FILE" -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' -o /dev/null
DEVICES=$(curl -s -b "$COOKIE_FILE" "http://localhost:8000/api/devices" 2>/dev/null)
COUNT=$(echo "$DEVICES" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
if [ "$COUNT" -gt 0 ]; then
  log_pass "GET /api/devices: $COUNT device(s)"
else
  log_warn "GET /api/devices: 0 devices. Run 'make start-simulator'."
fi
rm -f "$COOKIE_FILE"
echo ""

# 6. Unit tests
echo "--- 6. Unit tests ---"
TEST_RESULT=$(docker compose exec -T backend python -m pytest tests/ 2>&1 | tail -1)
if echo "$TEST_RESULT" | grep -q "25 passed"; then
  log_pass "Unit tests: $TEST_RESULT"
else
  log_fail "Unit tests: $TEST_RESULT"
fi
echo ""

# 7. Negative test (publish bad payload, expect log drop)
echo "--- 7. Negative test (bad payload) ---"
docker compose exec -T backend python -c "
import paho.mqtt.client as mqtt, json, time
c = mqtt.Client()
c.connect('emqx', 1883, 60)
c.publish('devices/SMOKE_NEG/telemetry', json.dumps({
    'device_id':'SMOKE_NEG','ts':int(time.time()),'type':'telemetry',
    'registers':{'temperature':30}
}), qos=1)
c.disconnect()
print('published bad payload')
" 2>&1 | tail -1 > /dev/null
sleep 2
DROP_LOG=$(docker compose logs --since 30s backend 2>&1 | grep -E -c "SMOKE_NEG.*(drop|validation failed|pattern)")
if [ "$DROP_LOG" -gt 0 ]; then
  log_pass "Negative payload dropped (log found)"
else
  log_fail "Negative payload not dropped"
fi
echo ""

# 8. Mqtt pipeline
echo "--- 8. MQTT pipeline ---"
docker compose exec -T backend python -c "
import paho.mqtt.client as mqtt, json, time
c = mqtt.Client()
c.connect('emqx', 1883, 60)
c.publish('devices/SMOKE_PIPE/status', json.dumps({
    'device_id':'SMOKE_PIPE','ts':int(time.time()),'type':'status',
    'state':'online','uptime_s':0
}), qos=1, retain=True)
c.publish('devices/SMOKE_PIPE/telemetry', json.dumps({
    'device_id':'SMOKE_PIPE','ts':int(time.time()),'type':'telemetry',
    'registers':{'hr_100':123}
}), qos=1)
c.disconnect()
print('published')
" 2>&1 | tail -1 > /dev/null
sleep 3
COOKIE_FILE=$(mktemp)
curl -s -c "$COOKIE_FILE" -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' -o /dev/null
PIPE_STATUS=$(curl -s -b "$COOKIE_FILE" "http://localhost:8000/api/devices/SMOKE_PIPE/latest" 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('status',{}).get('state','?'))" 2>/dev/null)
if [ "$PIPE_STATUS" = "online" ]; then
  log_pass "Pipeline: SMOKE_PIPE state=online"
else
  log_warn "Pipeline: SMOKE_PIPE state=$PIPE_STATUS (may need more time)"
fi
rm -f "$COOKIE_FILE"
echo ""

# Summary
echo "=== Summary ==="
TOTAL=$((pass + fail + warn))
echo "Total:  $TOTAL"
echo -e "Passed: ${GREEN}$pass${NC}"
echo -e "Failed: ${RED}$fail${NC}"
echo -e "Warn:   ${YELLOW}$warn${NC}"
echo ""

if [ "$fail" -eq 0 ]; then
  echo -e "${GREEN}✓ Smoke test PASSED${NC}"
  exit 0
else
  echo -e "${RED}✗ Smoke test FAILED ($fail issue(s))${NC}"
  echo "See docs/05_test/test_checklist.md for full manual test"
  exit 1
fi
