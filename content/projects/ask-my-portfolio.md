---
title: Ask my portfolio
summary: A retrieval-augmented chat assistant that answers recruiters' questions about Alexander with cited sources.
period: TODO
featured: true
order: 1
---

## Problem

Recruiters and hiring managers skim portfolios quickly and often have specific
questions: "has he used TypeScript in production?", "is he open to relocation?". The
answer is usually on the site somewhere, but finding it takes more time than they'll
spend. This assistant answers those questions directly, using only Alexander's own
content. It cites the section each claim comes from and says so when it doesn't know,
instead of guessing.

## Stack

- Next.js (App Router) and TypeScript, deployed on Vercel
- Vercel AI SDK for token-by-token streaming
- Anthropic Claude Haiku for answer generation
- TODO: Embedding model (decided in the ingest phase)
- Supabase Postgres with pgvector, plus Postgres full-text search for hybrid retrieval
- Upstash Redis for per-IP rate limiting
- GitHub Actions for re-ingesting content and running evals on pull requests

## My role

<!-- State this exactly as true. Say what you designed, built and measured. -->

TODO: e.g. "Sole developer: designed the ingest and retrieval pipeline, the chat widget and the evaluation harness."

## Results

<!--
Fill this in from the eval results, not before. Good candidates are correctness,
citation accuracy and refusal rate for baseline vs retrieval, p50/p95 latency and
cost per 1,000 questions.
-->

TODO: Eval results (baseline vs retrieval), latency, cost per 1,000 questions.

## Links

- TODO: Live site URL
- TODO: Source code URL
