# Git/City

Git/City turns a GitHub account into an explorable 3D skyline. Repository
activity determines building height, stars and contributors illuminate the
facades, and programming languages form distinct city districts.

## What it includes

- a cinematic interactive city built with React Three Fiber
- deterministic repository scoring, normalization, and placement
- public GitHub user and organization lookup
- activity, popularity, archive, and language filters
- repository inspection with a documented visual model
- responsive controls and reduced-motion support

## Local development

Requires Node.js 22.13 or later.

```bash
npm install
npm run dev
```

Run the full logic and production-render checks with:

```bash
npm test
```

An optional `GITHUB_TOKEN` environment variable increases GitHub API capacity
without ever exposing the token to the browser.
