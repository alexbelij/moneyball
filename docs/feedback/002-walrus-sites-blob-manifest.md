# Walrus Sites: Expose Blob Manifest for Content Verification

**Target:** MystenLabs/walrus-sites  
**Category:** Best Feedback — Walrus Memory World Cup Hackathon  
**Filed by:** Moneyball team (taken.wal.app)

## Context

Moneyball's frontend is hosted on Walrus mainnet via `site-builder`. After running
`site-builder update`, the only proof of what was published is the Walrus site
object ID (`0xa22ada9c09100eaca2571b64a2494f00a5393b012132aa74392bdcc6bd0a3272`).

## Problem

There is no published manifest mapping file paths to their individual Walrus blob IDs.
This means:

1. A judge or user can verify the *site object exists* on-chain but cannot independently
   verify *what content it contains* without downloading and unpacking the entire site.
2. If a specific file (e.g., `index.html` or `main.js`) is suspected to differ from the
   source repo, there is no lightweight way to check its blob ID against a known-good hash.

## Suggestion

After `site-builder publish/update`, emit a JSON manifest:

```json
{
  "siteObject": "0xa22ada...",
  "epoch": 25,
  "files": {
    "/index.html": { "blobId": "0x...", "sha256": "abc...", "size": 4096 },
    "/assets/main.js": { "blobId": "0x...", "sha256": "def...", "size": 1523456 }
  }
}
```

Options for surfacing this manifest:
- Write to stdout / a local file after publish
- Optionally commit to the site as `/.well-known/walrus-manifest.json`

This enables per-file verification without downloading the full site.
