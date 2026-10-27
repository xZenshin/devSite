# Content authoring guide

Everything in this folder is the single source of truth for the site **and** the
"Ask my portfolio" assistant. The site renders these files as pages, and the ingest
script (`scripts/ingest.ts`, Phase 3) chunks and embeds them for retrieval.

This README is not ingested. Only `facts.md`, `cv.md` and `projects/*.md` are.

To add a project, [new-project-prompt.md](new-project-prompt.md) has a prompt that drafts
the page from the old project's repository or notes.

## Rules

1. **Each fact lives in exactly one file.**
   | File               | Owns                                                                     |
   | ------------------ | ------------------------------------------------------------------------ |
   | `facts.md`         | Location, work authorization, availability, preferred roles, contact     |
   | `cv.md`            | Roles and dates, education, skills, spoken languages                     |
   | `projects/<slug>.md` | Everything about one project: problem, stack, role, results, links     |

   `cv.md` *links* to projects (`[Ask my portfolio](/projects/ask-my-portfolio)`) and
   never restates their results. Duplicated facts drift apart, and then the assistant
   contradicts itself.

2. **Headings drive chunking and citation links.**
   - `##` (H2) = a section. Each H2 becomes a citation target, for example
     `/projects/ask-my-portfolio#results`.
   - `###` (H3) = a sub-section (used in `cv.md` for one entry per role).
   - Keep each H2 section to roughly 100–400 words so chunks stay coherent.

3. **Rename headings with care.** A heading's text becomes its URL anchor, so renaming
   it breaks old links and the expected sources in `evals/questions.json`.

4. **Placeholders are `TODO`.** The ingest refuses to run while any remain.
   Writing guidance goes in `<!-- HTML comments -->`. These are stripped before
   rendering and embedding, so you can leave them in.

5. **State evidence explicitly.** The assistant is told never to infer skills or
   experience. "TypeScript" on its own won't let it answer "Has he used TypeScript in
   production?". Write "TypeScript: production, 2 years at Acme (see
   [Project](/projects/x))" instead.

6. **Everything here is public.** It is rendered on the site and quoted by the LLM.
   Leave out salary, home address, references and anything else you wouldn't tell a
   recruiter on a first call. Questions about those are tested as "should decline"
   cases in the evals.

7. **A project's slug is its file name.** `projects/ask-my-portfolio.md` is served at
   `/projects/ask-my-portfolio`. The slug isn't repeated in frontmatter.

## Frontmatter reference

```yaml
# facts.md
title: Quick facts
url: /about
contact:            # the only place contact details live
  email: ...
  linkedin: ...
  github: ...

# cv.md
title: CV
url: /cv

# projects/<slug>.md
title: Human-readable project name
summary: One line, shown on project cards and prepended to every chunk for context
period: 2025–present
featured: true      # shown first, used for "strongest project" questions
order: 1            # sort order on the projects page
```
