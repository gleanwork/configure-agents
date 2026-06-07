import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createBintastic, type BintasticProject } from 'bintastic';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const { setupProject, teardownProject, runBin } = createBintastic({
  binPath: fileURLToPath(new URL('../build/index.js', import.meta.url)),
});

describe('configure-agents CLI', () => {
  let project: BintasticProject;

  beforeEach(async () => {
    project = await setupProject();
  });

  afterEach(() => {
    teardownProject();
  });

  function read(relativePath: string): string {
    return fs.readFileSync(path.join(project.baseDir, relativePath), 'utf8');
  }

  function exists(relativePath: string): boolean {
    return fs.existsSync(path.join(project.baseDir, relativePath));
  }

  it('prints help', async () => {
    const result = await runBin('--help');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatchInlineSnapshot(`
      "Usage: configure-agents [options] [command]

      Scaffold and drift-check the gleanwork agent baseline (AGENTS.md, CLAUDE.md,
      skills/)

      Options:
        -v, --version    Output the current version
        -h, --help       display help for command

      Commands:
        init [options]   Scaffold the agent baseline into a repository (idempotent)
        check [options]  Verify the agent baseline structure (exit 1 on violations)
        help [command]   display help for command"
    `);
  });

  it('init scaffolds the full baseline', async () => {
    const result = await runBin('init');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatchInlineSnapshot(`
      "Created AGENTS.md
      Created CLAUDE.md
      Created skills/SKILL.md
      Created .github/workflows/agent-baseline.yml

      Initialization complete:
        Created: 4
        Skipped: 0 (already exist)"
    `);

    for (const file of [
      'AGENTS.md',
      'CLAUDE.md',
      'skills/SKILL.md',
      '.github/workflows/agent-baseline.yml',
    ]) {
      expect(exists(file)).toBe(true);
    }
  });

  it('init is idempotent and skips existing files on re-run', async () => {
    await runBin('init');

    const result = await runBin('init');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatchInlineSnapshot(`
      "Skipping AGENTS.md (already exists)
      Skipping CLAUDE.md (already exists)
      Skipping skills/SKILL.md (already exists)
      Skipping .github/workflows/agent-baseline.yml (already exists)

      Initialization complete:
        Created: 0
        Skipped: 4 (already exist)"
    `);
  });

  it('init --dryRun writes nothing', async () => {
    const result = await runBin('init', '--dryRun');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatchInlineSnapshot(`
      "Files that would be created:
        AGENTS.md
        CLAUDE.md
        skills/SKILL.md
        .github/workflows/agent-baseline.yml"
    `);
    expect(exists('AGENTS.md')).toBe(false);
  });

  it('init points the skill at the detected language API surface', async () => {
    await runBin('init');

    expect(read('skills/SKILL.md')).toMatchInlineSnapshot(`
      "---
      name: fake-project
      description: TODO replace with a one-line trigger (what it does plus when to use it) so an agent knows to load this skill when working with fake-project.
      ---

      # fake-project

      > Starter skill scaffolded by @gleanwork/configure-agents. Replace each TODO by authoring against the configure-agents skill. The one rule: reference the authoritative API surface, never transcribe it.

      ## When to use

      TODO the tasks and imports that should make a consuming agent load this skill.

      ## Install & import

      TODO the dependency declaration and the single canonical import / entry point. Keep this minimal.

      ## Authoritative API

      The authoritative API is the published TypeScript types. Read the \`.d.ts\` files referenced by the \`types\`/\`exports\` field in \`package.json\` (commonly under \`dist/\`). Do not guess signatures — read the types.

      ## Usage patterns

      TODO idiomatic sequencing, auth, and pagination for the common tasks. Show patterns and point at the authoritative API for exact signatures. Do not catalogue the API.

      ## Common mistakes

      TODO what agents get wrong with this library, and the correct approach.

      ## Version notes

      TODO how to check the installed version, and any breaking-change gotchas. Do not hardcode a version number.
      "
    `);
  });

  it('init --lang overrides detection', async () => {
    await runBin('init', '--lang', 'go');

    expect(read('skills/SKILL.md')).toContain('godoc');
  });

  it('init falls back to a generic pointer when no manifest is present', async () => {
    fs.rmSync(path.join(project.baseDir, 'package.json'));

    await runBin('init');

    expect(read('skills/SKILL.md')).toContain('public, typed surface');
  });

  it('check passes on a scaffolded repo', async () => {
    await runBin('init');

    const result = await runBin('check');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatchInlineSnapshot(`
      "
      Structural checks only; this does not validate skill correctness or freshness.
      Baseline OK."
    `);
  });

  it('check fails when a required section drifts', async () => {
    await runBin('init');

    const skillPath = path.join(project.baseDir, 'skills/SKILL.md');
    fs.writeFileSync(
      skillPath,
      read('skills/SKILL.md').replace('## Authoritative API', '## Renamed'),
    );

    const result = await runBin('check');

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatchInlineSnapshot(`
      "skills/SKILL.md: missing required section: Authoritative API

      Structural checks only; this does not validate skill correctness or freshness.
      Found 1 baseline violation(s)."
    `);
  });

  it('check fails when the baseline is absent', async () => {
    const result = await runBin('check');

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatchInlineSnapshot(`
      "AGENTS.md: file is missing
      CLAUDE.md: file is missing
      skills/SKILL.md: file is missing
      .github/workflows/agent-baseline.yml: file is missing

      Structural checks only; this does not validate skill correctness or freshness.
      Found 4 baseline violation(s)."
    `);
  });
});
