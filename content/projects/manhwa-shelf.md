---
title: Manhwa Shelf
summary: A personal web app for tracking manhwa reading progress, with ratings, chapter counts and notes, deployed as a static React site on Cloudflare.
period: 2026
featured: false
solo: true
order: 6
images:
  - src: /projects/manhwa-shelf/shelf.png
    alt: "The shelf showing the Caught Up tab: series cards with cover art, chapter progress bars, ratings out of 10 and reading notes"
    caption: "The shelf, filtered to series that are caught up"
---

## Summary

Manhwa Shelf is a personal web app for keeping track of manhwa reading. It lists every series with its status, a rating, chapters read and a short note on where the story stands, with tabs, search and sorting. Reading sites often go down or disappear, taking bookmarks and reading history with them, so the list lives on its own site that doesn't depend on any of them.

## Stack

- React 19: the interface, with status tabs (Reading, Caught Up, Completed, Plan to Read, Dropped), title search, four sort orders and edit forms
- TypeScript: the whole codebase, including one set of data validation used by the interface, the dev server and the command-line script
- Vite: build tool and dev server, with a custom dev-only plugin that saves edits made in the browser to the JSON data file
- Vitest: unit tests for filtering, search, sorting and validation
- Cloudflare Workers static assets, configured with Wrangler: hosting, with a new deploy on every push to the main branch
- PowerShell and Node.js: a script that adds an entry to the data file, commits it and pushes it, which publishes the change without starting the dev server

## Key decisions

- Static site with no backend: the list lives in a JSON file in the repository and is built into the site, so the deployed site is read-only and the data is kept in version control.
- Editing happens locally: a dev-only Vite plugin writes edits back to the data file, and a PowerShell script commits and publishes them.

## Results

Live on Cloudflare and used to track personal reading. The public site is read-only. Editing works on the local dev server or through the PowerShell script, and pushing a change to GitHub redeploys the site automatically.

## Links

- Live site: https://manwhasite.askoularsen.workers.dev/
- GitHub repository: https://github.com/xZenshin/ManwhaSite
