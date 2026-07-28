# Git/City

Git/City turns a public GitHub user or organization into an interactive 3D
city. Every non-fork repository becomes a building, programming languages form
neighborhoods, and recent development activity shapes the skyline.

The application is designed to work at two very different scales: a small
personal account should remain detailed and readable, while an organization
with thousands of repositories should continue loading progressively and render
as one navigable city.

## What the application does

- Loads public repositories for a GitHub user or organization in pages of 100.
- Builds the city as each page arrives instead of waiting for the entire account.
- Groups repositories into deterministic, interlaced language neighborhoods.
- Animates new buildings from the ground up in city-size-aware waves.
- Supports orbit, pan, zoom, hover, building selection, and repository links.
- Filters the visible city by activity, popularity, archive status, and language.
- Provides curated Explore organizations backed by durable caching when Redis is
  configured.
- Includes an immutable offline demo that does not require GitHub or Redis.
- Honors reduced-motion preferences and removes the construction animation.

## Visualization model

The normalized repository model deliberately keeps its signals separate:

| Repository signal | City representation |
| --- | --- |
| Rolling 30-day activity | Building height and illuminated-window share |
| Stars | Available window-row capacity |
| Contributors | Potential occupied-window share |
| Primary language | Building color and neighborhood |
| Repository size | Building footprint |
| Very recent pushes | Rooftop beacon |
| Archived status | Dark, inactive material |

Activity is scored with:

```text
commits + 3 × merged pull requests + 2 × closed issues + opened issues
```

Scores and building heights use logarithmic scaling against the city's 95th
percentile. This keeps one unusually active repository from flattening the
remainder of the skyline. Building placement is seeded from repository data, so
the same repository set produces the same city and hovering never rearranges
the layout.

Each façade renders three individual panes per row. Inactive panes remain
visible, contributor normalization determines potential occupancy, and activity
determines which occupied panes illuminate and how strongly they glow.

The list endpoint uses repository metadata to estimate recent commits and
contributors without issuing several requests per repository. Estimated values
remain labelled and stable while a city is open. The normalized data model also
supports measured commit, pull-request, and issue counts when they are available.

## Data flow

```text
GitHub REST API
  → /api/github ingestion and validation
  → optional Redis cache
  → normalized RepositorySignal records
  → deterministic city model
  → instanced Three.js renderer
```

### GitHub ingestion

`app/api/github/route.ts` is the server-side GitHub boundary. It:

- validates owner and `owner/repository` inputs;
- distinguishes users from organizations;
- keeps `GITHUB_TOKEN` on the server;
- retries transient failures and times out stalled requests;
- excludes forks unless a fork was explicitly linked;
- returns pagination metadata so the client can stream the remaining pages; and
- provides cache headers independently of the optional Redis cache.

The client commits each successful page to the city immediately. If a later
page fails, already loaded repositories remain available.

### Caching and fallback behavior

The curated Explore list is defined in `lib/discovery.ts`. When Upstash Redis
credentials are available, each Explore page is stored for 24 hours. Redis
errors are intentionally non-fatal: the route falls back to GitHub and standard
HTTP cache headers.

`lib/demo-data.ts` contains a build-time city snapshot. It is always available,
never calls GitHub, and provides a usable visualization when external services
are unavailable.

## Rendering architecture

The 3D scene is implemented in `app/components/CityScene.tsx`.

Buildings, roofs, windows, foundations, and rooftop beacons are grouped into
`InstancedMesh` batches. This keeps draw calls bounded as repository counts
grow. Large window batches stay inside opaque maps so React's development
performance tracer does not recursively clone hundreds of thousands of pane
records.

The construction sequence is a vertex-shader effect. A single time uniform is
updated per frame, while per-instance attributes determine each building's
start time and duration. Neighborhood position supplies the main wave pattern,
repository hashes add restrained variation, and taller buildings take slightly
longer. The stagger window grows logarithmically with city size and is capped so
very large cities do not take indefinitely long to finish.

Other large-city safeguards include:

- deterministic instancing instead of one React component per building;
- progressive page ingestion;
- grouped language and material batches;
- adaptive shadow behavior;
- non-raycast visual meshes paired with one invisible interaction batch; and
- stable window and layout geometry during hover and selection.

## Technologies

| Technology | Role |
| --- | --- |
| Next.js 16 | App Router, server rendering, and the GitHub API route |
| React 19 | Interface state, progressive data flow, and accessible controls |
| TypeScript | Shared repository, city, and renderer contracts |
| Three.js | WebGL geometry, materials, shaders, instancing, lights, and fog |
| React Three Fiber | Declarative Three.js scene and render loop |
| Drei | Camera controls and reusable scene utilities |
| React Three Postprocessing | Bloom and vignette effects |
| Upstash Redis | Optional durable cache for curated Explore cities |
| Lucide React | Interface icons |
| Tailwind/PostCSS | CSS build pipeline; the visual system is custom CSS |
| Vitest and Node test runner | City-model, data, and rendered-shell tests |
| ESLint | Static analysis for React and TypeScript |

## Project structure

```text
app/
  api/github/route.ts              GitHub ingestion, pagination, and cache policy
  components/CityScene.tsx         Instanced 3D renderer and construction shader
  components/GitCityExperience.tsx Search, Explore, filters, panels, and loading
  globals.css                      Responsive interface and visual system
lib/
  city-model.ts                    Scoring, normalization, color, and layout
  demo-data.ts                     Immutable offline city
  discovery.ts                     Curated Explore organizations
  github-cache.ts                  Optional Redis adapter
tests/
  rendered-html.test.mjs           Production-render smoke test
```

## Local setup

### Requirements

- Node.js 22.13 or newer
- npm

### 1. Install the project

```bash
git clone https://github.com/jas9n/gitcity.git
cd gitcity
npm install
```

### 2. Create the local environment file

```bash
cp .env.example .env.local
```

All variables are optional:

| Variable | Purpose |
| --- | --- |
| `GITHUB_TOKEN` | Raises GitHub API limits; it is read only by the server route |
| `UPSTASH_REDIS_REST_URL` | Enables durable Explore caching |
| `UPSTASH_REDIS_REST_TOKEN` | Authenticates the Redis REST client |
| `NEXT_PUBLIC_CITY_CONSTRUCTION_ANIMATION` | Set to `0` to disable construction animation |

Without a GitHub token, public searches still work within GitHub's anonymous
rate limit. Without Redis, searches and the demo still work, but Explore data is
not persisted across server instances.

### 3. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Validate a change

```bash
npm run lint
npm test
```

`npm test` runs the model tests, creates a production build, and verifies that
the production server renders the Git/City shell.
