---
title: RepTracker
summary: Built a web-based workout tracker for logging sets, exercises and reps combined with statistics.
period: 2026
featured: false
order: 5
---


## Problem

Logging weights and reps on a phone mid-workout has to work on weak gym signal. Saving every tap over mobile data felt unresponsive. A plain log also doesn't show whether training is progressing: weekly volume, sets per muscle group, strength over time, or lifts that have stalled. RepTracker splits the job in two: a phone-first logger for the gym, and a stats dashboard for a desktop afterwards.

## Stack

- C# and ASP.NET Core 10 minimal APIs: REST API, cookie sessions and rate limiting
- Entity Framework Core 10 with Npgsql: data model, with migrations applied at startup
- PostgreSQL: database
- React 19 and TypeScript: single-page app
- Vite: frontend build and dev server
- TanStack Query: fetching and caching server data
- React Router: routing
- Recharts: stats charts
- Docker: a multi-stage build that produces one image serving both the API and the frontend
- Render: hosting

## My role

Solo project: designed and built the API, data model, statistics, frontend and deployment. Main decisions:

- **One deployable.** The API serves `/api/*` and falls through to the built frontend, so there's one origin, no CORS and a same-site session cookie.
- **Passwordless accounts.** Sign-up generates a 20-digit login code (19 random digits plus a Luhn check digit). The code is stored as an HMAC-SHA256 hash keyed with a secret that's kept outside the database. Sessions are opaque tokens in an HttpOnly cookie, stored hashed so they can be revoked.
- **Offline-tolerant logging.** A workout in progress lives in the browser's local storage, so a tap never waits on the network. Finishing sends the whole workout in one request. The id is generated on the phone, so retrying a save is safe.
- **Bounded hosting cost.** Every endpoint is limited: rate limits per account and per IP, per-user caps on stored data, a ceiling on accounts and limits on request size.
- **Training statistics.** Estimated 1RM uses the Epley formula and ignores sets above 12 reps. Personal records are recomputed by replaying history, so editing a set corrects them. The app also detects stalled lifts and flags likely logging mistakes.
- **Data tools.** CSV import with a preview and all-or-nothing commit, CSV export, and merging of duplicate exercises.
- **Accessible charts.** The chart colour palette was checked for contrast and colour-vision deficiency in both light and dark themes.

## Results

- Deployed and running on Render as one Docker container backed by PostgreSQL.
- Shipped features: logging workouts from routines or empty sessions, last session's sets shown alongside the current ones, a rest timer that keeps time with the screen off, correcting saved workouts, and a desktop dashboard. The dashboard covers weekly volume, hard sets per muscle group, a consistency calendar, estimated 1RM over time, personal records and stalled lifts.
- The rule that flags logging mistakes was tuned on a real training history of 2,840 exercise sessions. Comparing each session only with its immediate neighbours flagged 172 of them, mostly a heavy and a light variant of a lift logged under one name. The final rule compares each session with the three before and the three after, and flags 39, including the actual typos.
- TODO: Who uses the live app, and are there any usage numbers (accounts, workouts logged)?

## Links

- Live site: https://reptracker-9fku.onrender.com/
- GitHub repository: https://github.com/xZenshin/RepTracker
