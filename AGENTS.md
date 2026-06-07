# AGENTS.md

Agent instructions for `@gleanwork/configure-agents` — the CLI that scaffolds and drift-checks the gleanwork agent baseline (`AGENTS.md`, `CLAUDE.md`, `skills/`) across library and SDK repos.

## Development

- Install: `npm install`
- Build: `npm run build` (compiles `src/` to `build/`, then copies templates)
- Test: `npm test` (vitest)
- Checks: `npm run lint`, `npm run lint:ts`, `npm run format`
- Run locally: `npm run go -- init` / `npm run go -- check`, or `node build/index.js <command>` after a build

This is an ESM project with `module: nodenext`, so relative imports use `.js` extensions even though the files are `.ts`.

The single source of truth for the baseline is `src/baseline/spec.ts`. `init` writes the baseline and `check` enforces it from the same lists — change them together. Scaffold templates live in `src/init/templates/files/` and are copied into `build/` at build time.

## Skills

`skills/configure-agents/SKILL.md` is the authoring rubric — a skill for authoring library skills — distributed via `skills.sh`. It is the rubric, not a library skill, so the drift `check` is intentionally not self-applied to this repo.
