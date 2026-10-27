---
title: Ask my portfolio
summary: A retrieval-augmented chat assistant on this site that answers from the site's own content and cites its sources.
period: 2026
featured: false
order: 1
---

## Problem

Recruiters and hiring managers spend little time on each portfolio, and the detail they
need is often spread across several pages. This project adds an assistant to the site
that replies in a few sentences, using only the site's own content. Every claim links to
the section it comes from, and when the site doesn't cover something, the assistant says
so instead of guessing.

## Stack

- Next.js (App Router) and TypeScript, deployed on Vercel
- Vercel AI SDK for token-by-token streaming
- Anthropic Claude Haiku for answer generation
- Voyage AI voyage-4-lite embeddings
- Supabase Postgres with pgvector, plus Postgres full-text search for hybrid retrieval
- Vercel Firewall for per-IP rate limiting
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

Measured with a 40-question evaluation (30 answerable questions and 10 that should be
declined), run 3 times per question and graded fact by fact:

- With retrieval, 99.2% of answers pass; with all content in the prompt, 98.3%. Every
  question that should be declined was declined.
- Retrieval accuracy rose from 95.0% to 99.2% through three evaluation-driven changes:
  adding context headers to chunks, rewording content that matched every question, and
  limiting keyword search to names and technical terms.
- Typical response time is about 1.5 seconds, and 1,000 questions cost about $0.17.

## Links

- TODO: Live site URL
- TODO: Source code URL
