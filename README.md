# design-studio

Free, open-source design parts: web UI (React + Tailwind) and motion (Remotion). Copy a part into your project and change it. MIT licence.

## Design rules
Every product redesign follows [`docs/design-rules.md`](docs/design-rules.md). Tokens and full rules are in [`foundations/`](foundations/README.md).

## What is here
| Shelf | Path |
|---|---|
| Web UI parts | `components/<kind>/<name>/` |
| Motion parts | `components/motion/<name>/` |
| Page sections and flows | `patterns/<kind>/<name>/` |
| Tokens (colour, type, spacing, easing) | `foundations/<kind>/` |

Each part has a `README.md` (use when, props, run command, tested versions) and a `poster.png`.

## Use a part
1. Open the part folder. Read its `README.md`.
2. Copy `src/` into your project.
3. Install the versions listed in its `package.json`.

A shadcn registry (`npx shadcn add <url>`) comes later.

## Add a part
Read `AGENTS.md`. Open a pull request. The gate (`.claude/gate.sh`) must pass.

Parts are prototyped in a separate lab and graduate here only when they are reusable.
