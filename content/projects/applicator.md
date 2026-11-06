---
title: Applicator
summary: A Windows desktop app that uses the Claude Code CLI to turn a job posting into a tailored CV and application letter, exported as PDFs.
period: 2026
featured: false
order: 4
---

## Problem

Job hunting means rewriting the same CV and application letter for every posting. Each version has to match the posting and stay true to the applicant's real background, and postings may be in different languages, such as Danish or English. Applicator keeps all CV data in one place and produces a tailored draft that the applicant reviews before sending.

(Essentially a continuation of the CV-Builder project that also includes the application portion)

## Stack

- TypeScript: main, preload and renderer processes
- Electron: Windows desktop app and PDF export through `printToPDF`
- React and React Router: application pages
- Mantine: forms and interface components
- Zod: shared data types, validation of model output, and the JSON Schema passed to the CLI
- Claude Code CLI: all model calls, run in print mode (`claude -p`) with structured JSON output; the app does not call the Anthropic API directly or use an API key
- JSON files on disk: local storage of CV data, writing samples and saved applications
- electron-vite: development and build tooling
- electron-builder: Windows installer (NSIS)
- Vitest: unit tests, including tests of the CLI runner against a fake CLI
- GitHub Actions: typecheck and tests on Windows for pull requests into `main` and for published releases
- Python with fontTools: script that generates the small-caps font used in CV headings

## My role

Solo personal project, built with Claude. Alexander was the only person working on it. He decided the stack (Electron, React and TypeScript), the tailoring approach (the model selects CV items by ID and may lightly reword them, but never adds facts), that output follows the language of the posting, that the workflow includes an editable review step with instruction-based revisions before PDF export, and that the first version would leave out CV import, status tracking, multiple templates and DOCX export.

## Results

Version 1.0.0 is a working Windows app. Alexander uses it to draft job applications, to refine text he has already written, and to update his CV with relevant information based on the job listing.

Shipped features:

- A master CV editor where each item has a permanent ID
- Generation of a tailored CV and application letter from a pasted job posting, with the letter based on the user's own earlier applications
- A CV-only mode for jobs that do not ask for a letter
- A one-page check that measures the rendered CV and asks Claude to shorten it, at most twice
- Review with a live preview, manual editing, and revisions of the whole document or a highlighted passage
- PDF export and a searchable history of earlier applications, stored as local files

Model output is checked against the CV data: item IDs that are not in the matching section are dropped with a warning.

TODO: How many applications has Applicator been used for, and with what outcome?

## Links

- GitHub repository: https://github.com/xZenshin/Applicator
