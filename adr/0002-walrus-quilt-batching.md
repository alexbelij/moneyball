# ADR-0002: Walrus Quilt batching for small JSON documents

**Status:** Accepted  
**Date:** 2026-06-07

## Context
Walrus per-blob overhead makes storing many small JSON blobs inefficient. Project stores many small memory documents (predictions, evolution, user summaries).

## Decision
Batch small JSON documents using Walrus Quilt. Store “latest pointers” outside Walrus (MVP: off-chain index). Avoid high-frequency writes to Walrus.

## Alternatives
- One-blob-per-document (too expensive)
- Store everything off-chain (fails Walrus Memory goal)

## Consequences
Need an index mapping logical keys to quilt file refs.