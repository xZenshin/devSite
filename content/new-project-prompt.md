# Prompt: draft a project page from an old project

Paste everything below the line into Claude Code opened in the old project's repository,
or into a chat along with that project's README, code or notes. It drafts the file to save
as `content/projects/<slug>.md` in this site.

---

You are helping me, Alexander, add one of my past projects to my portfolio website. The
site has an AI assistant that answers recruiters' questions using only the text on my
site, and it repeats what's written almost word for word. So everything you write must be
true and backed by evidence: a wrong detail here becomes a wrong answer to a recruiter.

## Step 1: Gather evidence

If you can see a repository, read it before asking me anything:
- the README and any docs
- dependency files (package.json, requirements.txt, pyproject.toml, *.csproj, go.mod and so on), Dockerfiles and CI configs
- deployment config (Vercel, Render, fly.toml, GitHub Actions)
- tests, and the git history: first and last commit dates, number of contributors, my share of the commits

If I've pasted materials instead, use only those. Never invent a detail, a number or a
link. Note where each fact came from.

## Step 2: Ask me what the evidence can't show

Ask me one short, numbered list of questions, only for what you couldn't find. Typically:
1. My role: solo or team? If a team, how big, and what exactly did I own?
2. When I worked on it (year, or year–year).
3. Results: is it shipped or deployed, does anyone use it, and are there any numbers
   (users, speed, accuracy, time saved)?
4. Public links: a live site, a public repository, a write-up. Private repositories don't count.
5. For work done for an employer or client: what may be described publicly? Leave out
   internal system names, data and anything confidential.

Wait for my answers. If I don't know something, it becomes a TODO (see the rules below).

## Step 3: Write the file

Output exactly one Markdown file in this format:

```markdown
---
title: Project Name
summary: One descriptive sentence about what the project is and does.
period: 2026
featured: false
solo: true
order: TODO
images:
  - src: /projects/<slug>/screenshot.png
    alt: TODO: what the screenshot shows
    caption: Optional short caption
---

## Summary

2–4 sentences: what the project is and does, who it's for, and the problem it solves.
Go beyond the one-line `summary` in the frontmatter instead of repeating it.

## Stack

- One bullet per technology, with what it was used for when that's notable

## Key decisions

Solo projects: the main design decisions and why, one bullet each.
Team projects: call this section "My role" instead, and say the team size and exactly
what I owned.

## Results

What shipped, who uses it, and numbers where there's evidence.

## Links

- Live site: https://…
- GitHub repository: https://…
```

Rules:
- Keep these five `##` headings, in this order, with no other headings at that level
  ("Key decisions" becomes "My role" for team projects). Each one becomes a section the
  assistant links to.
- `solo: true` only if I built it alone; it shows "solo project" in the page header and
  tells the assistant. For team or employer projects, leave it out.
- `images` is optional: screenshots or diagrams that I'll save under
  `public/projects/<slug>/`. Each needs `src` and `alt`; `caption` is optional. Leave the
  list out if there are none yet. The assistant never sees images, so don't put facts only
  in a caption.
- Anything unknown is written as `TODO: <the question to answer>`. The site leaves those
  lines out until I fill them in. Never write a plausible guess.
- Don't overclaim. If others contributed, say what was mine. "Contributed to X" is not "built X".
- **summary** describes what the project *is*. Don't phrase it as a question, or as
  questions visitors might ask; the assistant's search treats such text as relevant to
  every question.
- Write plain, specific text without first person: "Built a web app that…", not "I built…".
  No marketing words (cutting-edge, robust, seamless).
- Stack: only technologies the evidence shows were actually used, not ones merely
  installed. Name versions only when they matter.
- Results: quantify only with evidence. If there are no numbers, say what shipped and who used it.
- Keep each section under about 300 words.
- If there's nothing public to link, write "No public links." with a short reason, for
  example "proprietary software owned by the client".
- Leave `featured: false` and `order: TODO` for me to decide.

## Step 4: Extras for the rest of the site

After the file, give me:
1. **A file name**: a short kebab-case slug such as `weather-app.md`. It becomes the page URL.
2. **CV skill lines** for skills this project gives evidence of, in this style, for me to
   merge into `content/cv.md`:
   `- TypeScript: personal project, [Project Name](/projects/<slug>).`
   Link to the project; don't repeat its details.
3. **Two eval cases** for `evals/questions.json`, in this shape:
   ```json
   {
     "id": "<slug>-stack",
     "question": "What tech stack does <Project Name> use?",
     "facts": ["The key facts a correct answer must state"],
     "sources": ["projects/<slug>.md"]
   }
   ```
4. **The open TODOs**: a list of every TODO left in the file, so I can fill them in.
