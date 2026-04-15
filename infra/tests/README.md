# End-to-End Tests

## CSV Import Pipeline Smoke Test

Verifies the full pipeline: health → upload → queue processing → status → rows.

### Run

```bash
# Against production
bash infra/tests/e2e-import.sh

# Against a custom URL
bash infra/tests/e2e-import.sh https://your-worker.your-subdomain.workers.dev
```

### Requirements

- `curl` and `jq` must be installed
- The target Worker must be deployed and healthy

### What it tests

1. **Health** — all 4 bindings (D1, R2, KV, Queue) are connected
2. **Upload** — CSV upload returns a jobId
3. **Processing** — job reaches `completed` within 60s
4. **Row counts** — total/processed/errors match expected values
5. **Row data** — imported rows contain expected fields
6. **Error handling** — 404 for unknown routes and fake job IDs

### Test fixture

`fixtures/test-donations.csv` — 5 donation records with donor_name, amount, date, fund, memo.
