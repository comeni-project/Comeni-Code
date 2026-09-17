# Specs

The design documents. Each one records what was decided, when, by which role, **and what was
rejected and why** — the part that is expensive to reconstruct later. They are this project's
decision records.

| Spec | Status | Settles |
|---|---|---|
| [2026-09-02 — Comeni Code design](2026-09-02-comeni-code-design.md) | design; partly superseded | what Code is, why its predecessors died, the node as typed holes, the review risk, why the game layer is refused |
| [2026-09-16 — weaving, pages and identity](2026-09-16-comeni-code-weaving-and-pages-design.md) | design | woven routes, every page, content blocks and the content API, where the AI runs, the visual identity, order of work |
| [2026-09-17 — architecture and roadmap](2026-09-17-comeni-code-architecture-and-roadmap-design.md) | design | the stack (Django + Ninja, React, Postgres, Redis, LiteLLM, Compose), where content lives, the repository shape, phases M0–M9 and their objectives, and how each is built part by part |
| [2026-09-17 — the tutor on top of what exists](2026-09-17-code-as-tutor-design.md) | **current statement of the product** | Code complements Khan Academy: outside resources and video, skeletons from public outlines, step backs and hints, learner state as evidence, **self-tests from node exam pools** (T7.1), AI block scores (automatic deployment deferred), **five content levels** (First steps → Advanced) and rules for young learners; what is deferred past v1 |
| [2026-09-17 — M0 part 6: identity tokens into Tailwind](2026-09-17-m0-identity-tokens-design.md) | agreed; built | `.design/tokens.json` as the one source for boards and app, a generated and committed `tokens.css` with a drift test, Tailwind 4 with only our colours, CSS-first dark mode following the system, self-hosted Lexend and Geist Mono, the identity specimen at `/` |
| [2026-09-17 — M0 part 5: the web toolchain](2026-09-17-m0-web-toolchain-design.md) | agreed; built | `apps/web` on npm and Node 24, Vite 8, React 19, TypeScript 7 strict, Biome 2.5 (preset recommended, a11y canary), vitest 5 with jsdom 29 (until Fedora ships Node 24.15), a parallel `web` CI job |
| [2026-09-17 — M0 part 4: Celery, beat and Redis](2026-09-17-m0-celery-beat-redis-design.md) | agreed; built | Celery from Django settings with `CELERY_IMPORTS`, Redis 8 in Compose, a 10-second beat heartbeat, `redis` and `worker` health checks, a real-worker test; Celery on Python 3.14 confirmed |
| [2026-09-17 — M0 part 3: the Ninja API and health](2026-09-17-m0-ninja-api-and-health-design.md) | agreed; built | one `NinjaAPI` at `/api/`, `/api/health` (200/503, never 500), docs page from Ninja's bundled files via WhiteNoise, the committed schema kept current by a test |
| [2026-09-17 — M0 part 1: workspace and purity guard](2026-09-17-m0-workspace-and-purity-guard-design.md) | agreed; built | Python 3.14, the uv workspace, pytest, ruff, mypy strict, the static and runtime purity guards, the link check, CI |
| [2026-09-17 — M0 part 2: the Django project boots](2026-09-17-m0-django-project-design.md) | agreed; built | `apps/api` as `code_api`, pydantic-settings with `CODE_*` variables, the custom user model, Postgres 18 in Compose, pytest-django and django-stubs, the OpenAPI constraint on part 3 |

## Rules

- **The newer spec wins where two disagree**, and the older one is edited only to point at the
  newer decision. The reasoning stays where it was made.
- **A spec is not a plan.** Plans — ordered, test-first steps — live in `docs/superpowers/plans/`,
  **one per part, never one per phase or product** (architecture spec R5). A part's spec comes
  first and may be a page.
- **Name the file** `YYYY-MM-DD-<topic>-design.md`, dated the day the design was agreed.
- **Cite research** in the spec's sources, and say which decision it supports.
