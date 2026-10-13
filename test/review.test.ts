import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createBintastic, type BintasticProject } from 'bintastic';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PRESETS,
  compileCodex,
  matchPreset,
  parsePermissions,
  toCodexPrefix,
} from '../src/review/permissions.js';

const { setupProject, teardownProject, runBin } = createBintastic({
  binPath: fileURLToPath(new URL('../build/index.js', import.meta.url)),
});

const SETTINGS = '.claude/settings.json';
const CODEX = '.codex/rules/permissions.rules';

describe('permission presets and compiler', () => {
  it('match the contract shared with the scalvert plugin', () => {
    const fixture = JSON.parse(
      fs.readFileSync(
        new URL('./fixtures/presets.json', import.meta.url),
        'utf8',
      ),
    );

    expect(PRESETS).toEqual(fixture);
  });

  it('compile the same Codex rules as the scalvert plugin', () => {
    const fixture = fs.readFileSync(
      new URL('./fixtures/draft-pr.rules', import.meta.url),
      'utf8',
    );

    expect(compileCodex(PRESETS['draft-pr'])).toBe(fixture);
  });

  it('recognizes each preset and nothing else', () => {
    for (const level of ['local-only', 'draft-pr', 'self-merge'] as const) {
      expect(matchPreset(PRESETS[level])).toBe(level);
    }

    expect(
      matchPreset({ allow: [], ask: ['Bash(x *)'], deny: [] }),
    ).toBeUndefined();
  });

  it('turns prefix-shaped rules into Codex prefix rules and leaves the rest out', () => {
    expect(toCodexPrefix('Bash(gh pr comment *)', 'ask')).toEqual([
      'gh',
      'pr',
      'comment',
    ]);
    expect(toCodexPrefix('Bash(npm run test:*)', 'allow')).toEqual([
      'npm',
      'run',
      'test',
    ]);
    expect(toCodexPrefix('Bash(gh pr view)', 'deny')).toEqual([
      'gh',
      'pr',
      'view',
    ]);
    expect(toCodexPrefix('Bash(gh pr view)', 'allow')).toBeNull();
    expect(toCodexPrefix('Bash(git push * main)', 'ask')).toBeNull();
    expect(toCodexPrefix('mcp__github__create_*', 'ask')).toBeNull();

    const rules = compileCodex(PRESETS['draft-pr']);

    expect(rules).toContain(
      'prefix_rule(pattern=["gh","pr","merge"], decision="prompt", justification="repo rule ask: Bash(gh pr merge *)")',
    );
    expect(rules).toContain(
      'pattern=["gh","pr","create","--draft"], decision="allow"',
    );
    expect(rules).not.toContain('main');
  });

  it('writes settings JSON exactly as Prettier formats it', async () => {
    const prettier = await import('prettier');
    const { formatJson } = await import('../src/review/json.js');

    for (const value of [
      { permissions: PRESETS['draft-pr'] },
      { permissions: PRESETS['self-merge'] },
      { permissions: PRESETS['local-only'] },
      {
        env: { A: '1' },
        nested: { list: [1, 2], empty: [], obj: {} },
        permissions: PRESETS['draft-pr'],
      },
    ]) {
      const ours = formatJson(value);

      expect(ours).toBe(await prettier.format(ours, { parser: 'json' }));
      expect(JSON.parse(ours)).toEqual(value);
    }
  });

  it('rejects invalid permission blocks', () => {
    expect(() => parsePermissions([])).toThrow();
    expect(() => parsePermissions({ ask: 'Bash(x)' })).toThrow();
    expect(() => parsePermissions({ deny: [''] })).toThrow();
    expect(() => parsePermissions({ allow: ['Bash(unclosed'] })).toThrow();
  });
});

describe('configure-agents review', () => {
  let project: BintasticProject;

  beforeEach(async () => {
    project = await setupProject();
  });

  afterEach(() => {
    teardownProject();
  });

  const file = (relativePath: string) =>
    path.join(project.baseDir, relativePath);
  const read = (relativePath: string) =>
    fs.readFileSync(file(relativePath), 'utf8');
  const exists = (relativePath: string) => fs.existsSync(file(relativePath));

  it('scaffolds rules, AGENTS.md sections, REVIEW.md and Codex rules', async () => {
    const result = await runBin('review');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatchInlineSnapshot(`
      "Created .claude/settings.json (draft-pr permissions)
      Added review sections in AGENTS.md
      Created REVIEW.md
      Created .codex/rules/permissions.rules"
    `);
    expect(JSON.parse(read(SETTINGS)).permissions).toEqual(PRESETS['draft-pr']);
    expect(read('AGENTS.md')).toContain('## Ask first');
    expect(read('AGENTS.md')).toContain('the `draft-pr` preset');
    expect(read('AGENTS.md')).toContain('## Commit and PR guidelines');
    expect(read('AGENTS.md')).toContain('Follow [REVIEW.md](REVIEW.md)');
    expect(read(CODEX)).toBe(compileCodex(PRESETS['draft-pr']));
    expect(exists('REVIEW.md')).toBe(true);
  });

  it('applies the requested autonomy', async () => {
    await runBin('review', '--autonomy', 'self-merge');

    expect(JSON.parse(read(SETTINGS)).permissions).toEqual(
      PRESETS['self-merge'],
    );
  });

  it('rejects an unknown autonomy', async () => {
    const result = await runBin('review', '--autonomy', 'yolo');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('unknown autonomy "yolo"');
  });

  it('is idempotent', async () => {
    await runBin('review');
    const agents = read('AGENTS.md');
    const result = await runBin('review');

    expect(result.stdout).toContain(
      'Skipping AGENTS.md (review sections up to date)',
    );
    expect(read('AGENTS.md')).toBe(agents);
  });

  it('keeps existing permissions and other settings', async () => {
    const permissions = {
      allow: ['Bash(npm test *)'],
      ask: ['Bash(gh pr merge *)'],
      deny: [],
    };

    await project.write({
      '.claude': {
        'settings.json': JSON.stringify({ env: { A: '1' }, permissions }),
      },
    });

    const result = await runBin('review', '--autonomy', 'self-merge');

    expect(result.stdout).toContain('Keeping existing permissions');
    expect(JSON.parse(read(SETTINGS))).toEqual({
      env: { A: '1' },
      permissions,
    });
    expect(read('AGENTS.md')).toContain('- `Bash(gh pr merge *)`');
    expect(read('AGENTS.md')).not.toContain('preset)');
  });

  it('adds permissions to an existing settings file without dropping other keys', async () => {
    await project.write({
      '.claude': { 'settings.json': JSON.stringify({ env: { A: '1' } }) },
    });

    await runBin('review');

    const settings = JSON.parse(read(SETTINGS));

    expect(settings.env).toEqual({ A: '1' });
    expect(settings.permissions).toEqual(PRESETS['draft-pr']);
  });

  it('adds sections to an existing AGENTS.md without clobbering it', async () => {
    await project.write({
      'AGENTS.md': '# AGENTS.md\n\n## Development\n\nnpm test\n',
    });

    await runBin('review');

    expect(read('AGENTS.md')).toMatch(
      /^# AGENTS\.md\n\n## Development\n\nnpm test\n\n<!-- configure-agents:review start -->/,
    );
  });

  it('warns when git ignores the settings file', async () => {
    const { execFileSync } = await import('node:child_process');

    execFileSync('git', ['init', '-q'], { cwd: project.baseDir });
    await project.write({ '.gitignore': '.claude/\n' });

    const result = await runBin('review');

    expect(result.stdout).toContain(
      'Warning: git ignores .claude/settings.json (.gitignore:1:.claude/)',
    );
    expect(result.stdout).toContain('git add -f .claude/settings.json');
  });

  it('--dryRun writes nothing', async () => {
    const result = await runBin('review', '--dryRun');

    expect(result.stdout).toContain('Planned changes:');
    expect(exists(SETTINGS)).toBe(false);
    expect(exists('AGENTS.md')).toBe(false);
  });

  it('check --review-only passes after review', async () => {
    await runBin('review');
    const result = await runBin('check', '--review-only');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Baseline OK.');
  });

  it('check flags rules that drifted from AGENTS.md and Codex', async () => {
    await runBin('review');

    const settings = JSON.parse(read(SETTINGS));
    settings.permissions.ask.push('Bash(gh workflow run *)');
    fs.writeFileSync(file(SETTINGS), JSON.stringify(settings));

    const result = await runBin('check', '--review-only', '--json');
    const messages = JSON.parse(result.stdout).violations.map(
      (v: { file: string; message: string }) => `${v.file}: ${v.message}`,
    );

    expect(result.exitCode).toBe(1);
    expect(messages).toEqual([
      'AGENTS.md: review sections do not match the rules in .claude/settings.json (run: configure-agents review)',
      '.codex/rules/permissions.rules: out of date with .claude/settings.json (run: configure-agents review)',
    ]);

    await runBin('review');
    expect((await runBin('check', '--review-only')).exitCode).toBe(0);
  });

  it('check flags a missing REVIEW.md, guidelines and invalid settings', async () => {
    await runBin('review');
    fs.rmSync(file('REVIEW.md'));
    fs.writeFileSync(
      file('AGENTS.md'),
      read('AGENTS.md').replace('## Commit and PR guidelines', '## Other'),
    );

    let messages = JSON.parse(
      (await runBin('check', '--review-only', '--json')).stdout,
    ).violations.map((v: { message: string }) => v.message);

    expect(messages).toContain('missing a "Commit and PR guidelines" section');
    expect(messages).toContain('file is missing');

    fs.writeFileSync(file(SETTINGS), '{not json');
    messages = JSON.parse(
      (await runBin('check', '--review-only', '--json')).stdout,
    ).violations.map((v: { message: string }) => v.message);

    expect(messages[0]).toMatch(/not valid JSON/);
  });

  it('plain check includes review checks only once a repo opts in', async () => {
    await runBin('init', '--repo', 'gleanwork/demo');
    expect((await runBin('check')).exitCode).toBe(0);

    await runBin('review');
    fs.rmSync(file(CODEX));

    const result = await runBin('check');

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain(`${CODEX}: file is missing`);
  });

  it('init --review scaffolds the baseline and the review module', async () => {
    const result = await runBin(
      'init',
      '--repo',
      'gleanwork/demo',
      '--review',
      '--autonomy',
      'local-only',
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(read(SETTINGS)).permissions).toEqual(
      PRESETS['local-only'],
    );
    expect((await runBin('check')).exitCode).toBe(0);
  });
});
