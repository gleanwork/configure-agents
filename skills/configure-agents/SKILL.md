---
name: configure-agents
description: Configure the gleanwork agent baseline in a library or SDK repo — scaffold AGENTS.md, a CLAUDE.md pointer, and skills/, author the library's SKILL.md, and verify it in CI. Use when onboarding a gleanwork OSS repo to the agent setup, adding AGENTS.md or a skill to a repo, or writing/updating the SKILL.md that teaches a consuming AI to use the library. Drives the @gleanwork/configure-agents CLI and encodes the one rule: reference the authoritative API surface, never transcribe it.
---

# Configure agent infrastructure for a gleanwork repo

This skill sets up a consistent agent configuration in a gleanwork library or SDK repo: a scaffolded baseline (`AGENTS.md`, a thin `CLAUDE.md` pointer, and a CI drift check) plus a hand-authored `skills/SKILL.md` that teaches a *consuming* AI how to use the library correctly.

It drives the `@gleanwork/configure-agents` CLI for the deterministic parts (scaffold + check) and guides you through the one part that needs judgment: authoring the skill. Nothing here requires cloning the `configure-agents` repo — the CLI runs opaquely via `npx`, and distribution of the finished `skills/SKILL.md` is handled by `skills.sh`.

## Workflow

Run these steps to onboard or update a repo. Each is safe to re-run.

1. **Scaffold the baseline** (idempotent; never overwrites your content):

   ```fish
   npx -y @gleanwork/configure-agents init
   ```

   Creates `AGENTS.md`, a `CLAUDE.md` that points to it, a starter `skills/SKILL.md`, and a CI workflow that runs the drift check. It detects the repo language to fill the "Authoritative API" pointer; override with `--lang <ts|python|go|java>`, set the package name with `--package <name>`, and preview with `--dryRun`.

2. **Author `skills/SKILL.md`** against the rules below. Fill every `TODO`. Read the repo's own types/source first — you are describing *this* library, not a generic one.

3. **Verify structure:**

   ```fish
   npx -y @gleanwork/configure-agents check
   ```

   Structural only — it confirms the required files, frontmatter, and sections exist. It does **not** (and cannot) judge whether the content is correct or current. That is on you and on review.

4. **Open a PR** with the scaffolded files and your authored skill.

## The one rule: reference the API surface, never transcribe it

A skill's value is the *complement* of the API surface. Whatever the language's authoritative, ships-with-the-code definition already expresses — signatures, parameters, enums, return shapes — **point at it; do not copy it**. A copied fact is a second source of truth that rots on the next release while the real one stays correct. A skill that catalogues method signatures is a bug.

Point the consuming AI at the authoritative surface for the repo's language:

| Language | Point at |
|---|---|
| TypeScript / JS | the `.d.ts` referenced by `types`/`exports` in `package.json` (often under `dist/`) |
| Python | inline type hints, `.pyi` stubs, the `py.typed` marker |
| Go | exported identifiers in source / godoc on pkg.go.dev |
| Java | public classes and their Javadoc |

Write down only what is **not** in the types: the *why*, correct sequencing, auth setup, which option to choose, and the mistakes agents make. That content changes slowly and stays fresh on its own; revisit it when public behavior changes.

## Required shape of `skills/SKILL.md`

Frontmatter (both required):

- `name` — short, kebab-case.
- `description` — one line, "what it does + when to use it," so an agent knows when to load the skill. This is the single biggest factor in whether the skill ever fires.

Sections (all required; `check` enforces their presence):

- **When to use** — the tasks and imports that should make a consuming agent load this skill.
- **Install & import** — dependency declaration + the single canonical import / entry point. The one place a small, stable slice of derivable surface is allowed, because it is the entrypoint. Keep it minimal.
- **Authoritative API** — route the AI to the typed surface (per the table above) and tell it to read it, not guess. No signatures here.
- **Usage patterns** — idiomatic sequencing, auth, and pagination for the common tasks. Name methods sparingly and always defer to the types for exact signatures. Never a full catalogue.
- **Common mistakes** — what agents get wrong with this library, and the correct approach.
- **Version notes** — how to check the installed version; breaking-change gotchas. Do not hardcode a version number.

## Common pitfalls

- A vague `description` that never triggers. Lead with the concrete intents and imports.
- Transcribing the API. If you typed a signature, delete it and point at the types.
- No "Common mistakes." This is often the highest-value section — pure judgment an agent can't derive.
- Hardcoded versions. They go stale immediately; tell the reader how to check instead.
- Walls of prose. Prefer short, skimmable guidance and small examples.

## Worked example

See `examples/api-client-typescript.SKILL.md` for a good library skill on a generated SDK: it points at the generated `.d.ts`, then carries only auth, pagination, and gotchas.
