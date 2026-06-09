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
        -v, --version      Output the current version
        -h, --help         display help for command

      Commands:
        init [options]     Scaffold the agent baseline into a repository (idempotent)
        migrate [options]  Promote an existing CLAUDE.md to AGENTS.md and leave a
                           pointer (for repos set up before this baseline)
        check [options]    Verify the agent baseline structure (exit 1 on violations)
        help [command]     display help for command"
    `);
  });

  it('init scaffolds the full baseline', async () => {
    const result = await runBin('init', '--repo', 'gleanwork/demo');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatchInlineSnapshot(`
      "Created AGENTS.md
      Created CLAUDE.md
      Created skills/SKILL.md
      Created .github/workflows/agent-baseline.yml
      Created README.md (skills block)"
    `);

    for (const file of [
      'AGENTS.md',
      'CLAUDE.md',
      'skills/SKILL.md',
      'README.md',
      '.github/workflows/agent-baseline.yml',
    ]) {
      expect(exists(file)).toBe(true);
    }
  });

  it('init is idempotent and skips existing files on re-run', async () => {
    await runBin('init', '--repo', 'gleanwork/demo');

    const result = await runBin('init', '--repo', 'gleanwork/demo');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatchInlineSnapshot(`
      "Skipping AGENTS.md (already exists)
      Skipping CLAUDE.md (already exists)
      Skipping skills/SKILL.md (already exists)
      Skipping .github/workflows/agent-baseline.yml (already exists)
      Skipping README.md (skills block up to date)"
    `);
  });

  it('init --dryRun writes nothing', async () => {
    const result = await runBin('init', '--dryRun', '--repo', 'gleanwork/demo');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatchInlineSnapshot(`
      "Planned changes:
        AGENTS.md (create)
        CLAUDE.md (create)
        skills/SKILL.md (create)
        .github/workflows/agent-baseline.yml (create)
        README.md (skills block: created)"
    `);
    expect(exists('AGENTS.md')).toBe(false);
  });

  it('init points the skill at the detected language API surface', async () => {
    await runBin('init', '--repo', 'gleanwork/demo');

    expect(read('skills/SKILL.md')).toMatchInlineSnapshot(`
      "---
      name: "fake-project"
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
    await runBin('init', '--lang', 'go', '--repo', 'gleanwork/demo');

    expect(read('skills/SKILL.md')).toContain('godoc');
  });

  it('init falls back to a generic pointer when no manifest is present', async () => {
    fs.rmSync(path.join(project.baseDir, 'package.json'));

    await runBin('init', '--repo', 'gleanwork/demo');

    expect(read('skills/SKILL.md')).toContain('public, typed surface');
  });

  it('init writes the skills-install block to the README', async () => {
    await runBin('init', '--repo', 'gleanwork/demo');

    const readme = read('README.md');
    expect(readme).toContain('<!-- configure-agents:skills start -->');
    expect(readme).toContain('npx skills add -g gleanwork/demo');
    expect(readme).toContain('<!-- configure-agents:skills end -->');
  });

  it('init appends the block to an existing README without clobbering it', async () => {
    fs.writeFileSync(
      path.join(project.baseDir, 'README.md'),
      '# my lib\n\nHand-written intro.\n',
      'utf8',
    );

    await runBin('init', '--repo', 'gleanwork/demo');

    const readme = read('README.md');
    expect(readme).toContain('Hand-written intro.');
    expect(readme).toContain('<!-- configure-agents:skills start -->');
  });

  it('refreshing the README block is idempotent', async () => {
    await runBin('init', '--repo', 'gleanwork/demo');
    const first = read('README.md');

    const result = await runBin('init', '--repo', 'gleanwork/demo');

    expect(read('README.md')).toEqual(first);
    expect(result.stdout).toContain('skills block up to date');
  });

  it('check passes on a scaffolded repo', async () => {
    await runBin('init', '--repo', 'gleanwork/demo');

    const result = await runBin('check');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatchInlineSnapshot(`
      "
      Structural checks only; this does not validate skill correctness or freshness.
      Baseline OK."
    `);
  });

  it('check fails when a required section drifts', async () => {
    await runBin('init', '--repo', 'gleanwork/demo');

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

  it('check fails when the README is missing the skills block', async () => {
    await runBin('init', '--repo', 'gleanwork/demo');
    fs.writeFileSync(
      path.join(project.baseDir, 'README.md'),
      '# my lib\n\nno block here\n',
      'utf8',
    );

    const result = await runBin('check');

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('skills-install block');
  });

  it('check fails when the baseline is absent', async () => {
    const result = await runBin('check');

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatchInlineSnapshot(`
      "AGENTS.md: file is missing
      CLAUDE.md: file is missing
      skills/SKILL.md: file is missing
      README.md: file is missing
      .github/workflows/agent-baseline.yml: file is missing

      Structural checks only; this does not validate skill correctness or freshness.
      Found 5 baseline violation(s)."
    `);
  });

  it('migrate promotes an existing CLAUDE.md to AGENTS.md and leaves a pointer', async () => {
    fs.writeFileSync(
      path.join(project.baseDir, 'CLAUDE.md'),
      '# CLAUDE.md\n\nRun `npm test` to test this project.\n',
      'utf8',
    );

    const result = await runBin('migrate');

    expect(result.exitCode).toBe(0);
    expect(read('AGENTS.md')).toContain('Run `npm test` to test this project.');
    expect(read('AGENTS.md')).toContain('## Skills');
    expect(read('CLAUDE.md')).toContain('AGENTS.md');
  });

  it('migrate refuses when AGENTS.md already exists', async () => {
    fs.writeFileSync(
      path.join(project.baseDir, 'CLAUDE.md'),
      '# old\n\nlegacy\n',
      'utf8',
    );
    fs.writeFileSync(
      path.join(project.baseDir, 'AGENTS.md'),
      '# AGENTS.md\n',
      'utf8',
    );

    const result = await runBin('migrate');

    expect(result.stderr).toContain('already exists');
    expect(read('CLAUDE.md')).toBe('# old\n\nlegacy\n');
  });

  it('migrate is a no-op when CLAUDE.md already points to AGENTS.md', async () => {
    fs.writeFileSync(
      path.join(project.baseDir, 'CLAUDE.md'),
      '# CLAUDE.md\n\n@AGENTS.md\n',
      'utf8',
    );

    const result = await runBin('migrate');

    expect(result.stdout).toContain('already points to AGENTS.md');
    expect(exists('AGENTS.md')).toBe(false);
  });

  it('migrate --dryRun writes nothing', async () => {
    fs.writeFileSync(
      path.join(project.baseDir, 'CLAUDE.md'),
      '# old\n\nlegacy\n',
      'utf8',
    );

    const result = await runBin('migrate', '--dryRun');

    expect(result.stdout).toContain('Planned migration');
    expect(exists('AGENTS.md')).toBe(false);
    expect(read('CLAUDE.md')).toBe('# old\n\nlegacy\n');
  });

  it('init refuses to create AGENTS.md when an un-migrated CLAUDE.md exists', async () => {
    fs.writeFileSync(
      path.join(project.baseDir, 'CLAUDE.md'),
      '# CLAUDE.md\n\nLegacy instructions.\n',
      'utf8',
    );

    const result = await runBin('init', '--repo', 'gleanwork/demo');

    expect(result.stdout).toContain('needs migration');
    expect(exists('AGENTS.md')).toBe(false);
    expect(exists('skills/SKILL.md')).toBe(true);
  });
});
