# Git/City product context

Preserve the current product while evolving it. In particular, do not regress:

- progressive, paginated GitHub loading;
- durable caching for Explore organizations and repositories;
- the immutable offline demo city;
- dense city-block spacing and deterministic placement;
- instanced large-scale rendering;
- owner avatars, Explore navigation, filters, hover, selection, and details;
- responsive and reduced-motion behavior.

## Original visualization model

Git/City represents one public GitHub user or organization at a time. Each
repository is a building, languages form recognizable neighborhoods, and recent
development activity shapes the skyline.

| Repository signal | City representation |
| --- | --- |
| Recent commits, merged PRs, and closed/opened issues | Building height |
| Stars | Potential window count/density |
| Active contributors | Percentage of windows occupied/lit |
| Very recent activity | Rooftop beacon or pulse |
| Primary language | Building material/accent color |
| Repository size | Building footprint |
| Repository age | Architectural style/weathering |
| Archived repository | Darkened, inactive building |
| Fork | Smaller related building or annex |
| Owner/team | District or city block |

Keep these visual signals separate: popularity controls lighting capacity,
people create occupancy, and activity creates height.

Use the rolling 30-day activity score:

`commits + 3 × merged PRs + 2 × closed issues + opened issues`

Height uses logarithmic scaling normalized against the city’s 95th percentile
so one highly active repository does not flatten the rest of the skyline.

Lighting uses logarithmic/normalized stars for window capacity and contributor
occupancy for the proportion lit. The target brightness blend is approximately
`0.35 × normalized stars + 0.65 × normalized contributors`.

## Color direction

Use recognizable core colors for common languages (for example TypeScript,
JavaScript, Python, Go, Rust, Java, Ruby, Swift, Kotlin, C/C++, C#, PHP, Shell,
HTML, and CSS). Languages outside the curated common palette use a consistent
neutral gray. Archived repositories remain visibly subdued.

## Experience and architecture

Visitors enter or choose a GitHub username/organization, watch the city
assemble, orbit/pan/zoom, hover for core metrics, select for details, and filter
by language/activity/archive/popularity. The legend must explain the metric
mapping.

Maintain the provider-independent flow:

`GitHub APIs → ingestion/cache → normalized repository signals → layout engine → instanced 3D renderer`

Cache aggressively, represent partial/estimated metrics honestly, keep GitHub
credentials server-side, and degrade lighting/geometry gracefully for very
large organizations.
