# Portfolio

A fast static personal portfolio site with Tailwind CSS and data-driven sections.

## Setup

1. Edit `config.json` with your name, title, Medium username, and social links.
2. Add your resume PDF to `public/resume.pdf` (optional).
3. Run the Medium fetch script:

```bash
node scripts/fetch-medium.mjs
```

It will create/update `data/medium.json` with your latest posts.

4. Optionally fetch GitHub projects (from your public repos). Set `social.github` to your profile URL in `config.json`. Then run:

```bash
node scripts/fetch-github.mjs
```

Or run both Medium and GitHub fetches:

```bash
node scripts/fetch-all.mjs
```

To increase GitHub API limits, set `GH_TOKEN` env var when running the script.

## Develop locally

You can use any static server. For convenience:

```bash
npx --yes http-server -c-1 .
```

Then open the printed URL and navigate to `/portfolio`.

## Deploy

This folder is static. You can deploy the `portfolio` directory to any static host (GitHub Pages, Netlify, Vercel static, S3, etc.).