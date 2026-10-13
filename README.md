# configure-agents

`@gleanwork/configure-agents` gives gleanwork library and SDK repos a consistent, AI-friendly setup and keeps it from drifting. It scaffolds a small baseline into a repo and drift-checks that baseline in CI. It also ships the **authoring rubric** that constrains how the per-repo skills are written.

## Why

1. **Teach consumers' AI to use our libraries.** Each opted-in repo carries a skill under `skills/` (one directory per skill: `skills/<name>/SKILL.md`) that teaches a consuming AI how to use that library correctly, so we stop hand-feeding the same context. Distribution is handled by [`skills.sh`](https://skills.sh) fetching from GitHub — this tool owns none of it.
2. **Consistency across repos.** A uniform structure plus a scaffold to create it and a CI check to sustain it is what makes the setup maintainable across many repos.

## The baseline

Each opted-in repo gets:

- `AGENTS.md` — the repo's real agent instructions.
- `CLAUDE.md` — a thin pointer to `AGENTS.md`.
- `skills/<name>/SKILL.md` — teaches a consuming AI to use the library; distributed via `skills.sh`.
- `.github/workflows/agent-baseline.yml` — CI that runs the drift check on every PR.

<!-- configure-agents:skills start -->

## Agent skills

This repository ships agent skill(s) under `skills/`. Install them into your
AI agent with [`npx skills`](https://github.com/agentskills/agentskills):

```sh
npx skills add -g gleanwork/configure-agents   # global — available in every repo
npx skills add gleanwork/configure-agents      # or scoped to the current repo
```

<!-- configure-agents:skills end -->

Once it's installed, ask your agent to onboard a repo (below) — you won't invoke the CLI by hand.

## Workflow (skill-driven)

The intended path is AI-driven, through the `configure-agents` skill installed above. Ask the AI to onboard a repo; it will:

1. **Scaffold** — `npx -y @gleanwork/configure-agents init`
2. **Author** the skill (`skills/<name>/SKILL.md`) against the rubric (the one rule below)
3. **Verify** — `npx -y @gleanwork/configure-agents check`
4. **Open a PR** with the result

Every step is safe to re-run.

## Commands

### `init`

Scaffolds the baseline into the current repo. Idempotent: it creates missing files and never overwrites your content.

- `--lang <ts|python|go|java>` — override language detection (otherwise detected from the repo's manifest)
- `--package <name>` — package name for the templates (defaults to the detected manifest name)
- `--dryRun` — show what would be created without writing anything
- `--review` — also run `review` (below); `--autonomy <level>` picks its preset

### `review`

Sets what coding agents may do in the repo without asking, and how changes are reviewed. Any repo can use it, including repos without the library baseline. Idempotent. It writes:

- **Permission rules** in `.claude/settings.json`, in Claude Code's permission syntax. No cross-agent standard exists yet, and this is the most widely copied format. Existing rules are kept as they are.
- **`AGENTS.md` sections**, generated from those rules: "Ask first", "Never" and a pointer to `REVIEW.md`. Agents that don't read `.claude/settings.json` see the same rules here. A "Commit and PR guidelines" section is added once for you to fill in.
- **`REVIEW.md`**, a template for the repo's review rules.
- **`.codex/rules/permissions.rules`**, the rules compiled to Codex prefix rules. Codex loads them in trusted projects.

`--autonomy` picks the preset written when the repo has no rules yet:

| Preset               | Agents may                            | Agents ask first for                                                             |
| -------------------- | ------------------------------------- | -------------------------------------------------------------------------------- |
| `local-only`         | work locally                          | any push or PR                                                                   |
| `draft-pr` (default) | push feature branches, open draft PRs | comment, review, merge, release, publish, force push, push to the default branch |
| `self-merge`         | the above, plus merge and mark ready  | comment, review, release, publish, force push, push to the default branch        |

To change the rules, edit `.claude/settings.json` and run `review` again. `check` fails if the `AGENTS.md` sections or the Codex rules no longer match.

### `check`

Verifies the baseline structure and exits non-zero on violations (used by CI).

It checks, **structurally only**, that: the required files exist; at least one `skills/<name>/SKILL.md` exists, each with valid `name`/`description` frontmatter and the required sections; `AGENTS.md` has its required sections; and `CLAUDE.md` imports `AGENTS.md`. It does **not** — and cannot — validate that the skill's content is correct or current. That is the job of the rubric and of review.

In a repo with `REVIEW.md` or the generated review sections, `check` also verifies the review module: valid permission rules, `AGENTS.md` sections and Codex rules that match them, a "Commit and PR guidelines" section, and `REVIEW.md`. `--review-only` checks just the review module, for repos without the library baseline.

### `migrate`

For a repo set up before this baseline (e.g. a `CLAUDE.md` written by `claude /init`, with no `AGENTS.md`), promotes the existing `CLAUDE.md` into `AGENTS.md` and rewrites `CLAUDE.md` as a pointer. Ensures the required `AGENTS.md` sections; refuses if an `AGENTS.md` already exists (reconcile by hand). `--dryRun` previews. Run `init` to scaffold the rest, then refine the promoted `AGENTS.md`. `init` also detects this case and won't drop a competing stub.

## The one rule (the rubric)

A skill's value is the _complement_ of the API surface. Whatever the language's authoritative, ships-with-the-code definition already expresses — signatures, parameters, enums, return shapes — **reference it; never transcribe it**. A copied fact rots on the next release; a pointer to the types never does.

| Language        | Point the skill at                                            |
| --------------- | ------------------------------------------------------------- |
| TypeScript / JS | the `.d.ts` referenced by `types`/`exports` in `package.json` |
| Python          | inline type hints, `.pyi` stubs, the `py.typed` marker        |
| Go              | exported identifiers in source / godoc                        |
| Java            | public classes and their Javadoc                              |

The full rubric — required shape, section-by-section guidance, pitfalls, and a worked example — lives in [`skills/configure-agents/SKILL.md`](skills/configure-agents/SKILL.md).

## Development

See [`AGENTS.md`](AGENTS.md).
