# Project Instructions

## After push or merge to main

Always check CI:

```bash
gh run list --repo hermes98761234/browser-shooter --branch main --limit 2
gh run watch <run-id> --exit-status
```

If build fails, fix and push before reporting done.
