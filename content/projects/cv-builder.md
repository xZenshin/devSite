---
title: CV Builder
summary: A web app for keeping one master CV and exporting PDF versions tailored to each job application, with AI suggestions from a pasted job listing.
period: 2026
featured: false
solo: true
order: 7
---

## Summary

CV Builder is a web app for tailoring a CV to each job application. It keeps one master CV with every entry, and each tailored version is made by switching sections, entries and bullet points on or off instead of keeping separate copies. The result is exported as an A4 PDF, and the app can suggest which entries to include based on a pasted job listing.

## Stack

- React 19, TypeScript and Vite: the editor and a live preview that matches the PDF's layout and type sizes
- C# with ASP.NET Core minimal APIs on .NET 10: a stateless backend
- QuestPDF: renders the CV to an A4 PDF on the server
- DeepSeek chat API: suggests which entries to include for a pasted job listing
- Docker: the backend packaged as a single container
- Azure Container Apps: hosted the backend container, scaled to zero when idle
- Cloudflare Workers: served the frontend and forwarded API requests to the backend

## Key decisions

- Started with a Postgres database, then removed it so the server stores nothing. The browser keeps the CV and sends the whole document with each request. Work is saved as a versioned `.cvjson` file, with an automatic draft in the browser's local storage. This brought hosting down to one stateless container with no data to back up.
- Built in/out switches for sections, entries and individual bullet points, so excluding an entry hides it from the PDF without deleting it.
- Added two visual styles that change typography only, so both produce the same document. The browser preview is a scale model of the PDF and uses the same point sizes.
- Gave every line of the CV a permanent identifier so the language model can point at a single bullet point. The model replies with lists of entries to include and exclude. The app shows the proposed changes as text and applies them only after the user confirms.
- Protected the public deployment: a passphrase on the two AI routes that cost money, rate limiting, limits on how many sections, entries and bullet points a save file may contain, and security headers on the frontend. The backend refuses to start in production if an AI key is set without a passphrase. Azure pulls the container image using its own managed identity, so no registry password is stored.

## Results

Deployed with the frontend on Cloudflare Workers and the backend as a Docker container on Azure Container Apps. The deployment is no longer running.

## Links

- GitHub repository: https://github.com/xZenshin/PDF_Generator
