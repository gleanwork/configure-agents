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

  function skill(name = 'fake-project'): string {
    return `skills/${name}/SKILL.md`;
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
      Created skills/fake-project/SKILL.md
      Created .github/workflows/agent-baseline.yml
      Created README.md (skills block)"
    `);

    for (const file of [
      'AGENTS.md',
      'CLAUDE.md',
      skill(),
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
      Skipping skills/fake-project/SKILL.md (repo already ships a skill)
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
        skills/fake-project/SKILL.md (create)
        .github/workflows/agent-baseline.yml (create)
        README.md (skills block: created)"
    `);
    expect(exists('AGENTS.md')).toBe(false);
  });

  it('init points the skill at the detected language API surface', async () => {
    await runBin('init', '--repo', 'gleanwork/demo');

    expect(read(skill())).toMatchInlineSnapshot(`
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
    await runBin('init', '--lang', 'go', '--repo', 'gleanwork/demo');

    expect(read(skill())).toContain('godoc');
  });

  it('init falls back to a generic pointer when no manifest is present', async () => {
    fs.rmSync(path.join(project.baseDir, 'package.json'));

    await runBin('init', '--package', 'demo-lib', '--repo', 'gleanwork/demo');

    expect(read(skill('demo-lib'))).toContain('public, typed surface');
  });

  it('init sanitizes the package name into a valid skill directory', async () => {
    await runBin(
      'init',
      '--package',
      '@acme/My_Cool.Lib',
      '--repo',
      'gleanwork/demo',
    );

    expect(exists(skill('my-cool-lib'))).toBe(true);
    expect(read(skill('my-cool-lib'))).toContain('name: my-cool-lib');
  });

  // fixturify-project always materializes a package.json from its internal pkg,
  // and the resolver consults package.json first, so these fallback-manifest
  // tests add the manifest via project.write and then drop the package.json.
  it('init resolves the package name from pyproject [project].name (over poetry)', async () => {
    await project.write({
      'pyproject.toml':
        '[project]\nname = "glean-api-client"\n\n[tool.poetry]\nname = "wrong-poetry-name"\n',
    });
    fs.rmSync(path.join(project.baseDir, 'package.json'));

    await runBin('init', '--repo', 'gleanwork/demo');

    const content = read(skill('glean-api-client'));
    expect(content).toContain('name: glean-api-client');
    expect(content).toContain('# glean-api-client');
    expect(content).not.toContain('wrong-poetry-name');
  });

  it('init resolves the package name from the go.mod module path', async () => {
    await project.write({
      'go.mod': 'module github.com/gleanwork/api-client-go\n\ngo 1.22\n',
    });
    fs.rmSync(path.join(project.baseDir, 'package.json'));

    await runBin('init', '--repo', 'gleanwork/demo');

    expect(read(skill('api-client-go'))).toContain('name: api-client-go');
  });

  it('init resolves the package name from gradle rootProject.name', async () => {
    await project.write({
      'settings.gradle': "rootProject.name = 'glean-api-client'\n",
    });
    fs.rmSync(path.join(project.baseDir, 'package.json'));

    await runBin('init', '--repo', 'gleanwork/demo');

    expect(read(skill('glean-api-client'))).toContain('name: glean-api-client');
  });

  it('init does not scaffold a skill when the repo already ships one', async () => {
    await project.write({
      skills: {
        'existing-skill': {
          'SKILL.md':
            '---\nname: existing-skill\ndescription: x\n---\n# existing\n',
        },
      },
    });

    const result = await runBin('init', '--repo', 'gleanwork/demo');

    expect(result.stdout).toContain('repo already ships a skill');
    expect(exists(skill())).toBe(false);
    expect(exists('skills/existing-skill/SKILL.md')).toBe(true);
  });

  it('init writes the skills-install block to the README', async () => {
    await runBin('init', '--repo', 'gleanwork/demo');

    const readme = read('README.md');
    expect(readme).toContain('<!-- configure-agents:skills start -->');
    expect(readme).toContain('npx skills add -g gleanwork/demo');
    expect(readme).toContain('<!-- configure-agents:skills end -->');
  });

  it('init appends the block to an existing README without clobbering it', async () => {
    await project.write({ 'README.md': '# my lib\n\nHand-written intro.\n' });

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

    await project.write({
      skills: {
        'fake-project': {
          'SKILL.md': read(skill()).replace(
            '## Authoritative API',
            '## Renamed',
          ),
        },
      },
    });

    const result = await runBin('check');

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatchInlineSnapshot(`
      "skills/fake-project/SKILL.md: missing required section: Authoritative API

      Structural checks only; this does not validate skill correctness or freshness.
      Found 1 baseline violation(s)."
    `);
  });

  it('check flags a flat skills/SKILL.md as the wrong layout', async () => {
    await runBin('init', '--repo', 'gleanwork/demo');
    await project.write({ skills: { 'SKILL.md': 'stray flat skill\n' } });

    const result = await runBin('check');

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('must live in a named directory');
  });

  it('check flags an invalid skill name', async () => {
    await runBin('init', '--repo', 'gleanwork/demo');
    await project.write({
      skills: {
        'fake-project': {
          'SKILL.md': read(skill()).replace(
            'name: fake-project',
            'name: Bad_Name',
          ),
        },
      },
    });

    const result = await runBin('check');

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('invalid skill name');
  });

  it('check flags a skill whose name does not match its directory', async () => {
    await runBin('init', '--repo', 'gleanwork/demo');
    await project.write({
      skills: {
        'fake-project': {
          'SKILL.md': read(skill()).replace(
            'name: fake-project',
            'name: other-name',
          ),
        },
      },
    });

    const result = await runBin('check');

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('must match its directory');
  });

  it('check fails when the README is missing the skills block', async () => {
    await runBin('init', '--repo', 'gleanwork/demo');
    await project.write({ 'README.md': '# my lib\n\nno block here\n' });

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
      README.md: file is missing
      .github/workflows/agent-baseline.yml: file is missing
      skills/: no skill found (expected skills/<name>/SKILL.md)

      Structural checks only; this does not validate skill correctness or freshness.
      Found 5 baseline violation(s)."
    `);
  });

  it('migrate promotes an existing CLAUDE.md to AGENTS.md and leaves a pointer', async () => {
    await project.write({
      'CLAUDE.md': '# CLAUDE.md\n\nRun `npm test` to test this project.\n',
    });

    const result = await runBin('migrate');

    expect(result.exitCode).toBe(0);
    expect(read('AGENTS.md')).toContain('Run `npm test` to test this project.');
    expect(read('AGENTS.md')).toContain('## Skills');
    expect(read('AGENTS.md')).toContain('# AGENTS.md');
    expect(read('AGENTS.md')).not.toContain('# CLAUDE.md');
    expect(read('CLAUDE.md')).toContain('AGENTS.md');
  });

  it('migrate keeps a meaningful CLAUDE.md title intact', async () => {
    await project.write({
      'CLAUDE.md': '# Glean CLI — Development Rules\n\nLegacy instructions.\n',
    });

    await runBin('migrate');

    expect(read('AGENTS.md')).toContain('# Glean CLI — Development Rules');
  });

  it('migrate promotes when CLAUDE.md only mentions AGENTS.md in prose (not a pointer)', async () => {
    await project.write({
      'CLAUDE.md':
        '# CLAUDE.md\n\nRun the tool to create an AGENTS.md file for your project.\n',
    });

    const result = await runBin('migrate');

    expect(result.exitCode).toBe(0);
    expect(read('AGENTS.md')).toContain(
      'create an AGENTS.md file for your project',
    );
    expect(read('CLAUDE.md')).toContain('@AGENTS.md');
  });

  it('init treats a prose mention of AGENTS.md as un-migrated (not a pointer)', async () => {
    await project.write({
      'CLAUDE.md':
        '# CLAUDE.md\n\nThe init command can create an AGENTS.md file.\n',
    });

    const result = await runBin('init', '--repo', 'gleanwork/demo');

    expect(result.stdout).toContain('needs migration');
    expect(exists('AGENTS.md')).toBe(false);
  });

  it('check fails when CLAUDE.md mentions AGENTS.md but does not import it', async () => {
    await runBin('init', '--repo', 'gleanwork/demo');
    await project.write({
      'CLAUDE.md': '# CLAUDE.md\n\nSee AGENTS.md for details.\n',
    });

    const result = await runBin('check');

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('must import AGENTS.md');
  });

  it('migrate refuses when AGENTS.md already exists', async () => {
    await project.write({
      'CLAUDE.md': '# old\n\nlegacy\n',
      'AGENTS.md': '# AGENTS.md\n',
    });

    const result = await runBin('migrate');

    expect(result.stderr).toContain('already exists');
    expect(read('CLAUDE.md')).toBe('# old\n\nlegacy\n');
  });

  it('migrate is a no-op when CLAUDE.md already points to AGENTS.md', async () => {
    await project.write({ 'CLAUDE.md': '# CLAUDE.md\n\n@AGENTS.md\n' });

    const result = await runBin('migrate');

    expect(result.stdout).toContain('already points to AGENTS.md');
    expect(exists('AGENTS.md')).toBe(false);
  });

  it('migrate --dryRun writes nothing', async () => {
    await project.write({ 'CLAUDE.md': '# old\n\nlegacy\n' });

    const result = await runBin('migrate', '--dryRun');

    expect(result.stdout).toContain('Planned migration');
    expect(exists('AGENTS.md')).toBe(false);
    expect(read('CLAUDE.md')).toBe('# old\n\nlegacy\n');
  });

  it('init refuses to create AGENTS.md when an un-migrated CLAUDE.md exists', async () => {
    await project.write({
      'CLAUDE.md': '# CLAUDE.md\n\nLegacy instructions.\n',
    });

    const result = await runBin('init', '--repo', 'gleanwork/demo');

    expect(result.stdout).toContain('needs migration');
    expect(exists('AGENTS.md')).toBe(false);
    expect(exists(skill())).toBe(true);
  });
});
