# design-studio: rules for every agent

The open-source library of reusable design parts. Repo: `DNP42/design-studio` (public, MIT).
`~/art-lab` is the lab: prototype there. A part comes here only when it is reusable.
The task list lives in `~/art-lab/art-queue.md`.

## Git
- Every change: branch, commit, PR. Never push to `main`. Never force-push.
- Claude merges a PR when the gate passes and no owner question is open.
- Public repo: no secrets, no `.env`, no client data, no brand assets of clients.

## Gate
```bash
.claude/gate.sh
```

## Admission rule
A part goes here only when all are true:
1. It can go into a second project. No fixed brand: text, colours and logo are props.
2. It has `poster.png`. A motion part also has `contact.png`.
3. Its `README.md` fits one screen: use when, props, run command, tested tool + version, source path in art-lab.

## Where
| Part | Path |
|---|---|
| Web UI part (React + Tailwind) | `components/<kind>/<name>/` (buttons, cards, inputs, menus, modals) |
| Motion part (Remotion) | `components/motion/<name>/` |
| Page section or flow | `patterns/<kind>/<name>/` |
| Tokens (colour, type, spacing, easing) | `foundations/<kind>/` |

## Rules
- Store `src/` and a `package.json` with exact versions. No `npm install` here, no `node_modules`, no mp4. Test in a scratch directory.
- Keep the prototype and its notes in art-lab. This repo holds the clean copy.
- Files under 5 MB. Posters as PNG stills.
- Later, when a site must install parts from here, add a shadcn `registry.json`. Not now.
- Language: English, Simplified Technical English (short sentences, active imperative).
