# Git/City

Git/City turns a GitHub account into an explorable 3D skyline. Repository
activity determines building height, stars and contributors illuminate the
facades, and programming languages form distinct city districts.

## What it includes

- a cinematic interactive city built with React Three Fiber
- deterministic repository scoring, normalization, and placement
- public GitHub user and organization lookup
- curated discovery for notable organizations and popular repositories
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

Copy `.env.example` to `.env.local` to configure local credentials. The app
continues to run without Redis, but durable Explore caching is enabled when the
Upstash REST credentials are present.

The ground-up construction animation is enabled by default. To turn it off
without changing code, set `NEXT_PUBLIC_CITY_CONSTRUCTION_ANIMATION=0` and
restart or redeploy the app. Reduced-motion visitors automatically receive the
completed city without the animation.

## Deploy to Vercel

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. Import the repository in Vercel. The project is a standard Next.js app, so
   the framework and build settings are detected automatically.
3. Add an Upstash Redis integration from the Vercel Marketplace and connect it
   to the project. The cache accepts either Upstash's standard
   `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` variables or
   Vercel's prefixed `CACHE_KV_REST_API_URL` and
   `CACHE_KV_REST_API_TOKEN` variables.
4. Add `GITHUB_TOKEN` to Production and Preview for higher GitHub API limits.
5. Deploy. Vercel uses `npm run build` and the Node.js requirement from
   `package.json`.

For a quick animation rollback in Vercel, add
`NEXT_PUBLIC_CITY_CONSTRUCTION_ANIMATION=0` to the affected environments and
redeploy. Remove the variable, or set it to `1`, and redeploy to restore the
animation.

Run the same production checks locally before deploying:

```bash
npm test
```
