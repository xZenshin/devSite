---
title: Applicator
summary: A Windows desktop app that uses the Claude Code CLI to turn a job posting into a tailored CV and application letter, exported as PDFs.
period: 2026
featured: false
solo: true
order: 4
images:
  - src: /projects/applicator/review.png
    alt: "Reviewing a generated application letter: an editable text form on the left and a live preview of the letter on the right"
    caption: "Reviewing a generated letter, with revisions by instruction"
  - src: /projects/applicator/new-application.png
    alt: "The New application page with fields for the job posting, the applicant's own text and extra instructions"
    caption: "Starting an application from a pasted job posting"
  - src: /projects/applicator/my-cv.png
    alt: "The master CV editor with personal details and technical skills next to a preview of the rendered CV"
    caption: "The master CV editor and preview"
---

## Summary

Applicator is a Windows desktop app for writing job applications. It keeps all CV data in one place and, from a pasted job posting, drafts a CV and application letter tailored to that posting, in the posting's language (for example Danish or English). The draft is reviewed and edited in the app, then exported as PDFs. It continues the [CV Builder](/projects/cv-builder) project and adds the application letter.

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

## Key decisions

- Stack: Electron, React and TypeScript, with all model calls going through the Claude Code CLI.
- Tailoring: the model selects CV items by ID and may lightly reword them, but never adds facts.
- Language: output follows the language of the posting.
- Review: an editable review step with instruction-based revisions comes before PDF export.
- Scope: the first version left out CV import, status tracking, multiple templates and DOCX export.

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


## Links

- GitHub repository: https://github.com/xZenshin/Applicator
