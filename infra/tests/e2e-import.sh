#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# E2E Smoke Test — CSV Import Pipeline
# Verifies: health → upload → queue processing → status → rows
#
# Usage:
#   bash infra/tests/e2e-import.sh [BASE_URL]
#
# Defaults to https://cloud-saas-engine-api.jjioji.workers.dev
# ─────────────────────────────────────────────────────────────

set -euo pipefail

BASE_URL="${1:-https://cloud-saas-engine-api.jjioji.workers.dev}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CSV_FILE="$SCRIPT_DIR/fixtures/test-donations.csv"
TIMEOUT=60
EXPECTED_ROWS=5

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

pass=0
fail=0

check() {
  local name="$1"
  local condition="$2"
  if eval "$condition"; then
    echo -e "  ${GREEN}✓${NC} $name"
    ((pass++))
  else
    echo -e "  ${RED}✗${NC} $name"
    ((fail++))
  fi
}

echo ""
echo "═══════════════════════════════════════════════"
echo "  Cloud SaaS Engine — E2E Smoke Test"
echo "  Target: $BASE_URL"
echo "═══════════════════════════════════════════════"
echo ""

# ─── 1. Health Check ──────────────────────────────
echo "① Health Check"
HEALTH=$(curl -sf "$BASE_URL/health" 2>/dev/null || echo '{}')
check "GET /health returns ok" "echo '$HEALTH' | jq -e '.ok == true' > /dev/null 2>&1"
check "D1 binding healthy" "echo '$HEALTH' | jq -e '.bindings.d1 == true' > /dev/null 2>&1"
check "R2 binding healthy" "echo '$HEALTH' | jq -e '.bindings.r2 == true' > /dev/null 2>&1"
check "KV binding healthy" "echo '$HEALTH' | jq -e '.bindings.kv == true' > /dev/null 2>&1"
check "Queue binding healthy" "echo '$HEALTH' | jq -e '.bindings.queue == true' > /dev/null 2>&1"
echo ""

# ─── 2. Upload CSV ────────────────────────────────
echo "② Upload CSV ($EXPECTED_ROWS rows)"
if [ ! -f "$CSV_FILE" ]; then
  echo -e "  ${RED}✗${NC} Test fixture not found: $CSV_FILE"
  exit 1
fi

UPLOAD=$(curl -sf -X POST "$BASE_URL/files/upload" \
  -F "file=@$CSV_FILE" \
  -F "tenant_id=e2e-test" 2>/dev/null || echo '{}')

check "POST /files/upload returns ok" "echo '$UPLOAD' | jq -e '.ok == true' > /dev/null 2>&1"

JOB_ID=$(echo "$UPLOAD" | jq -r '.data.jobId // .job_id // empty' 2>/dev/null)
if [ -z "$JOB_ID" ]; then
  echo -e "  ${RED}✗${NC} No jobId returned from upload"
  echo "  Response: $UPLOAD"
  exit 1
fi
check "jobId returned" "[ -n '$JOB_ID' ]"
echo -e "  ${YELLOW}→${NC} Job ID: $JOB_ID"
echo ""

# ─── 3. Poll Job Status ──────────────────────────
echo "③ Poll Job Status (timeout: ${TIMEOUT}s)"
START=$SECONDS
STATUS="pending"

while [ $((SECONDS - START)) -lt $TIMEOUT ]; do
  RESP=$(curl -sf "$BASE_URL/jobs/$JOB_ID/status" 2>/dev/null || echo '{}')
  STATUS=$(echo "$RESP" | jq -r '.data.status // .status // "unknown"' 2>/dev/null)

  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    break
  fi

  echo -e "  ${YELLOW}…${NC} Status: $STATUS (${SECONDS}s elapsed)"
  sleep 2
done

ELAPSED=$((SECONDS - START))
check "Job reached terminal state" "[ '$STATUS' = 'completed' ] || [ '$STATUS' = 'failed' ]"
check "Job completed (not failed)" "[ '$STATUS' = 'completed' ]"
echo -e "  ${YELLOW}→${NC} Final status: $STATUS (${ELAPSED}s)"

# Check row counts
TOTAL=$(echo "$RESP" | jq -r '.data.total_rows // .total_rows // 0' 2>/dev/null)
PROCESSED=$(echo "$RESP" | jq -r '.data.processed_rows // .processed_rows // 0' 2>/dev/null)
ERRORS=$(echo "$RESP" | jq -r '.data.error_count // .error_count // 0' 2>/dev/null)

check "total_rows = $EXPECTED_ROWS" "[ '$TOTAL' = '$EXPECTED_ROWS' ]"
check "processed_rows = $EXPECTED_ROWS" "[ '$PROCESSED' = '$EXPECTED_ROWS' ]"
check "error_count = 0" "[ '$ERRORS' = '0' ]"
echo ""

# ─── 4. Verify Rows ──────────────────────────────
echo "④ Verify Imported Rows"
ROWS_RESP=$(curl -sf "$BASE_URL/jobs/$JOB_ID/rows?limit=10" 2>/dev/null || echo '{}')
ROW_COUNT=$(echo "$ROWS_RESP" | jq -r '.data.rows | length // 0' 2>/dev/null)

check "GET /jobs/:id/rows returns data" "echo '$ROWS_RESP' | jq -e '.ok == true' > /dev/null 2>&1"
check "Row count matches ($ROW_COUNT)" "[ '$ROW_COUNT' = '$EXPECTED_ROWS' ]"

# Spot check first row
FIRST_ROW=$(echo "$ROWS_RESP" | jq -r '.data.rows[0].raw_data // empty' 2>/dev/null)
if [ -n "$FIRST_ROW" ]; then
  check "First row has donor_name" "echo '$FIRST_ROW' | jq -e '.donor_name' > /dev/null 2>&1"
  check "First row has amount" "echo '$FIRST_ROW' | jq -e '.amount' > /dev/null 2>&1"
fi
echo ""

# ─── 5. 404 Check ────────────────────────────────
echo "⑤ Error Handling"
NOT_FOUND=$(curl -sf -o /dev/null -w "%{http_code}" "$BASE_URL/nonexistent" 2>/dev/null || echo "000")
check "GET /nonexistent returns 404" "[ '$NOT_FOUND' = '404' ]"

FAKE_JOB=$(curl -sf -o /dev/null -w "%{http_code}" "$BASE_URL/jobs/00000000-0000-0000-0000-000000000000/status" 2>/dev/null || echo "000")
check "GET /jobs/fake/status returns 404" "[ '$FAKE_JOB' = '404' ]"
echo ""

# ─── Summary ──────────────────────────────────────
echo "═══════════════════════════════════════════════"
TOTAL_TESTS=$((pass + fail))
if [ $fail -eq 0 ]; then
  echo -e "  ${GREEN}ALL $TOTAL_TESTS TESTS PASSED ✓${NC}"
  echo "═══════════════════════════════════════════════"
  exit 0
else
  echo -e "  ${RED}$fail/$TOTAL_TESTS TESTS FAILED ✗${NC}"
  echo "═══════════════════════════════════════════════"
  exit 1
fi
