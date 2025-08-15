# Performance CI Test - Updated

This file is created to test the GitHub Actions performance workflow.

## Test Details

- **Created**: 2025-08-14
- **Updated**: 2025-08-15 02:07 UTC
- **Purpose**: Trigger performance CI workflow with backend change
- **Expected**: 30s/50VU smoke test should run on PR

## Results Expected

- ✅ Smoke test runs automatically
- ✅ Performance thresholds validated
- ✅ PR comment with results
- ✅ Pass/fail status reported

This change should trigger the performance workflow when a PR is created.

## Workflow Trigger Test

This update specifically targets the backend directory to ensure the GitHub Actions workflow triggers properly based on the path filter:

```yaml
paths:
  - "india-news-app/backend/**"
```

The workflow should now detect this backend change and run the k6 performance tests.
