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

- **One source for pages and answers.** The site's pages and the assistant are built from the same Markdown files with the same parser, so every citation links to a heading that exists on the page. Each `##` section is one chunk; only sections over about 500 tokens are split, so a citation points at exactly one section.
- **Grounded, cited answers.** The model may only use the retrieved sources, must cite every claim with a source number, and declines when the sources don't cover the question. Visitor messages are wrapped in tags and treated as questions, never as instructions.
- **A fallback that always answers.** A second mode puts all content in the prompt instead, using prompt caching. If the database or the embedding API is down, the assistant switches to it, so visitors still get an answer.
- **Limits on cost and abuse.** Requests are rate-limited per IP, questions are capped at 500 characters, only the last six messages are sent, and each answer has an output-token limit. When content changes on main, it is re-ingested automatically, and only chunks whose content hash changed are embedded again.

## Results

- With retrieval, 99.2% of answers pass; with all content in the prompt, 98.3%. Every
  question that should be declined was declined.
- Typical response time is about 1.5 seconds, and 1,000 questions cost about $0.17.

## Links

- Livesite: You're on it
- Github: [Source code URL](https://github.com/xZenshin/devSite)
