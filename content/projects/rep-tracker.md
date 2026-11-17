---
title: RepTracker
summary: Built a web-based workout tracker for logging sets, exercises and reps combined with statistics.
period: 2026
featured: false
solo: true
order: 5
images:
  - src: /projects/rep-tracker/stats.png
    alt: "The stats dashboard for one exercise: best estimated 1RM, heaviest set, best session, trend, and a chart of estimated 1RM over six months"
    caption: "Estimated 1RM over time on the desktop dashboard"
  - src: /projects/rep-tracker/routines.png
    alt: "The phone home screen listing workout routines with their exercises and a start button for each"
    caption: "Picking a routine on a phone"
  - src: /projects/rep-tracker/logging.png
    alt: "Logging a set on a phone: reps and weight controls, the sets done so far and a rest timer"
    caption: "Logging a set, with the rest timer running"
---


## Summary

RepTracker is a web-based workout tracker in two parts: a phone-first logger for recording sets, weights and reps at the gym, and a desktop dashboard for statistics afterwards. The logger keeps working on weak gym signal, so a tap never waits on the network. The dashboard shows whether training is progressing: weekly volume, sets per muscle group, strength over time and lifts that have stalled.

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

## Key decisions

- **Passwordless accounts.** Sign-up generates a 20-digit login code (19 random digits plus a Luhn check digit). The code is stored as an HMAC-SHA256 hash keyed with a secret that's kept outside the database. Sessions are opaque tokens in an HttpOnly cookie, stored hashed so they can be revoked.
- **Offline-tolerant logging.** A workout in progress lives in the browser's local storage, so a tap never waits on the network. Finishing sends the whole workout in one request. The id is generated on the phone, so retrying a save is safe.
- **Training statistics.** Estimated 1RM uses the Epley formula and ignores sets above 12 reps. Personal records are recomputed by replaying history, so editing a set corrects them. The app also detects stalled lifts and flags likely logging mistakes.

## Results

- Deployed and running on Render as one Docker container backed by PostgreSQL.
- Shipped features: logging workouts from routines or empty sessions, last session's sets shown alongside the current ones, a rest timer that keeps time with the screen off, correcting saved workouts, and a desktop dashboard. The dashboard covers weekly volume, hard sets per muscle group, a consistency calendar, estimated 1RM over time, personal records and stalled lifts.


## Links

- Live site: https://reptracker-9fku.onrender.com/ (might be down if I forget to update DB, since render has a 1 month DB period limit for free tier :skull:)
- GitHub repository: https://github.com/xZenshin/RepTracker
