---
title: Manhwa Shelf
summary: A personal web app for tracking manhwa reading progress, with ratings, chapter counts and notes, deployed as a static React site on Cloudflare.
period: 2026
featured: false
order: 6
---

## Problem

Manhwa reading sites often go down or disappear, and any bookmarks or reading history on them go too. Keeping track of where each series was left off needed a record that doesn't depend on any of those sites. Manhwa Shelf holds that record: a list of every series with its status, a rating, chapters read and a short note on where the story stands.

## Stack

- React 19: the interface, with status tabs (Reading, Caught Up, Completed, Plan to Read, Dropped), title search, four sort orders and edit forms
- TypeScript: the whole codebase, including one set of data validation used by the interface, the dev server and the command-line script
- Vite: build tool and dev server, with a custom dev-only plugin that saves edits made in the browser to the JSON data file
- Vitest: unit tests for filtering, search, sorting and validation
- Cloudflare Workers static assets, configured with Wrangler: hosting, with a new deploy on every push to the main branch
- PowerShell and Node.js: a script that adds an entry to the data file, commits it and pushes it, which publishes the change without starting the dev server

## My role

Solo project. Designed and built the whole app: the data model and validation rules, the React interface, the dev-only Vite plugin that writes edits back to the data file, the PowerShell publishing script and the Cloudflare deployment. Chose a static site with no backend: the list lives in a JSON file in the repository and is built into the site, so the deployed site is read-only and the data is kept in version control.

## Results

Live on Cloudflare and used to track personal reading. The public site is read-only. Editing works on the local dev server or through the PowerShell script, and pushing a change to GitHub redeploys the site automatically.

## Links

- Live site: https://manwhasite.askoularsen.workers.dev/
- GitHub repository: https://github.com/xZenshin/ManwhaSite
