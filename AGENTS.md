# Git/City product context

Preserve the current product while evolving it. In particular, do not regress:

- progressive, paginated GitHub loading;
- durable caching for Explore organizations;
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
| Recent commits, merged PRs, and closed/opened issues | Building height and window illumination |
| Stars | Number of three-pane window rows |
| Active contributors | Potential window occupancy |
| Very recent activity | Rooftop beacon or pulse |
| Primary language | Building material/accent color |
| Repository size | Building footprint |
| Archived repository | Darkened, inactive building |

Keep these visual signals separate: stars control window capacity, contributors
control potential occupancy, and activity controls both height and the strength
and realized share of illuminated panes.

Do not add separate repository-age, fork, or owner/team geometry. The selected
owner already represents the entire city.

Use the rolling 30-day activity score:

`commits + 3 × merged PRs + 2 × closed issues + opened issues`

Height and visible floor rows use logarithmic activity scaling normalized
against the city’s 95th percentile so one highly active repository does not
flatten the rest of the skyline. Use a dense 4–24-row scale in normal cities;
large-city modes may cap rows for performance but should remain visibly dense.

Render exactly three individual panes per row on every façade. Activity floors
provide the baseline row count and stars can increase that capacity, with a
minimum of three so inactive buildings still have visible windows. The vertical
gap between rows must equal the pane height.
Contributor normalization sets the maximum occupied share, while rolling 30-day
activity controls how many of those panes illuminate and whether they use low,
medium, or high intensity. Keep inactive panes visible. Use muted amber/yellow
shades with restrained opacity and emissive intensity; do not use flat bright
yellow. The layout must remain deterministic and unchanged during hover.

## Color direction

Use recognizable core colors for common languages (for example TypeScript,
JavaScript, Python, Go, Rust, Java, Ruby, Swift, Kotlin, C/C++, C#, PHP, Shell,
HTML, and CSS). Languages outside the curated common palette use a consistent
neutral gray. Roofs share their building color, hover uses a darker version of
that same color without changing building geometry or covering windows, and
archived repositories remain visibly subdued.

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
