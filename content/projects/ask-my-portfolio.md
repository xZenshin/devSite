---
title: Ask my portfolio
summary: A retrieval-augmented chat assistant on this site that answers from the site's own content and cites its sources.
period: 2026
featured: false
solo: true
order: 3
---

## Summary

Ask my portfolio is the chat assistant on this website. Visitors can ask about Alexander's projects, experience and skills and get a reply of a few sentences, drawn only from the site's own content. Every claim links to the section it comes from, and when the site doesn't cover something, the assistant says so instead of guessing. It is built for recruiters and hiring managers, who spend little time on each portfolio and would otherwise have to look through several pages.

## Stack

- Next.js (App Router) and TypeScript, deployed on Vercel
- Vercel AI SDK for token-by-token streaming
- Anthropic Claude Haiku for answer generation
- Voyage AI voyage-4-lite embeddings
- Supabase Postgres with pgvector, plus Postgres full-text search for hybrid retrieval
- Vercel Firewall for per-IP rate limiting
- GitHub Actions for re-ingesting content and running evals on pull requests

## Key decisions

<!-- The main design decisions and why. Solo is already shown from `solo: true`. -->

TODO: e.g. "Retrieval: ... chosen because ..."

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
